// Triage modal: deals Unsorted Tasks one at a time over a dimmed
// Matrix. Shows the active Task with full details, the rest of the
// stack peeking behind, and an instruction line. Sorting happens via
// keyboard (1-4), the on-screen Quadrant buttons, or — in later slices
// — drag and swipe. All ordering comes from triage-rules; all sort
// semantics from applyMatrixDrop. This component owns no task state.

import { useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { type Task } from "../domain/task-rules";
import { type Quadrant } from "../domain/matrix-rules";
import { QUADRANTS } from "./matrix-view";
import { Icon } from "./ui";
import {
  AREA_COLORS,
  AREA_LABELS,
  dueUrgencyClass,
  formatDueDateFull,
} from "../lib/presentation";

/** Number-key order mirrors the grid: 1 Do, 2 Schedule, 3 Quick-hit, 4 Reconsider. */
const KEY_TO_QUADRANT: Record<string, Quadrant> = {
  "1": "do",
  "2": "schedule",
  "3": "quick-hit",
  "4": "reconsider",
};

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable);

export const TriageModal = ({
  stack,
  isTouch,
  onSort,
  onSkip,
  onClose,
}: {
  /** Triage stack, active Task first. Never empty while mounted. */
  stack: Task[];
  isTouch: boolean;
  onSort: (taskId: string, quadrant: Quadrant) => void;
  onSkip: (taskId: string) => void;
  onClose: () => void;
}) => {
  const active = stack[0];
  const remaining = stack.length - 1;

  // The active card is a normal draggable in the Board tab's DndContext;
  // the Quadrants beneath the backdrop are the existing drop targets.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: active.id,
    data: { task: active },
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (isDragging) return; // let dnd-kit own Escape mid-drag
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      const quadrant = KEY_TO_QUADRANT[e.key];
      if (quadrant) {
        e.preventDefault();
        onSort(active.id, quadrant);
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        if (remaining > 0) onSkip(active.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active.id, remaining, isDragging, onSort, onSkip, onClose]);

  return (
    <div
      className={`triage-overlay ${isDragging ? "dragging" : ""}`}
      onClick={onClose}
    >
      <div className="triage-modal" onClick={(e) => e.stopPropagation()}>
        <div className="triage-header">
          <span className="triage-instruction">
            {isTouch
              ? "Sort this task into a quadrant below"
              : "Drag into a quadrant below — or press 1–4, S to skip"}
          </span>
          <button
            className="recurring-modal-close"
            onClick={onClose}
            title="Close"
            aria-label="Close triage"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="triage-stack">
          {remaining > 1 && <div className="triage-ghost ghost-2" />}
          {remaining > 0 && <div className="triage-ghost ghost-1" />}
          <div
            ref={setNodeRef}
            className="triage-active-card"
            {...attributes}
            {...listeners}
          >
            <span className="triage-card-title">{active.title}</span>
            <div className="triage-card-tags">
              {active.dueDate && (
                <span className={`card-tag ${dueUrgencyClass(active.dueDate)}`}>
                  {formatDueDateFull(active.dueDate)}
                </span>
              )}
              {active.area && (
                <span
                  className={`card-tag area ${AREA_COLORS[active.area] || ""}`}
                >
                  {AREA_LABELS[active.area] || active.area}
                </span>
              )}
              <span className="card-tag triage-meta">
                Effort: {active.effort}
              </span>
              <span className="card-tag triage-meta">
                Decisions: {active.decisionLoad}
              </span>
            </div>
          </div>
          {remaining > 0 && (
            <span className="triage-count">
              {remaining} more after this one
            </span>
          )}
        </div>

        <div className="triage-quadrant-buttons">
          {QUADRANTS.map((q, i) => (
            <button
              key={q.id}
              className={`triage-quadrant-btn ${q.colorClass}`}
              onClick={() => onSort(active.id, q.id)}
            >
              <Icon name={q.icon} className="quadrant-icon" />
              <span className="triage-btn-titles">
                <span className="triage-btn-title">{q.title}</span>
                <span className="quadrant-subtitle">{q.subtitle}</span>
              </span>
              {!isTouch && <kbd className="triage-key">{i + 1}</kbd>}
            </button>
          ))}
        </div>

        <button
          className="triage-skip-btn"
          onClick={() => onSkip(active.id)}
          disabled={remaining === 0}
        >
          <Icon name="skip_next" /> Skip for now
        </button>
      </div>
    </div>
  );
};
