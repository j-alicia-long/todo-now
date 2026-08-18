// A Board column (This Week / This Month / Done): droppable target that
// renders task cards, recurring cards, and date-grouped done items.

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { type Task, type TaskStatus } from "../domain/task-rules";
import {
  recurringColumnMoveDate,
  type RecurringItem,
} from "../domain/recurrence";
import { type Settings } from "../stores/hooks";
import { Icon } from "./kit/icon";
import { DatePickerModal } from "./kit/date-picker";
import { MoveActionButton } from "./kit/move-action-button";
import { TaskCard, type TaskActions } from "./task-card";
import {
  doneDateSlots,
  dueUrgencyClass,
  formatDueDate,
  formatDueDateFull,
  groupDoneByDate,
  groupRecurringDoneByDate,
  sortTasks,
} from "../lib/presentation";

/** Droppable id prefix for a day group inside the Done column. */
export const DONE_DATE_DROP_PREFIX = "done-date:";

// A day group in the Done column. Its own droppable, so dropping a card on
// it re-dates the completion rather than just landing in the column.
const DoneGroup = ({
  dateKey,
  label,
  empty,
  children,
}: {
  dateKey: string;
  label: string;
  empty?: boolean;
  children?: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `${DONE_DATE_DROP_PREFIX}${dateKey}`,
  });
  return (
    <div
      className={`done-group ${empty ? "done-group-slot" : ""} ${isOver ? "done-group-over" : ""}`}
      ref={setNodeRef}
    >
      <div className="done-group-label">{label}</div>
      {children}
    </div>
  );
};

/** The subset of recurring actions a board card needs (no edit-modal). */
export type RecurringCardActions = {
  toggle: (id: string) => void;
  remove: (id: string) => void;
  update: (id: string, fields: Partial<RecurringItem>) => void;
};

const RecurringBoardCard = ({
  item,
  done,
  actions,
  moveMode,
  column,
}: {
  item: RecurringItem;
  done: boolean;
  actions: RecurringCardActions;
  moveMode?: boolean;
  column?: "this-week" | "this-month";
}) => {
  const [editingDate, setEditingDate] = useState(false);

  // A recurring card's column is derived from its due date, so Move mode
  // relocates it by rescheduling (same lever as tapping the due tag). Only
  // dated items can move — weekly-cadence cards have no due date to shift.
  const canMove = !done && moveMode && item.dueDate;
  const moveTo = (target: "this-week" | "this-month") =>
    actions.update(item.id, {
      dueDate: recurringColumnMoveDate(target, new Date()),
    });

  return (
    <div className="task-card recurring-task-card">
      <button
        className="card-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          actions.remove(item.id);
        }}
        title="Delete"
        aria-label="Delete recurring task"
      >
        <Icon name="close" />
      </button>
      <div className="card-header">
        <label className="card-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={done ? true : item.completedThisWeek}
            onChange={(e) => {
              e.stopPropagation();
              actions.toggle(item.id);
            }}
          />
          <span className="checkmark" />
        </label>
        <span className={`card-title ${done ? "done" : ""}`}>{item.title}</span>
      </div>
      <div className="card-row">
        <div className="card-tags">
          {done ? (
            item.dueDate && (
              <span className="card-due-subtext">
                {formatDueDateFull(item.dueDate)}
              </span>
            )
          ) : (
            <>
              {item.dueDate && (
                <span
                  className={`card-tag ${dueUrgencyClass(item.dueDate)} tappable`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDate(!editingDate);
                  }}
                >
                  {formatDueDate(item.dueDate)}
                </span>
              )}
              {!item.dueDate && (
                <span
                  className="card-tag due-none tappable"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDate(!editingDate);
                  }}
                >
                  + date
                </span>
              )}
              {editingDate && (
                <DatePickerModal
                  value={item.dueDate}
                  onChange={(d) => actions.update(item.id, { dueDate: d })}
                  onClose={() => setEditingDate(false)}
                />
              )}
            </>
          )}
        </div>
        <div className="card-actions">
          {canMove && column === "this-week" && (
            <MoveActionButton
              variant="move-right"
              icon="chevron_right"
              title="Move to This Month"
              onClick={() => moveTo("this-month")}
            />
          )}
          {canMove && column === "this-month" && (
            <MoveActionButton
              variant="move-left"
              icon="chevron_left"
              title="Move to This Week"
              onClick={() => moveTo("this-week")}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const BoardColumn = ({
  id,
  title,
  icon,
  colorClass,
  tasks,
  taskActions,
  settings,
  moveMode,
  recurring,
  showAllDoneDays,
}: {
  id: TaskStatus;
  title: string;
  icon: string;
  colorClass: string;
  tasks: Task[];
  taskActions: TaskActions;
  settings: Settings;
  moveMode?: boolean;
  recurring?: { items: RecurringItem[]; actions: RecurringCardActions };
  /** A card is mid-drag: the Done column opens up every day in its window
   * as a drop target, not just the days that already have completions. */
  showAllDoneDays?: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  const displayTasks = tasks;
  const recurringItems = recurring?.items ?? [];

  const doneGroups = id === "done" ? groupDoneByDate(displayTasks) : null;

  return (
    <div
      className={`board-column ${isOver ? "drag-over" : ""}`}
      ref={setNodeRef}
    >
      <div className={`column-header ${colorClass}`}>
        <Icon name={icon} className="column-icon" />
        <h2 className="column-title">{title}</h2>
        <span className="column-count">{displayTasks.length}</span>
      </div>
      <div className="column-cards">
        {recurring &&
          recurringItems.length > 0 &&
          id !== "done" &&
          recurringItems.map((ri) => (
            <RecurringBoardCard
              key={ri.id}
              item={ri}
              done={false}
              actions={recurring.actions}
              moveMode={moveMode}
              column={id as "this-week" | "this-month"}
            />
          ))}
        {displayTasks.length === 0 &&
        recurringItems.length === 0 &&
        !(doneGroups && showAllDoneDays) ? (
          <div className="column-empty">
            {id === "done"
              ? "Nothing completed yet"
              : id === "this-month"
                ? "Drag tasks here"
                : "All clear!"}
          </div>
        ) : doneGroups ? (
          (() => {
            const recurringDoneGroups =
              recurringItems.length > 0
                ? groupRecurringDoneByDate(recurringItems)
                : [];
            const dateKeyMap = new Map<string, string>();
            // Empty day slots go in first so a day that does have cards
            // keeps its own (identical) label and ordering is unaffected.
            if (showAllDoneDays) {
              for (const slot of doneDateSlots(new Date()))
                dateKeyMap.set(slot.dateKey, slot.label);
            }
            for (const g of doneGroups) dateKeyMap.set(g.dateKey, g.label);
            for (const g of recurringDoneGroups)
              dateKeyMap.set(g.dateKey, g.label);
            const sortedKeys = [...dateKeyMap.keys()].sort((a, b) => {
              if (a === "unknown") return 1;
              if (b === "unknown") return -1;
              return b.localeCompare(a);
            });
            return sortedKeys.map((key) => {
              const label = dateKeyMap.get(key)!;
              const taskGroup = doneGroups.find((g) => g.dateKey === key);
              const recurringGroup = recurringDoneGroups.find(
                (g) => g.dateKey === key
              );
              const isEmpty =
                !taskGroup?.tasks.length && !recurringGroup?.items.length;
              return (
                <DoneGroup
                  key={label}
                  dateKey={key}
                  label={label}
                  empty={isEmpty}
                >
                  {recurringGroup &&
                    recurring &&
                    recurringGroup.items.map((ri) => (
                      <RecurringBoardCard
                        key={ri.id}
                        item={ri}
                        done={true}
                        actions={recurring.actions}
                      />
                    ))}
                  {taskGroup?.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      actions={taskActions}
                      settings={settings}
                      moveMode={moveMode}
                    />
                  ))}
                </DoneGroup>
              );
            });
          })()
        ) : (
          sortTasks(displayTasks).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              actions={taskActions}
              settings={settings}
              moveMode={moveMode}
            />
          ))
        )}
      </div>
    </div>
  );
};
