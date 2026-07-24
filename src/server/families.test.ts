// Pure tests for the family configs: construct defaults, update-time
// domain stamping, and remove semantics — no HTTP, no files, injected now.

import { describe, test, expect } from "bun:test";
import type { Task } from "../domain/task-rules";
import type { RecurringItem } from "../domain/recurrence";
import {
  tasksFamily,
  shoppingFamily,
  groceriesFamily,
  recurringFamily,
} from "./families";

const NOW = new Date("2026-07-22T12:00:00.000Z");

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Task",
  done: false,
  status: "this-week",
  priority: "medium",
  effort: "medium",
  decisionLoad: "medium",
  area: "life-admin",
  dueDate: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
  deletedAt: null,
  source: "board",
  sourceItemId: null,
  ...overrides,
});

describe("tasksFamily", () => {
  test("construct applies defaults and stamps createdAt", () => {
    const task = tasksFamily.construct({ title: "Buy stamps" }, NOW);
    expect(task.title).toBe("Buy stamps");
    expect(task.status).toBe("this-week");
    expect(task.done).toBe(false);
    expect(task.createdAt).toBe(NOW.toISOString());
    expect(task.completedAt).toBeNull();
  });

  test("applyUpdate delegates status changes to task-rules", () => {
    const prev = makeTask();
    const updated = tasksFamily.applyUpdate!(
      prev,
      prev,
      { status: "done" },
      NOW
    );
    expect(updated.status).toBe("done");
    expect(updated.done).toBe(true);
    expect(updated.completedAt).toBe(NOW.toISOString());
  });

  test("applyUpdate leaves lifecycle untouched without status/done", () => {
    const prev = makeTask();
    const merged = { ...prev, title: "Renamed" };
    const updated = tasksFamily.applyUpdate!(
      prev,
      merged,
      { title: "Renamed" },
      NOW
    );
    expect(updated).toEqual(merged);
  });

  test("applyRemove soft-deletes to the Trash by default", () => {
    const removed = tasksFamily.applyRemove!(
      makeTask(),
      { permanent: false },
      NOW
    );
    expect(removed).not.toBeNull();
    expect(removed!.status).toBe("trashed");
    expect(removed!.deletedAt).toBe(NOW.toISOString());
  });

  test("applyRemove hard-deletes when permanent", () => {
    const removed = tasksFamily.applyRemove!(
      makeTask(),
      { permanent: true },
      NOW
    );
    expect(removed).toBeNull();
  });
});

describe("shoppingFamily", () => {
  test("construct defaults to an unbought need", () => {
    const item = shoppingFamily.construct({ title: "Socks" }, NOW);
    expect(item.category).toBe("need");
    expect(item.done).toBe(false);
    expect(item.doneAt).toBeNull();
  });

  test("applyUpdate stamps doneAt when an item becomes bought", () => {
    const prev = shoppingFamily.construct({ title: "Socks" }, NOW);
    const merged = { ...prev, done: true };
    const updated = shoppingFamily.applyUpdate!(
      prev,
      merged,
      { done: true },
      NOW
    );
    expect(updated.doneAt).toBe(NOW.toISOString());
  });

  test("applyUpdate clears doneAt when un-bought", () => {
    const prev = {
      ...shoppingFamily.construct({ title: "Socks" }, NOW),
      done: true,
      doneAt: NOW.toISOString(),
    };
    const merged = { ...prev, done: false };
    const updated = shoppingFamily.applyUpdate!(
      prev,
      merged,
      { done: false },
      NOW
    );
    expect(updated.doneAt).toBeNull();
  });
});

describe("groceriesFamily", () => {
  test("construct defaults to an unbought task item", () => {
    const item = groceriesFamily.construct({ title: "Milk" }, NOW);
    expect(item.done).toBe(false);
    expect(item.category).toBe("task");
  });

  test("reference category is respected", () => {
    const item = groceriesFamily.construct(
      { title: "Store hours", category: "reference" },
      NOW
    );
    expect(item.category).toBe("reference");
  });
});

describe("recurringFamily", () => {
  test("construct forces reference items to weekly defaults", () => {
    const item = recurringFamily.construct(
      { title: "Gym link", category: "reference", frequency: "long-term" },
      NOW
    );
    expect(item.category).toBe("reference");
    expect(item.frequency).toBe("weekly");
    expect(item.endsType).toBe("never");
    expect(item.repeatDays).toEqual([]);
  });

  test("applyUpdate stamps completion against the pre-merge item", () => {
    const prev = recurringFamily.construct({ title: "Laundry" }, NOW);
    const merged = { ...prev, completedThisWeek: true };
    const updated = recurringFamily.applyUpdate!(
      prev,
      merged,
      { completedThisWeek: true },
      NOW
    );
    expect(updated.completedThisWeek).toBe(true);
    expect(updated.lastCompletedAt).toBe(NOW.toISOString());
  });

  test("done: true advances a long-term item's dueDate", () => {
    const prev: RecurringItem = {
      ...recurringFamily.construct(
        {
          title: "Dentist",
          frequency: "long-term",
          repeatEvery: 6,
          repeatUnit: "month",
        },
        NOW
      ),
      dueDate: "2026-07-22",
    };
    const updated = recurringFamily.applyUpdate!(
      prev,
      prev,
      { done: true },
      NOW
    );
    expect(updated.dueDate).not.toBe("2026-07-22");
    expect(updated.lastCompletedAt).toBe(NOW.toISOString());
  });
});
