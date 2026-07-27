// File-backed store adapters: the production side of the ListStore
// seam. Each family persists to one JSON file in data/. Reads own the
// legacy file-format migrations and — for Tasks and Recurring Items —
// normalize-on-read: lifecycle rules (due-soon promotion, Trash purge,
// weekly reset) run on every read and write back when anything changed.
// This is the app's only scheduler; there is no background job.

import { existsSync } from "node:fs";
import { promoteDueSoon, purgeTrash, type Task } from "../domain/task-rules";
import { resetWeeklyItems, type RecurringItem } from "../domain/recurrence";
import type { ShoppingItem, GroceryItem } from "../domain/entities";
import type { ListStore } from "./resource";

// In production on Zo, data lives OUTSIDE the Mutagen-synced personal-os
// tree so a broken/re-created file sync can never overwrite the live
// database (see docs/DEPLOY.md). Resolution order:
//   1. DATA_DIR env var (explicit override)
//   2. /home/workspace/todo-data — the Zo production location, used
//      whenever it exists so no env configuration is required there
//   3. ./data in the repo — local development and tests
const ZO_DATA_DIR = "/home/workspace/todo-data";
export const dataDir =
  process.env.DATA_DIR ??
  (existsSync(ZO_DATA_DIR) ? ZO_DATA_DIR : import.meta.dir + "/../../data");

const TASKS_PATH = dataDir + "/tasks.json";
const SHOPPING_PATH = dataDir + "/shopping.json";
const GROCERY_PATH = dataDir + "/groceries.json";
const RECURRING_PATH = dataDir + "/recurring.json";
const SETTINGS_PATH = dataDir + "/settings.json";

const readJsonList = async <T>(path: string): Promise<T[] | null> => {
  try {
    const file = Bun.file(path);
    if (await file.exists()) return JSON.parse(await file.text()) as T[];
  } catch {
    // corrupt or missing data file — caller falls back to empty list
  }
  return null;
};

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await Bun.write(path, JSON.stringify(value, null, 2));
};

// ── Tasks ──

// Raw task rows from disk may predate the current schema
type LegacyTaskRecord = Omit<Task, "status"> & {
  status?: string;
  done?: boolean;
  /** Retired 2026-07: replaced by binary Importance (see CONTEXT.md). */
  priority?: string;
};

export const readTasks = async (): Promise<Task[]> => {
  const raw = await readJsonList<LegacyTaskRecord>(TASKS_PATH);
  if (!raw) return [];

  let needsMigration = false;
  const now = new Date();
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
    const shopping = await readShopping();
    const groceries = await readGroceries();
    for (const t of tasks) {
      if (!t.sourceItemId && t.source === "shopping") {
        const match = shopping.find((s) => s.title === t.title);
        if (match) t.sourceItemId = match.id;
      } else if (!t.sourceItemId && t.source === "grocery") {
        const match = groceries.find((g) => g.title === t.title);
        if (match) t.sourceItemId = match.id;
      }
    }
    await writeTasks(tasks);
  }
  return tasks;
};

export const writeTasks = (tasks: Task[]) => writeJson(TASKS_PATH, tasks);

export const tasksStore: ListStore<Task> = {
  read: readTasks,
  write: writeTasks,
};

// ── Shopping Items ──

export const readShopping = async (): Promise<ShoppingItem[]> => {
  const raw = await readJsonList<ShoppingItem>(SHOPPING_PATH);
  if (!raw) return [];
  return raw.map((i) => ({
    ...i,
    category: i.category || "need",
    links: Array.isArray(i.links) ? i.links : [],
    doneAt: i.doneAt ?? null,
  }));
};

export const writeShopping = (items: ShoppingItem[]) =>
  writeJson(SHOPPING_PATH, items);

export const shoppingStore: ListStore<ShoppingItem> = {
  read: readShopping,
  write: writeShopping,
};

// ── Grocery Items ──

export const readGroceries = async (): Promise<GroceryItem[]> =>
  (await readJsonList<GroceryItem>(GROCERY_PATH)) ?? [];

export const writeGroceries = (items: GroceryItem[]) =>
  writeJson(GROCERY_PATH, items);

export const groceriesStore: ListStore<GroceryItem> = {
  read: readGroceries,
  write: writeGroceries,
};

// ── Recurring Items ──
// Legacy file-format migrations only; week & recurrence rules live in
// src/domain/recurrence.ts

export const readRecurring = async (): Promise<RecurringItem[]> => {
  const raw = await readJsonList<RecurringItem>(RECURRING_PATH);
  if (!raw) return [];

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
  const items = resetWeeklyItems(migrated, new Date());
  if (needsMigration || items !== migrated) await writeRecurring(items);
  return items;
};

export const writeRecurring = (items: RecurringItem[]) =>
  writeJson(RECURRING_PATH, items);

export const recurringStore: ListStore<RecurringItem> = {
  read: readRecurring,
  write: writeRecurring,
};

// ── Settings ──
// Not a list family: a single object with GET/PUT, served bespoke in
// server.ts.

export const readSettings = async (): Promise<Record<string, unknown>> => {
  try {
    const file = Bun.file(SETTINGS_PATH);
    if (await file.exists()) {
      return JSON.parse(await file.text());
    }
  } catch {
    // corrupt or missing data file — fall back to empty settings
  }
  return {};
};

export const writeSettings = (settings: Record<string, unknown>) =>
  writeJson(SETTINGS_PATH, settings);
