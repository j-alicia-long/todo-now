// Board task card: draggable, with inline title editing, due-date picker,
// and area tag editing.

import { useState, useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { type Task, type TaskStatus } from "../domain/task-rules";
import { type Settings } from "../stores/hooks";
import { Icon, TagSelect } from "./ui";
import { DatePickerModal } from "./DatePicker";
import {
  AREA_COLORS,
  AREA_LABELS,
  AREA_OPTIONS,
  dueUrgencyClass,
  formatDueDate,
  formatDueDateFull,
} from "../lib/presentation";

/** Everything a task card can do. TodoPage builds this from its
 *  coordinated wrappers (e.g. changeStatus also ticks source list items). */
export type TaskActions = {
  changeStatus: (id: string, status: TaskStatus) => void;
  update: (id: string, fields: Partial<Task>) => void;
  trash: (id: string) => void;
};

export const TaskCard = ({
  task,
  actions,
  settings,
  isDragOverlay,
}: {
  task: Task;
  actions: TaskActions;
  settings: Settings;
  isDragOverlay?: boolean;
}) => {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { task } });

  useEffect(() => {
    if (isEditingTitle && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditingTitle]);

  const commitTitleEdit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      actions.update(task.id, { title: trimmed });
    } else {
      setEditTitle(task.title);
    }
    setIsEditingTitle(false);
  };

  const style: React.CSSProperties = {};
  if (isDragOverlay) {
    style.cursor = "grabbing";
    style.boxShadow = "var(--shadow-lg)";
    style.transform = "rotate(2deg) scale(1.02)";
  } else if (transform) {
    style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0)`;
  }
  if (isDragging && !isDragOverlay) {
    style.opacity = 0.3;
  }

  const ref = isDragOverlay ? undefined : setNodeRef;
  const dragProps = isDragOverlay ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={ref}
      className={`task-card ${isDragging && !isDragOverlay ? "dragging" : ""} ${task.source && task.source !== "board" ? `source-${task.source}` : ""}`}
      style={style}
      {...dragProps}
    >
      <button
        className="card-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          actions.trash(task.id);
        }}
        title="Delete"
        aria-label="Delete task"
      >
        <Icon name="close" />
      </button>
      <div className="card-header">
        <label className="card-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={task.done}
            onChange={(e) => {
              e.stopPropagation();
              if (!task.done) {
                actions.changeStatus(task.id, "done");
              } else {
                actions.changeStatus(task.id, "this-week");
              }
            }}
          />
          <span className="checkmark" />
        </label>
        {isEditingTitle ? (
          <input
            ref={editInputRef}
            className="card-title-edit"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={commitTitleEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitleEdit();
              }
              if (e.key === "Escape") {
                setEditTitle(task.title);
                setIsEditingTitle(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`card-title ${task.done ? "done" : ""}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditTitle(task.title);
              setIsEditingTitle(true);
            }}
          >
            {task.title}
          </span>
        )}
      </div>

      <div className="card-row">
        <div className="card-tags">
          {task.done && task.dueDate && (
            <span className="card-due-subtext">
              {formatDueDateFull(task.dueDate)}
            </span>
          )}
          {!task.done && task.dueDate && (
            <span
              className={`card-tag ${dueUrgencyClass(task.dueDate)} tappable`}
              onClick={(e) => {
                e.stopPropagation();
                setEditingTag(editingTag === "dueDate" ? null : "dueDate");
              }}
            >
              {formatDueDate(task.dueDate)}
            </span>
          )}
          {!task.done && !task.dueDate && (
            <span
              className="card-tag due-none tappable"
              onClick={(e) => {
                e.stopPropagation();
                setEditingTag(editingTag === "dueDate" ? null : "dueDate");
              }}
            >
              + date
            </span>
          )}
          {editingTag === "dueDate" && (
            <DatePickerModal
              value={task.dueDate}
              onChange={(d) => actions.update(task.id, { dueDate: d })}
              onClose={() => setEditingTag(null)}
            />
          )}
          {settings.showArea && task.area && (
            <span className="tag-anchor">
              <span
                className={`card-tag area ${AREA_COLORS[task.area] || ""} tappable`}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTag(editingTag === "area" ? null : "area");
                }}
              >
                {AREA_LABELS[task.area] || task.area}
              </span>
              {editingTag === "area" && (
                <TagSelect
                  value={task.area}
                  options={AREA_OPTIONS.map(([k]) => k)}
                  labels={AREA_LABELS}
                  onChange={(v) => actions.update(task.id, { area: v })}
                  onClose={() => setEditingTag(null)}
                  className="area-select"
                />
              )}
            </span>
          )}
        </div>
        <div className="card-actions">
          {task.status === "this-week" && (
            <>
              <button
                className="card-action-btn move-right"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.changeStatus(task.id, "this-month");
                }}
                title="Move to This Month"
              >
                <Icon name="chevron_right" />
              </button>
              <button
                className="card-action-btn archive"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.changeStatus(task.id, "future");
                }}
                title="File away to Future"
              >
                <Icon name="archive" />
              </button>
            </>
          )}
          {task.status === "this-month" && (
            <>
              <button
                className="card-action-btn move-left"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.changeStatus(task.id, "this-week");
                }}
                title="Move to This Week"
              >
                <Icon name="chevron_left" />
              </button>
              <button
                className="card-action-btn archive"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.changeStatus(task.id, "future");
                }}
                title="File away to Future"
              >
                <Icon name="archive" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
