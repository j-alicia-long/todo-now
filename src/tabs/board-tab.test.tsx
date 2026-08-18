// Board visibility of recurring cards is gated by the hideRecurringOnBoard
// setting. Recurring generation and the Recurring tab are out of scope here.

import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { DEFAULT_SETTINGS, type Settings } from "@/stores/hooks";
import { toLocalDateKey, type RecurringItem } from "@/domain/recurrence";
import { BoardTab, preferDayGroup } from "./board-tab";

const daysFromNow = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toLocalDateKey(d);
};

const makeRecurring = (
  overrides: Partial<RecurringItem> = {}
): RecurringItem => ({
  id: "r1",
  title: "Water plants",
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

const taskActions = {
  changeStatus: () => {},
  update: () => {},
  trash: () => {},
};

const recurringActions = {
  toggle: () => {},
  remove: () => {},
  update: () => {},
};

const renderBoard = (settings: Settings, items: RecurringItem[]) =>
  render(
    <BoardTab
      tasks={[]}
      taskActions={taskActions}
      recurringItems={items}
      recurringActions={recurringActions}
      settings={settings}
    />
  );

describe("BoardTab recurring visibility", () => {
  test("shows recurring cards on the board by default", () => {
    const { container } = renderBoard(DEFAULT_SETTINGS, [makeRecurring()]);
    expect(container.querySelectorAll(".recurring-task-card").length).toBe(1);
  });

  test("hides recurring cards when hideRecurringOnBoard is on", () => {
    const { container } = renderBoard(
      { ...DEFAULT_SETTINGS, hideRecurringOnBoard: true },
      [makeRecurring()]
    );
    expect(container.querySelectorAll(".recurring-task-card").length).toBe(0);
  });

  test("hides completed recurring cards in the Done column too", () => {
    const done = makeRecurring({
      completedThisWeek: true,
      lastCompletedAt: new Date().toISOString(),
    });
    const shown = renderBoard(DEFAULT_SETTINGS, [done]);
    expect(
      shown.container.querySelectorAll(".recurring-task-card").length
    ).toBe(1);
    shown.unmount();

    const hidden = renderBoard(
      { ...DEFAULT_SETTINGS, hideRecurringOnBoard: true },
      [done]
    );
    expect(
      hidden.container.querySelectorAll(".recurring-task-card").length
    ).toBe(0);
  });

  test("Move mode adds a move button to a dated recurring card, not a weekly one", () => {
    const weekly = makeRecurring({ id: "weekly", dueDate: null });
    const dated = makeRecurring({
      id: "later",
      frequency: "long-term",
      repeatUnit: "month",
      dueDate: daysFromNow(10),
    });
    const { container } = renderBoard(DEFAULT_SETTINGS, [weekly, dated]);

    // No move buttons until Move mode is on.
    expect(container.querySelectorAll(".card-action-btn").length).toBe(0);
    fireEvent.click(container.querySelector(".move-mode-btn")!);

    // Only the dated card (This Month) gets a move button; the weekly
    // no-due card in This Week stays button-less.
    const weekCol = container.querySelector(
      ".board-column:nth-of-type(1) .column-cards"
    );
    const monthCol = container.querySelector(
      ".board-column:nth-of-type(2) .column-cards"
    );
    expect(weekCol?.querySelectorAll(".card-action-btn").length).toBe(0);
    expect(monthCol?.querySelectorAll(".card-action-btn").length).toBe(1);
  });

  test("routes recurring cards to This Week / This Month by due date", () => {
    const thisWeek = makeRecurring({ id: "weekly", dueDate: null });
    const thisMonth = makeRecurring({
      id: "later",
      frequency: "long-term",
      repeatUnit: "month",
      dueDate: daysFromNow(10),
    });
    const { container } = renderBoard(DEFAULT_SETTINGS, [thisWeek, thisMonth]);
    const weekCol = container.querySelector(
      ".board-column:nth-of-type(1) .column-cards"
    );
    const monthCol = container.querySelector(
      ".board-column:nth-of-type(2) .column-cards"
    );
    expect(weekCol?.querySelectorAll(".recurring-task-card").length).toBe(1);
    expect(monthCol?.querySelectorAll(".recurring-task-card").length).toBe(1);
  });
});

describe("preferDayGroup — nested droppables in the Done column", () => {
  test("a day group beats the column that contains it", () => {
    const result = preferDayGroup([
      { id: "done" },
      { id: "done-date:2026-08-16" },
    ]);
    expect(result).toEqual([{ id: "done-date:2026-08-16" }]);
  });

  test("order doesn't matter — the day group still wins", () => {
    const result = preferDayGroup([
      { id: "done-date:2026-08-16" },
      { id: "done" },
    ]);
    expect(result).toEqual([{ id: "done-date:2026-08-16" }]);
  });

  test("column drops are left alone", () => {
    const collisions = [{ id: "this-week" }, { id: "this-month" }];
    expect(preferDayGroup(collisions)).toEqual(collisions);
  });

  test("matrix quadrant drops are left alone", () => {
    const collisions = [{ id: "important-urgent" }];
    expect(preferDayGroup(collisions)).toEqual(collisions);
  });

  test("no collisions stays empty", () => {
    expect(preferDayGroup([])).toEqual([]);
  });
});
