// The four list-family configs: pure construct/applyUpdate/applyRemove
// hooks plus the writable-field whitelist each family's PUT accepts.
// No I/O here — stores are injected where the routes are mounted
// (server.ts), so every hook is testable as a plain function.
// Construction defaults live in the shared domain layer (construct.ts)
// so the client can build identical items for optimistic/offline creates.

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
import {
  constructGroceryItem,
  constructRecurringItem,
  constructShoppingItem,
  constructTask,
} from "../domain/construct";
import type { ShoppingItem, GroceryItem } from "../domain/entities";
import type { FamilyConfig } from "./resource";

// ── Tasks ──
// Lifecycle fields (done, completedAt, deletedAt) are owned by
// task-rules; a PUT can request a status/done change but cannot write
// the stamps directly. Deletes are soft — Tasks go to the Trash unless
// ?permanent=true.

export const tasksFamily: FamilyConfig<Task> = {
  writable: [
    "title",
    "status",
    "effort",
    "decisionLoad",
    "area",
    "dueDate",
    "importance",
    "links",
  ],
  construct: constructTask,
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
  construct: constructShoppingItem,
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
  construct: constructGroceryItem,
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
  construct: constructRecurringItem,
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
