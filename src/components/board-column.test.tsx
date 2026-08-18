// The Done column groups completed tasks by day. Those day groups are drop
// targets for re-dating a completion, which means every day in the window
// has to exist while a card is in flight — but only then.

import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { DEFAULT_SETTINGS } from "@/stores/hooks";
import { toLocalDateKey } from "@/domain/recurrence";
import { DONE_VISIBLE_MS, type Task } from "@/domain/task-rules";
import { BoardColumn } from "./board-column";

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Test task",
  done: true,
  status: "done",
  effort: "medium",
  decisionLoad: "medium",
  area: "life-admin",
  dueDate: null,
  importance: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: daysAgo(0),
  deletedAt: null,
  source: "board",
  sourceItemId: null,
  ...overrides,
});

const taskActions = {
  changeStatus: () => {},
  update: () => {},
  trash: () => {},
};

const renderDone = (tasks: Task[], showAllDoneDays = false) =>
  render(
    <DndContext>
      <BoardColumn
        id="done"
        title="Done"
        icon="check_circle"
        colorClass="col-green"
        tasks={tasks}
        taskActions={taskActions}
        settings={DEFAULT_SETTINGS}
        showAllDoneDays={showAllDoneDays}
      />
    </DndContext>
  );

const WINDOW_DAYS = Math.floor(DONE_VISIBLE_MS / (24 * 60 * 60 * 1000)) + 1;

describe("Done column day groups", () => {
  test("at rest, only days with completions are rendered", () => {
    const { container } = renderDone([
      makeTask({ id: "a", completedAt: daysAgo(0) }),
      makeTask({ id: "b", completedAt: daysAgo(2) }),
    ]);
    expect(container.querySelectorAll(".done-group").length).toBe(2);
    expect(container.querySelectorAll(".done-group-slot").length).toBe(0);
  });

  test("mid-drag, every day in the visible window becomes a target", () => {
    const { container } = renderDone(
      [
        makeTask({ id: "a", completedAt: daysAgo(0) }),
        makeTask({ id: "b", completedAt: daysAgo(2) }),
      ],
      true
    );
    expect(container.querySelectorAll(".done-group").length).toBe(WINDOW_DAYS);
    // The two occupied days aren't slots, so the rest are.
    expect(container.querySelectorAll(".done-group-slot").length).toBe(
      WINDOW_DAYS - 2
    );
  });

  test("an empty Done column still offers day targets mid-drag", () => {
    const { container } = renderDone([], true);
    expect(container.querySelectorAll(".done-group").length).toBe(WINDOW_DAYS);
    expect(container.querySelector(".column-empty")).toBeNull();
  });

  test("an empty Done column reads as empty at rest", () => {
    const { container } = renderDone([]);
    expect(container.querySelectorAll(".done-group").length).toBe(0);
    expect(container.querySelector(".column-empty")).not.toBeNull();
  });

  test("today's group keeps its label rather than being replaced by a slot", () => {
    const { container } = renderDone(
      [makeTask({ completedAt: daysAgo(0) })],
      true
    );
    const labels = Array.from(
      container.querySelectorAll(".done-group-label")
    ).map((el) => el.textContent);
    expect(labels[0]).toBe("Today");
    // Newest first, so today's group leads and carries the card.
    const first = container.querySelector(".done-group");
    expect(first?.classList.contains("done-group-slot")).toBe(false);
  });

  test("day groups are keyed to local date keys, not UTC", () => {
    const completedAt = daysAgo(1);
    const { container } = renderDone([makeTask({ completedAt })], true);
    const occupied = Array.from(
      container.querySelectorAll(".done-group")
    ).filter((el) => !el.classList.contains("done-group-slot"));
    expect(occupied.length).toBe(1);
    const expectedLabel = new Date(
      toLocalDateKey(new Date(completedAt)) + "T12:00:00"
    ).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    expect(occupied[0].querySelector(".done-group-label")?.textContent).toBe(
      expectedLabel
    );
  });
});
