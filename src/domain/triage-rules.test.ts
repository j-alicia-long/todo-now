// Behavioral tests for the Triage rules: given Tasks, a clock, and the
// skip rotation, what is the stack order; given a Skip, what is the new
// rotation. No internal structure is asserted; `now` is always injected.

import { describe, test, expect } from "bun:test";
import type { Task } from "./task-rules";
import { triageStack, applySkip } from "./triage-rules";

const NOW = new Date("2026-07-22T12:00:00");

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Task",
  done: false,
  status: "this-week",
  effort: "medium",
  decisionLoad: "medium",
  area: "life-admin",
  dueDate: null,
  importance: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
  deletedAt: null,
  source: "board",
  sourceItemId: null,
  ...overrides,
});

const ids = (stack: Task[]) => stack.map((t) => t.id);

describe("triageStack", () => {
  test("contains only Unsorted Board Tasks, in input order", () => {
    const stack = triageStack(
      [
        makeTask({ id: "a" }),
        makeTask({ id: "sorted", importance: "important" }),
        makeTask({ id: "b", status: "this-month" }),
        makeTask({ id: "future", status: "future" }),
        makeTask({ id: "done", status: "done" }),
        makeTask({ id: "trashed", status: "trashed" }),
      ],
      [],
      NOW
    );
    expect(ids(stack)).toEqual(["a", "b"]);
  });

  test("empty when nothing is Unsorted", () => {
    expect(
      triageStack([makeTask({ importance: "important" })], [], NOW)
    ).toEqual([]);
    expect(triageStack([], [], NOW)).toEqual([]);
  });

  test("skipped Tasks rotate to the back in skip order", () => {
    const tasks = [
      makeTask({ id: "a" }),
      makeTask({ id: "b" }),
      makeTask({ id: "c" }),
    ];
    expect(ids(triageStack(tasks, ["a"], NOW))).toEqual(["b", "c", "a"]);
    expect(ids(triageStack(tasks, ["b", "a"], NOW))).toEqual(["c", "b", "a"]);
  });

  test("newly Unsorted Tasks join ahead of skipped ones", () => {
    const tasks = [
      makeTask({ id: "a" }),
      makeTask({ id: "new" }),
      makeTask({ id: "b" }),
    ];
    expect(ids(triageStack(tasks, ["a", "b"], NOW))).toEqual(["new", "a", "b"]);
  });

  test("Tasks that leave the stack drop out without disturbing the rest", () => {
    const tasks = [
      makeTask({ id: "a", importance: "important" }), // sorted elsewhere
      makeTask({ id: "b" }),
      makeTask({ id: "c" }),
    ];
    expect(ids(triageStack(tasks, ["c", "a"], NOW))).toEqual(["b", "c"]);
  });

  test("single-Task stack survives being skipped", () => {
    const tasks = [makeTask({ id: "only" })];
    expect(ids(triageStack(tasks, ["only"], NOW))).toEqual(["only"]);
  });
});

describe("applySkip", () => {
  test("sends the active Task to the back", () => {
    expect(applySkip([], "a")).toEqual(["a"]);
    expect(applySkip(["a"], "b")).toEqual(["a", "b"]);
  });

  test("repeated skips cycle through the whole stack and wrap", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    let skipped: string[] = [];
    // Skip a, then b — everything is skipped once.
    skipped = applySkip(skipped, "a");
    skipped = applySkip(skipped, "b");
    expect(ids(triageStack(tasks, skipped, NOW))).toEqual(["a", "b"]);
    // Skipping a again wraps: it moves to the end once more.
    skipped = applySkip(skipped, "a");
    expect(ids(triageStack(tasks, skipped, NOW))).toEqual(["b", "a"]);
  });
});
