// Storage-agnostic normalize/migrate logic shared by every ListStore
// adapter (file-backed and D1). Reads own the legacy format migrations
// and — for Tasks and Recurring Items — normalize-on-read: lifecycle
// rules (due-soon promotion, Trash purge, weekly reset) run on every
// read and the adapter writes back when anything changed. This is the
// app's only scheduler; there is no background job.
//
// Each normalizer takes raw parsed rows and returns the cleaned list
// plus a `changed` flag telling the adapter to persist the result.

import { promoteDueSoon, purgeTrash, type Task } from "../domain/task-rules";
import { resetWeeklyItems, type RecurringItem } from "../domain/recurrence";
import type { ShoppingItem, GroceryItem } from "../domain/entities";

// ── Tasks ──

// Raw task rows from storage may predate the current schema
type LegacyTaskRecord = Omit<Task, "status"> & {
  status?: string;
  done?: boolean;
  /** Retired 2026-07: replaced by binary Importance (see CONTEXT.md). */
  priority?: string;
};

/**
 * Loaders for the sourceItemId backfill: only invoked when a migration
 * fired, so adapters can pass their own (possibly costly) readers.
 */
export type TaskBackfillSources = {
  readShopping: () => Promise<ShoppingItem[]>;
  readGroceries: () => Promise<GroceryItem[]>;
};

export const normalizeTasks = async (
  raw: LegacyTaskRecord[],
  now: Date,
  sources: TaskBackfillSources
): Promise<{ tasks: Task[]; changed: boolean }> => {
  let needsMigration = false;
  let tasks = raw.map((t) => {
    // Legacy file-format migrations only; lifecycle rules live in task-rules.ts
    if (!t.status) {
      needsMigration = true;
      t.status = t.done ? "done" : "this-week";
    } else if (t.status === "active") {
      needsMigration = true;
      t.status = "this-week";
    }
    if (t.deletedAt === undefined) {
      t.deletedAt = null;
    }
    if (t.importance === undefined) {
      t.importance = null;
    }
    if (!t.source) {
      t.source = "board";
    }
    if (t.sourceItemId === undefined || t.sourceItemId === null) {
      t.sourceItemId = null;
      if (t.source === "shopping" || t.source === "grocery") {
        needsMigration = true;
      }
    }
    if ("priority" in t) {
      needsMigration = true;
      delete t.priority;
    }
    return t as Task;
  });

  const normalized = purgeTrash(promoteDueSoon(tasks, now), now);
  if (normalized !== tasks) {
    needsMigration = true;
    tasks = normalized;
  }

  if (needsMigration) {
    const shopping = await sources.readShopping();
    const groceries = await sources.readGroceries();
    for (const t of tasks) {
      if (!t.sourceItemId && t.source === "shopping") {
        const match = shopping.find((s) => s.title === t.title);
        if (match) t.sourceItemId = match.id;
      } else if (!t.sourceItemId && t.source === "grocery") {
        const match = groceries.find((g) => g.title === t.title);
        if (match) t.sourceItemId = match.id;
      }
    }
  }
  return { tasks, changed: needsMigration };
};

// ── Shopping Items ──
// Defaults are applied on every read but never written back.

export const normalizeShopping = (raw: ShoppingItem[]): ShoppingItem[] =>
  raw.map((i) => ({
    ...i,
    category: i.category || "need",
    links: Array.isArray(i.links) ? i.links : [],
    doneAt: i.doneAt ?? null,
  }));

// ── Recurring Items ──
// Legacy format migrations only; week & recurrence rules live in
// src/domain/recurrence.ts

export const normalizeRecurring = (
  raw: RecurringItem[],
  now: Date
): { items: RecurringItem[]; changed: boolean } => {
  let needsMigration = false;
  const migrated = raw.map((i) => {
    const item: RecurringItem = {
      id: i.id,
      title: i.title || "Untitled",
      frequency: i.frequency === "long-term" ? "long-term" : "weekly",
      dayOfWeek: i.dayOfWeek ?? null,
      repeatEvery: i.repeatEvery ?? 1,
      repeatUnit: i.repeatUnit ?? "week",
      repeatDays: i.repeatDays ?? (i.dayOfWeek != null ? [i.dayOfWeek] : []),
      endsType: i.endsType ?? "never",
      endsOn: i.endsOn ?? null,
      endsAfter: i.endsAfter ?? null,
      note: i.note || "",
      link: i.link || "",
      completedThisWeek: i.completedThisWeek || false,
      lastCompletedAt: i.lastCompletedAt ?? null,
      createdAt: i.createdAt,
      dueDate: i.dueDate ?? null,
      showEarlyDays: i.showEarlyDays ?? null,
      area: i.area || "",
      category: i.category === "reference" ? "reference" : "task",
    };
    if (
      item.frequency === "long-term" &&
      item.repeatUnit === "week" &&
      item.repeatEvery === 1
    ) {
      item.repeatUnit = "year";
      needsMigration = true;
    }
    return item;
  });
  const items = resetWeeklyItems(migrated, now);
  return { items, changed: needsMigration || items !== migrated };
};
