import { describe, expect, test } from "bun:test";
import {
  applyStatusChange,
  promoteDueSoon,
  purgeTrash,
  DUE_SOON_MS,
  TRASH_TTL_MS,
  type Task,
  type TaskStatus,
} from "./task-rules";

const NOW = new Date("2026-07-20T12:00:00.000Z");

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Test task",
    done: false,
    status: "this-week",
    priority: "medium",
    effort: "medium",
    decisionLoad: "medium",
    area: "life-admin",
    dueDate: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    completedAt: null,
    deletedAt: null,
    source: "board",
    sourceItemId: null,
    ...overrides,
  };
}

describe("applyStatusChange — status transition matrix", () => {
  const statuses: TaskStatus[] = ["this-week", "this-month", "future", "done", "trashed"];

  const fromState = (status: TaskStatus): Partial<Task> =>
    status === "done"
      ? { status, done: true, completedAt: "2026-07-10T00:00:00.000Z" }
      : status === "trashed"
        ? { status, deletedAt: "2026-07-15T00:00:00.000Z" }
        : { status };

  for (const from of statuses) {
    for (const to of statuses) {
      test(`${from} → ${to}`, () => {
        const task = makeTask(fromState(from));
        const result = applyStatusChange(task, { status: to }, NOW);

        expect(result.status).toBe(to);

        if (from === to) {
          expect(result).toBe(task); // no-op returns same instance
          return;
        }

        // done ↔ completedAt
        if (to === "done") {
          expect(result.done).toBe(true);
          expect(result.completedAt).toBe(NOW.toISOString());
        } else {
          expect(result.done).toBe(false);
          expect(result.completedAt).toBeNull();
        }

        // trashed ↔ deletedAt
        if (to === "trashed") {
          expect(result.deletedAt).toBe(NOW.toISOString());
        } else if (from === "trashed") {
          expect(result.deletedAt).toBeNull(); // restore clears the stamp
        } else {
          expect(result.deletedAt).toBe(task.deletedAt);
        }
      });
    }
  }
});

describe("applyStatusChange — done shorthand", () => {
  test("done: true moves to done and stamps completedAt", () => {
    const result = applyStatusChange(makeTask(), { done: true }, NOW);
    expect(result.status).toBe("done");
    expect(result.done).toBe(true);
    expect(result.completedAt).toBe(NOW.toISOString());
  });

  test("done: false on a done Task returns it to This Week", () => {
    const task = makeTask({ status: "done", done: true, completedAt: "2026-07-10T00:00:00.000Z" });
    const result = applyStatusChange(task, { done: false }, NOW);
    expect(result.status).toBe("this-week");
    expect(result.done).toBe(false);
    expect(result.completedAt).toBeNull();
  });

  test("done: true on an already-done Task is a no-op", () => {
    const task = makeTask({ status: "done", done: true, completedAt: "2026-07-10T00:00:00.000Z" });
    expect(applyStatusChange(task, { done: true }, NOW)).toBe(task);
  });

  test("done: false on a not-done Task is a no-op", () => {
    const task = makeTask({ status: "future" });
    expect(applyStatusChange(task, { done: false }, NOW)).toBe(task);
  });

  test("status takes precedence over done in the same change", () => {
    const result = applyStatusChange(makeTask(), { status: "done", done: false }, NOW);
    expect(result.status).toBe("done");
    expect(result.done).toBe(true);
  });
});

describe("promoteDueSoon", () => {
  const dueIn = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

  test("This Month task due in exactly 7 days is promoted", () => {
    const tasks = [makeTask({ status: "this-month", dueDate: dueIn(DUE_SOON_MS) })];
    expect(promoteDueSoon(tasks, NOW)[0].status).toBe("this-week");
  });

  test("This Month task due just past 7 days stays", () => {
    const tasks = [makeTask({ status: "this-month", dueDate: dueIn(DUE_SOON_MS + 1000) })];
    const result = promoteDueSoon(tasks, NOW);
    expect(result[0].status).toBe("this-month");
    expect(result).toBe(tasks); // unchanged input returns same instance
  });

  test("overdue This Month task is promoted", () => {
    const tasks = [makeTask({ status: "this-month", dueDate: dueIn(-DUE_SOON_MS) })];
    expect(promoteDueSoon(tasks, NOW)[0].status).toBe("this-week");
  });

  test("task without a due date stays", () => {
    const tasks = [makeTask({ status: "this-month" })];
    expect(promoteDueSoon(tasks, NOW)).toBe(tasks);
  });

  test("only This Month tasks are considered", () => {
    const tasks = [makeTask({ status: "future", dueDate: dueIn(0) })];
    expect(promoteDueSoon(tasks, NOW)).toBe(tasks);
  });
});

describe("purgeTrash", () => {
  const deletedAgo = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  test("trashed task at exactly 30 days survives", () => {
    const tasks = [makeTask({ status: "trashed", deletedAt: deletedAgo(TRASH_TTL_MS) })];
    expect(purgeTrash(tasks, NOW)).toHaveLength(1);
  });

  test("trashed task just past 30 days is purged", () => {
    const tasks = [makeTask({ status: "trashed", deletedAt: deletedAgo(TRASH_TTL_MS + 1000) })];
    expect(purgeTrash(tasks, NOW)).toHaveLength(0);
  });

  test("trashed task without deletedAt survives", () => {
    const tasks = [makeTask({ status: "trashed" })];
    expect(purgeTrash(tasks, NOW)).toBe(tasks);
  });

  test("non-trashed tasks are never purged", () => {
    const tasks = [makeTask({ status: "done", completedAt: deletedAgo(TRASH_TTL_MS * 2) })];
    expect(purgeTrash(tasks, NOW)).toBe(tasks);
  });
});
