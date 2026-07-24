// The four list-family configs: pure construct/applyUpdate/applyRemove
// hooks plus the writable-field whitelist each family's PUT accepts.
// No I/O here — stores are injected where the routes are mounted
// (server.ts), so every hook is testable as a plain function.

import {
  applyStatusChange,
  type Task,
  type TaskStatus,
} from "../domain/task-rules";
import {
  advanceDueDate,
  applyRecurringCompletion,
  type RecurringItem,
} from "../domain/recurrence";
import type { ShoppingItem, GroceryItem } from "../domain/entities";
import type { FamilyConfig } from "./resource";

const newId = () => crypto.randomUUID().slice(0, 8);

// ── Tasks ──
// Lifecycle fields (done, completedAt, deletedAt) are owned by
// task-rules; a PUT can request a status/done change but cannot write
// the stamps directly. Deletes are soft — Tasks go to the Trash unless
// ?permanent=true.

export const tasksFamily: FamilyConfig<Task> = {
  writable: [
    "title",
    "status",
    "priority",
    "effort",
    "decisionLoad",
    "area",
    "dueDate",
  ],
  construct: (body, now) => ({
    id: newId(),
    title: (body.title as string) || "Untitled",
    done: false,
    status: (body.status as TaskStatus) || "this-week",
    priority: (body.priority as Task["priority"]) || "medium",
    effort: (body.effort as Task["effort"]) || "medium",
    decisionLoad: (body.decisionLoad as Task["decisionLoad"]) || "medium",
    area: (body.area as string) || "life-admin",
    dueDate: (body.dueDate as string) || null,
    createdAt: now.toISOString(),
    completedAt: null,
    deletedAt: null,
    source: (body.source as Task["source"]) || "board",
    sourceItemId: (body.sourceItemId as string) || null,
  }),
  applyUpdate: (prev, merged, body, now) => {
    if (body.status === undefined && body.done === undefined) return merged;
    const lifecycle = applyStatusChange(
      prev,
      { status: body.status as TaskStatus, done: body.done as boolean },
      now
    );
    return {
      ...merged,
      status: lifecycle.status,
      done: lifecycle.done,
      completedAt: lifecycle.completedAt,
      deletedAt: lifecycle.deletedAt,
    };
  },
  applyRemove: (prev, { permanent }, now) =>
    permanent ? null : applyStatusChange(prev, { status: "trashed" }, now),
};

// ── Shopping Items ──
// doneAt is stamped when an item becomes bought and cleared when it
// reverts; a PUT cannot write it directly.

export const shoppingFamily: FamilyConfig<ShoppingItem> = {
  writable: ["title", "done", "archived", "category", "links"],
  construct: (body, now) => ({
    id: newId(),
    title: (body.title as string) || "Untitled",
    done: false,
    archived: false,
    category: body.category === "want" ? "want" : "need",
    links: Array.isArray(body.links) ? (body.links as string[]) : [],
    createdAt: now.toISOString(),
    doneAt: null,
  }),
  applyUpdate: (prev, merged, body, now) => {
    if (body.done === true && !prev.done) {
      return { ...merged, doneAt: now.toISOString() };
    }
    if (body.done === false && prev.done) {
      return { ...merged, doneAt: null };
    }
    return merged;
  },
};

// ── Grocery Items ──
// The lightest family: plain whitelisted merges, hard deletes.

export const groceriesFamily: FamilyConfig<GroceryItem> = {
  writable: ["title", "done", "category"],
  construct: (body, now) => ({
    id: newId(),
    title: (body.title as string) || "Untitled",
    done: false,
    createdAt: now.toISOString(),
    category: body.category === "reference" ? "reference" : "task",
  }),
};

// ── Recurring Items ──
// `done` on a PUT is a command, not a field: completion stamping is
// evaluated against the pre-merge item (so "already completed" checks
// see the previous state), and completing a long-term item advances
// its dueDate per its ends settings.

export const recurringFamily: FamilyConfig<RecurringItem> = {
  writable: [
    "title",
    "frequency",
    "dayOfWeek",
    "repeatEvery",
    "repeatUnit",
    "repeatDays",
    "endsType",
    "endsOn",
    "endsAfter",
    "note",
    "link",
    "completedThisWeek",
    "dueDate",
    "showEarlyDays",
    "area",
    "category",
  ],
  construct: (body, now) => {
    const isEvent = body.category === "reference";
    return {
      id: newId(),
      title: (body.title as string) || "Untitled",
      frequency: isEvent
        ? "weekly"
        : body.frequency === "long-term"
          ? "long-term"
          : "weekly",
      dayOfWeek: (body.dayOfWeek as number) ?? null,
      repeatEvery: isEvent ? 1 : ((body.repeatEvery as number) ?? 1),
      repeatUnit: isEvent
        ? "week"
        : ((body.repeatUnit as RecurringItem["repeatUnit"]) ?? "week"),
      repeatDays: isEvent
        ? []
        : ((body.repeatDays as number[]) ??
          (body.dayOfWeek != null ? [body.dayOfWeek as number] : [])),
      endsType: isEvent
        ? "never"
        : ((body.endsType as RecurringItem["endsType"]) ?? "never"),
      endsOn: isEvent ? null : ((body.endsOn as string) ?? null),
      endsAfter: isEvent ? null : ((body.endsAfter as number) ?? null),
      note: (body.note as string) || "",
      link: (body.link as string) || "",
      completedThisWeek: false,
      lastCompletedAt: null,
      createdAt: now.toISOString(),
      dueDate: (body.dueDate as string) ?? null,
      showEarlyDays: (body.showEarlyDays as number) ?? null,
      area: (body.area as string) || "",
      category: isEvent ? "reference" : "task",
    };
  },
  applyUpdate: (prev, merged, body, now) => {
    const stamped = applyRecurringCompletion(
      prev,
      {
        completedThisWeek: body.completedThisWeek as boolean | undefined,
        done: body.done as boolean | undefined,
      },
      now
    );
    const result: RecurringItem = {
      ...merged,
      lastCompletedAt: stamped.lastCompletedAt,
      completedThisWeek: stamped.completedThisWeek,
    };
    return body.done === true ? advanceDueDate(result, now) : result;
  },
};
