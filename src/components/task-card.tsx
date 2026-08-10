// Board task card: draggable, with inline title editing, due-date picker,
// and area tag editing.

import { useState, useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { type Task, type TaskStatus } from "../domain/task-rules";
import { type Settings } from "../stores/hooks";
import { Icon } from "./kit/icon";
import { TagSelect } from "./kit/tag-select";
import { LinkPills } from "./kit/link-pills";
import { MoveActionButton } from "./kit/move-action-button";
import { DatePickerModal } from "./kit/date-picker";
import {
  AREA_COLORS,
  AREA_LABELS,
  AREA_OPTIONS,
  dueUrgencyClass,
  formatDueDate,
  formatDueDateFull,
} from "../lib/presentation";

/** Everything a task card can do. TodoBase builds this from its
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
  moveMode,
  isDragOverlay,
}: {
  task: Task;
  actions: TaskActions;
  settings: Settings;
  moveMode?: boolean;
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
          {!moveMode && (
            <div
              className="card-links"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <LinkPills
                links={task.links ?? []}
                onChange={(links) => actions.update(task.id, { links })}
                canAdd={!task.done}
              />
            </div>
          )}
          {!moveMode && settings.showArea && task.area && (
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
          {moveMode && task.status === "this-week" && (
            <>
              <MoveActionButton
                variant="move-right"
                icon="chevron_right"
                title="Move to This Month"
                onClick={() => actions.changeStatus(task.id, "this-month")}
              />
              <MoveActionButton
                variant="archive"
                icon="archive"
                title="File away to Future"
                onClick={() => actions.changeStatus(task.id, "future")}
              />
            </>
          )}
          {moveMode && task.status === "this-month" && (
            <>
              <MoveActionButton
                variant="move-left"
                icon="chevron_left"
                title="Move to This Week"
                onClick={() => actions.changeStatus(task.id, "this-week")}
              />
              <MoveActionButton
                variant="archive"
                icon="archive"
                title="File away to Future"
                onClick={() => actions.changeStatus(task.id, "future")}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
