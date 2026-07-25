// Behavioral tests for the Matrix rules: given Tasks and a clock, which
// Quadrant; given a drop, which field changes. No internal structure is
// asserted. `now` is always injected.

import { describe, test, expect } from "bun:test";
import type { Task } from "./task-rules";
import {
  isUrgent,
  quadrantOf,
  partitionMatrix,
  applyMatrixDrop,
} from "./matrix-rules";

// A fixed local-noon clock; due dates are local YYYY-MM-DD keys.
const NOW = new Date("2026-07-22T12:00:00");

const dueIn = (days: number): string => {
  const d = new Date(2026, 6, 22 + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

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

describe("isUrgent", () => {
  test("no due date is never urgent", () => {
    expect(isUrgent(makeTask({ dueDate: null }), NOW)).toBe(false);
  });

  test("overdue is urgent", () => {
    expect(isUrgent(makeTask({ dueDate: dueIn(-1) }), NOW)).toBe(true);
    expect(isUrgent(makeTask({ dueDate: dueIn(-30) }), NOW)).toBe(true);
  });

  test("due today and tomorrow are urgent", () => {
    expect(isUrgent(makeTask({ dueDate: dueIn(0) }), NOW)).toBe(true);
    expect(isUrgent(makeTask({ dueDate: dueIn(1) }), NOW)).toBe(true);
  });

  test("due in exactly 2 days is urgent; 3 days is not", () => {
    expect(isUrgent(makeTask({ dueDate: dueIn(2) }), NOW)).toBe(true);
    expect(isUrgent(makeTask({ dueDate: dueIn(3) }), NOW)).toBe(false);
  });
});

describe("quadrantOf", () => {
  test("urgent + important → do", () => {
    const t = makeTask({ importance: "important", dueDate: dueIn(1) });
    expect(quadrantOf(t, NOW)).toBe("do");
  });

  test("important only → schedule", () => {
    const t = makeTask({ importance: "important", dueDate: dueIn(10) });
    expect(quadrantOf(t, NOW)).toBe("schedule");
    expect(
      quadrantOf(makeTask({ importance: "important", dueDate: null }), NOW)
    ).toBe("schedule");
  });

  test("urgent only → quick-hit", () => {
    const t = makeTask({ importance: "not-important", dueDate: dueIn(0) });
    expect(quadrantOf(t, NOW)).toBe("quick-hit");
  });

  test("neither → reconsider", () => {
    const t = makeTask({ importance: "not-important", dueDate: null });
    expect(quadrantOf(t, NOW)).toBe("reconsider");
  });

  test("unjudged importance → no Quadrant (Unsorted)", () => {
    expect(quadrantOf(makeTask({ importance: null }), NOW)).toBeNull();
  });
});

describe("partitionMatrix", () => {
  test("scopes to This Week and This Month only", () => {
    const layout = partitionMatrix(
      [
        makeTask({ id: "w", status: "this-week", importance: "important" }),
        makeTask({ id: "m", status: "this-month", importance: "important" }),
        makeTask({ id: "f", status: "future", importance: "important" }),
        makeTask({ id: "d", status: "done", importance: "important" }),
        makeTask({ id: "x", status: "trashed", importance: "important" }),
      ],
      NOW
    );
    const shown = [
      ...Object.values(layout.quadrants).flat(),
      ...layout.unsorted,
    ].map((t) => t.id);
    expect(shown.sort()).toEqual(["m", "w"]);
  });

  test("splits sorted Tasks into Quadrants and unjudged into Unsorted", () => {
    const layout = partitionMatrix(
      [
        makeTask({ id: "a", importance: "important", dueDate: dueIn(1) }),
        makeTask({ id: "b", importance: "important", dueDate: dueIn(9) }),
        makeTask({ id: "c", importance: "not-important", dueDate: dueIn(1) }),
        makeTask({ id: "d", importance: "not-important" }),
        makeTask({ id: "e", importance: null }),
      ],
      NOW
    );
    expect(layout.quadrants.do.map((t) => t.id)).toEqual(["a"]);
    expect(layout.quadrants.schedule.map((t) => t.id)).toEqual(["b"]);
    expect(layout.quadrants["quick-hit"].map((t) => t.id)).toEqual(["c"]);
    expect(layout.quadrants.reconsider.map((t) => t.id)).toEqual(["d"]);
    expect(layout.unsorted.map((t) => t.id)).toEqual(["e"]);
  });
});

describe("applyMatrixDrop", () => {
  test("dropping an Unsorted Task into a Quadrant sets importance", () => {
    const t = makeTask({ importance: null, dueDate: dueIn(10) });
    expect(applyMatrixDrop(t, "schedule", NOW)).toEqual({
      importance: "important",
    });
    expect(applyMatrixDrop(t, "reconsider", NOW)).toEqual({
      importance: "not-important",
    });
  });

  test("horizontal drag flips importance without touching the date", () => {
    const urgent = makeTask({ importance: "important", dueDate: dueIn(1) });
    expect(applyMatrixDrop(urgent, "quick-hit", NOW)).toEqual({
      importance: "not-important",
    });
    const calm = makeTask({ importance: "not-important", dueDate: dueIn(9) });
    expect(applyMatrixDrop(calm, "schedule", NOW)).toEqual({
      importance: "important",
    });
  });

  test("dropping into an urgent Quadrant sets dueDate to today+2", () => {
    const t = makeTask({ importance: "important", dueDate: dueIn(10) });
    expect(applyMatrixDrop(t, "do", NOW)).toEqual({
      importance: "important",
      dueDate: dueIn(2),
    });
    const undated = makeTask({ importance: null, dueDate: null });
    expect(applyMatrixDrop(undated, "quick-hit", NOW)).toEqual({
      importance: "not-important",
      dueDate: dueIn(2),
    });
  });

  test("dropping out of an urgent Quadrant pushes dueDate to today+7", () => {
    const t = makeTask({ importance: "not-important", dueDate: dueIn(0) });
    expect(applyMatrixDrop(t, "reconsider", NOW)).toEqual({
      importance: "not-important",
      dueDate: dueIn(7),
    });
    expect(applyMatrixDrop(t, "schedule", NOW)).toEqual({
      importance: "important",
      dueDate: dueIn(7),
    });
  });

  test("dropping on the current Quadrant is a no-op", () => {
    const t = makeTask({ importance: "important", dueDate: dueIn(1) });
    expect(applyMatrixDrop(t, "do", NOW)).toBeNull();
    const calm = makeTask({ importance: "not-important", dueDate: null });
    expect(applyMatrixDrop(calm, "reconsider", NOW)).toBeNull();
  });
});
