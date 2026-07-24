import { describe, expect, test } from "bun:test";
import {
  advanceDueDate,
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
  showEarlyDays: null,
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
      name: "Friday target → this Friday",
      day: 5,
      expected: "2026-07-24",
    },
    {
      name: "Saturday target → this Saturday",
      day: 6,
      expected: "2026-07-25",
    },
    {
      name: "same weekday → due today",
      day: 3,
      expected: "2026-07-22",
    },
    {
      name: "Monday target wraps the weekend",
      day: 1,
      expected: "2026-07-27",
    },
  ];
  for (const c of cases) {
    test(c.name, () => {
      expect(deriveFirstDueDate(c.day, wednesday)).toBe(c.expected);
    });
  }
});

describe("boardWeeklyItems", () => {
  test("default (0 days early): no-repeatDays, today's, and completed items", () => {
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

  test("showEarlyDays pulls upcoming days onto the board", () => {
    // Friday is 2 days after Wednesday
    const twoEarly = makeItem({ id: "a", repeatDays: [5], showEarlyDays: 2 });
    const oneEarly = makeItem({ id: "b", repeatDays: [5], showEarlyDays: 1 });
    const result = boardWeeklyItems([twoEarly, oneEarly], wednesday);
    expect(result.map((i) => i.id)).toEqual(["a"]);
  });
});

describe("upcomingLongTermItems", () => {
  const longTerm = (
    id: string,
    dueDate: string | null,
    showEarlyDays: number | null = null
  ) =>
    makeItem({
      id,
      frequency: "long-term",
      repeatUnit: "month",
      dueDate,
      showEarlyDays,
    });

  test("default window is 14 days; drops 24h after due", () => {
    const items = [
      longTerm("soon", "2026-08-03"),
      longTerm("far", "2026-08-15"),
      longTerm("just-passed", "2026-07-22"),
      longTerm("long-passed", "2026-07-19"),
      longTerm("no-date", null),
    ];
    const result = upcomingLongTermItems(items, wednesday);
    expect(result.map((i) => i.id)).toEqual(["soon", "just-passed"]);
  });

  test("showEarlyDays overrides the window", () => {
    const items = [
      longTerm("wide", "2026-08-15", 30),
      longTerm("narrow", "2026-07-25", 1),
    ];
    const result = upcomingLongTermItems(items, wednesday);
    expect(result.map((i) => i.id)).toEqual(["wide"]);
  });
});

describe("advanceDueDate", () => {
  const longTerm = (overrides: Partial<RecurringItem> = {}) =>
    makeItem({
      frequency: "long-term",
      repeatEvery: 1,
      repeatUnit: "month",
      dueDate: "2026-07-20",
      createdAt: "2026-01-05T00:00:00.000Z",
      ...overrides,
    });

  test("weekly items are returned unchanged", () => {
    const item = makeItem({ dueDate: "2026-07-20" });
    expect(advanceDueDate(item, wednesday)).toBe(item);
  });

  test("items without a dueDate are returned unchanged", () => {
    const item = longTerm({ dueDate: null });
    expect(advanceDueDate(item, wednesday)).toBe(item);
  });

  test("advances one interval past a just-passed due date", () => {
    expect(advanceDueDate(longTerm(), wednesday).dueDate).toBe("2026-08-20");
  });

  test("completing early still advances to the next occurrence", () => {
    const item = longTerm({ dueDate: "2026-07-25" });
    expect(advanceDueDate(item, wednesday).dueDate).toBe("2026-08-25");
  });

  test("catches up across several lapsed occurrences", () => {
    const item = longTerm({ dueDate: "2026-03-10" });
    expect(advanceDueDate(item, wednesday).dueDate).toBe("2026-08-10");
  });

  test("week unit steps by 7 × repeatEvery days", () => {
    const item = longTerm({
      repeatEvery: 2,
      repeatUnit: "week",
      dueDate: "2026-07-20",
    });
    expect(advanceDueDate(item, wednesday).dueDate).toBe("2026-08-03");
  });

  test("endsOn: advancing past the cutoff ends the recurrence", () => {
    const item = longTerm({ endsType: "on", endsOn: "2026-08-01" });
    expect(advanceDueDate(item, wednesday).dueDate).toBe(null);
  });

  test("endsOn: cutoff day itself still counts", () => {
    const item = longTerm({ endsType: "on", endsOn: "2026-08-20" });
    expect(advanceDueDate(item, wednesday).dueDate).toBe("2026-08-20");
  });

  test("endsAfter: occurrence past the limit ends the recurrence", () => {
    // Grid anchored at 2026-01-20 (first occurrence after createdAt);
    // next due 2026-08-20 is occurrence #8.
    const item = longTerm({ endsType: "after", endsAfter: 7 });
    expect(advanceDueDate(item, wednesday).dueDate).toBe(null);
  });

  test("endsAfter: occurrence within the limit advances normally", () => {
    const item = longTerm({ endsType: "after", endsAfter: 8 });
    expect(advanceDueDate(item, wednesday).dueDate).toBe("2026-08-20");
  });
});

describe("toLocalDateKey", () => {
  test("formats local date with zero padding", () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
