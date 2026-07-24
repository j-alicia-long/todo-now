// Card variant for the Future drawer: not draggable, activate-to-This-Week.

import { useState, useEffect, useRef } from "react";
import { type Task } from "../domain/task-rules";
import { type Settings } from "../stores/hooks";
import { Icon, TagSelect } from "./ui";
import { DatePickerModal } from "./date-picker";
import { type TaskActions } from "./task-card";
import {
  AREA_COLORS,
  AREA_LABELS,
  AREA_OPTIONS,
  dueUrgencyClass,
  formatDueDate,
} from "../lib/presentation";

export const FutureTaskCard = ({
  task,
  actions,
  settings,
}: {
  task: Task;
  actions: TaskActions;
  settings: Settings;
}) => {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="task-card future-card">
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
            checked={false}
            onChange={(e) => {
              e.stopPropagation();
              actions.changeStatus(task.id, "done");
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
            className="card-title"
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

      <div className="card-tags">
        {task.dueDate && (
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
        {!task.dueDate && (
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
              />
            )}
          </span>
        )}
      </div>

      <div className="card-actions">
        <button
          className="card-action-btn activate"
          onClick={(e) => {
            e.stopPropagation();
            actions.changeStatus(task.id, "this-week");
          }}
          title="Move to This Week"
        >
          <Icon name="play_arrow" /> This Week
        </button>
      </div>
    </div>
  );
};
