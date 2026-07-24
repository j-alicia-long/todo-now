// A Board column (This Week / This Month / Done): droppable target that
// renders task cards, recurring cards, and date-grouped done items.

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { type Task, type TaskStatus } from "../domain/task-rules";
import { type RecurringItem } from "../domain/recurrence";
import { type Settings } from "../stores/hooks";
import { Icon } from "./ui";
import { DatePickerModal } from "./DatePicker";
import { TaskCard, type TaskActions } from "./TaskCard";
import {
  dueUrgencyClass,
  formatDueDate,
  formatDueDateFull,
  groupDoneByDate,
  groupRecurringDoneByDate,
  sortTasks,
} from "../lib/presentation";

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
}: {
  item: RecurringItem;
  done: boolean;
  actions: RecurringCardActions;
}) => {
  const [editingDate, setEditingDate] = useState(false);

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
        {done && <div className="card-actions"></div>}
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
  recurring,
}: {
  id: TaskStatus;
  title: string;
  icon: string;
  colorClass: string;
  tasks: Task[];
  taskActions: TaskActions;
  settings: Settings;
  recurring?: { items: RecurringItem[]; actions: RecurringCardActions };
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
            />
          ))}
        {displayTasks.length === 0 && recurringItems.length === 0 ? (
          <div className="column-empty">
            {id === "done"
              ? "Nothing completed yet"
              : id === "this-month"
                ? "Drag tasks here or use the arrow"
                : "All clear!"}
          </div>
        ) : doneGroups ? (
          (() => {
            const recurringDoneGroups =
              recurringItems.length > 0
                ? groupRecurringDoneByDate(recurringItems)
                : [];
            const dateKeyMap = new Map<string, string>();
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
              return (
                <div key={label} className="done-group">
                  <div className="done-group-label">{label}</div>
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
                  {taskGroup &&
                    taskGroup.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        actions={taskActions}
                        settings={settings}
                      />
                    ))}
                </div>
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
            />
          ))
        )}
      </div>
    </div>
  );
};
