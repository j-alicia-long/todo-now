import { describe, expect, test } from "bun:test";
import {
  applyRecurringCompletion,
  boardWeeklyItems,
  deriveFirstDueDate,
  getWeekStart,
  isWeeklyRecurring,
  resetWeeklyItems,
  toLocalDateKey,
  upcomingLongTermItems,
  type RecurringItem,
} from "./recurrence";

const makeItem = (overrides: Partial<RecurringItem> = {}): RecurringItem => ({
  id: "r1",
  title: "Recurring",
  frequency: "weekly",
  dayOfWeek: null,
  repeatEvery: 1,
  repeatUnit: "week",
  repeatDays: [],
  endsType: "never",
  endsOn: null,
  endsAfter: null,
  note: "",
  link: "",
  completedThisWeek: false,
  lastCompletedAt: null,
  dueDate: null,
  area: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  category: "task",
  ...overrides,
});

// 2026-07-22 is a Wednesday
const wednesday = new Date(2026, 6, 22, 12, 0, 0);

describe("getWeekStart", () => {
  const cases: Array<{ name: string; now: Date; expected: Date }> = [
    {
      name: "Wednesday maps to its Monday",
      now: wednesday,
      expected: new Date(2026, 6, 20),
    },
    {
      name: "Monday maps to itself (midnight)",
      now: new Date(2026, 6, 20, 23, 59, 59),
      expected: new Date(2026, 6, 20),
    },
    {
      name: "Sunday belongs to the previous Monday",
      now: new Date(2026, 6, 26, 8, 0, 0),
      expected: new Date(2026, 6, 20),
    },
  ];
  for (const c of cases) {
    test(c.name, () => {
      expect(getWeekStart(c.now)).toBe(c.expected.getTime());
    });
  }
});

describe("isWeeklyRecurring", () => {
  test("every-1-week task is weekly", () => {
    expect(isWeeklyRecurring(makeItem())).toBe(true);
  });
  test("every-2-weeks is not weekly", () => {
    expect(isWeeklyRecurring(makeItem({ repeatEvery: 2 }))).toBe(false);
  });
  test("monthly is not weekly", () => {
    expect(isWeeklyRecurring(makeItem({ repeatUnit: "month" }))).toBe(false);
  });
  test("long-term frequency is never weekly", () => {
    expect(isWeeklyRecurring(makeItem({ frequency: "long-term" }))).toBe(false);
  });
});

describe("resetWeeklyItems", () => {
  test("clears completedThisWeek when completion predates this Monday", () => {
    const items = [
      makeItem({
        completedThisWeek: true,
        lastCompletedAt: "2026-07-17T10:00:00.000Z", // previous week (Friday)
      }),
    ];
    const result = resetWeeklyItems(items, wednesday);
    expect(result[0].completedThisWeek).toBe(false);
    expect(result[0].lastCompletedAt).toBe("2026-07-17T10:00:00.000Z");
  });

  test("keeps completedThisWeek when completed this week", () => {
    const items = [
      makeItem({
        completedThisWeek: true,
        lastCompletedAt: "2026-07-21T10:00:00.000Z", // Tuesday this week
      }),
    ];
    const result = resetWeeklyItems(items, wednesday);
    expect(result).toBe(items); // same instance — nothing to persist
    expect(result[0].completedThisWeek).toBe(true);
  });

  test("missing lastCompletedAt counts as stale", () => {
    const items = [makeItem({ completedThisWeek: true })];
    const result = resetWeeklyItems(items, wednesday);
    expect(result[0].completedThisWeek).toBe(false);
  });

  test("long-term items are untouched", () => {
    const items = [
      makeItem({
        frequency: "long-term",
        completedThisWeek: true,
        lastCompletedAt: "2020-01-01T00:00:00.000Z",
      }),
    ];
    expect(resetWeeklyItems(items, wednesday)).toBe(items);
  });

  test("returns same array instance when nothing changed", () => {
    const items = [makeItem(), makeItem({ id: "r2" })];
    expect(resetWeeklyItems(items, wednesday)).toBe(items);
  });
});

describe("applyRecurringCompletion", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");

  test("completedThisWeek: true stamps lastCompletedAt", () => {
    const next = applyRecurringCompletion(
      makeItem(),
      { completedThisWeek: true },
      now
    );
    expect(next.completedThisWeek).toBe(true);
    expect(next.lastCompletedAt).toBe(now.toISOString());
  });

  test("completedThisWeek: true on an already-completed item is a no-op", () => {
    const item = makeItem({
      completedThisWeek: true,
      lastCompletedAt: "2026-07-20T00:00:00.000Z",
    });
    const next = applyRecurringCompletion(
      item,
      { completedThisWeek: true },
      now
    );
    expect(next).toBe(item);
  });

  test("completedThisWeek: false clears the flag but keeps lastCompletedAt", () => {
    const item = makeItem({
      completedThisWeek: true,
      lastCompletedAt: "2026-07-20T00:00:00.000Z",
    });
    const next = applyRecurringCompletion(
      item,
      { completedThisWeek: false },
      now
    );
    expect(next.completedThisWeek).toBe(false);
    expect(next.lastCompletedAt).toBe("2026-07-20T00:00:00.000Z");
  });

  test("done: true on a weekly item stamps and sets completedThisWeek", () => {
    const next = applyRecurringCompletion(makeItem(), { done: true }, now);
    expect(next.completedThisWeek).toBe(true);
    expect(next.lastCompletedAt).toBe(now.toISOString());
  });

  test("done: true on a long-term item stamps without touching completedThisWeek", () => {
    const next = applyRecurringCompletion(
      makeItem({ frequency: "long-term", repeatUnit: "month" }),
      { done: true },
      now
    );
    expect(next.completedThisWeek).toBe(false);
    expect(next.lastCompletedAt).toBe(now.toISOString());
  });

  test("empty change returns the same instance", () => {
    const item = makeItem();
    expect(applyRecurringCompletion(item, {}, now)).toBe(item);
  });
});

describe("deriveFirstDueDate", () => {
  // wednesday = 2026-07-22, getDay() === 3
  const cases: Array<{ name: string; day: number; expected: string }> = [
    {
      name: "Friday target → Friday - 2d = Wednesday... pushed a week (not strictly future)",
      day: 5, // Friday 07-24 → -2d = 07-22 (today, not > now) → +7 = 07-29
      expected: "2026-07-29",
    },
    {
      name: "Saturday target → Thursday buffer",
      day: 6, // Saturday 07-25 → -2d = 07-23
      expected: "2026-07-23",
    },
    {
      name: "same weekday skips to next week",
      day: 3, // Wednesday → next Wednesday 07-29 → -2d = 07-27
      expected: "2026-07-27",
    },
    {
      name: "Monday target wraps the weekend",
      day: 1, // Monday 07-27 → -2d = 07-25
      expected: "2026-07-25",
    },
  ];
  for (const c of cases) {
    test(c.name, () => {
      expect(deriveFirstDueDate(c.day, wednesday)).toBe(c.expected);
    });
  }
});

describe("boardWeeklyItems", () => {
  test("shows items with no repeatDays, today's items, and completed items", () => {
    const everyday = makeItem({ id: "a" });
    const today = makeItem({ id: "b", repeatDays: [3] }); // Wednesday
    const otherDay = makeItem({ id: "c", repeatDays: [5] });
    const otherDayDone = makeItem({
      id: "d",
      repeatDays: [5],
      completedThisWeek: true,
    });
    const result = boardWeeklyItems(
      [everyday, today, otherDay, otherDayDone],
      wednesday
    );
    expect(result.map((i) => i.id)).toEqual(["a", "b", "d"]);
  });
});

describe("upcomingLongTermItems", () => {
  const longTerm = (id: string, dueDate: string | null) =>
    makeItem({ id, frequency: "long-term", repeatUnit: "month", dueDate });

  test("due within 7 days shows; beyond doesn't; drops 24h after due", () => {
    const items = [
      longTerm("soon", "2026-07-25"),
      longTerm("far", "2026-08-15"),
      longTerm("just-passed", "2026-07-22"),
      longTerm("long-passed", "2026-07-19"),
      longTerm("no-date", null),
    ];
    const result = upcomingLongTermItems(items, wednesday);
    expect(result.map((i) => i.id)).toEqual(["soon", "just-passed"]);
  });
});

describe("toLocalDateKey", () => {
  test("formats local date with zero padding", () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
