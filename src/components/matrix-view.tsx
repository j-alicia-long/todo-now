// Matrix view of the Board: the Eisenhower 2×2 grid (Do / Schedule /
// Quick-hit / Reconsider) plus the Unsorted tray. A thin consumer of
// matrix-rules — all placement comes from the domain module. Quadrants
// are drop targets; the drop itself is handled by the Board tab's
// DndContext.

import { useDroppable, useDraggable } from "@dnd-kit/core";
import { type Task } from "../domain/task-rules";
import { partitionMatrix, type Quadrant } from "../domain/matrix-rules";
import { Icon } from "./kit/icon";
import { type TaskActions } from "./task-card";
import { dueUrgencyClass, formatDueDate, sortTasks } from "../lib/presentation";

export const QUADRANTS: {
  id: Quadrant;
  title: string;
  subtitle: string;
  icon: string;
  colorClass: string;
  emptyText: string;
}[] = [
  {
    id: "do",
    title: "Do",
    subtitle: "Urgent & important",
    icon: "local_fire_department",
    colorClass: "quadrant-do",
    emptyText: "No fires burning",
  },
  {
    id: "schedule",
    title: "Schedule",
    subtitle: "Important, not urgent",
    icon: "event",
    colorClass: "quadrant-schedule",
    emptyText: "Nothing scheduled ahead",
  },
  {
    id: "quick-hit",
    title: "Quick-hit",
    subtitle: "Urgent, not important",
    icon: "bolt",
    colorClass: "quadrant-quick-hit",
    emptyText: "No small fires",
  },
  {
    id: "reconsider",
    title: "Reconsider",
    subtitle: "Neither",
    icon: "psychology_alt",
    colorClass: "quadrant-reconsider",
    emptyText: "Nothing to question",
  },
];

/** Compact Matrix card: draggable, done checkbox, title, inline due tag.
 *  Editing happens on the Board — the Matrix is for triage. */
export const MatrixCard = ({
  task,
  actions,
  isDragOverlay,
}: {
  task: Task;
  actions: TaskActions;
  isDragOverlay?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { task } });

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

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      className="matrix-card"
      style={style}
      {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
    >
      <div className="matrix-card-top">
        <label className="card-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={task.done}
            onChange={(e) => {
              e.stopPropagation();
              actions.changeStatus(task.id, task.done ? "this-week" : "done");
            }}
          />
          <span className="checkmark" />
        </label>
        {task.dueDate && (
          <span className={`card-tag ${dueUrgencyClass(task.dueDate)}`}>
            {formatDueDate(task.dueDate)}
          </span>
        )}
      </div>
      <span className="matrix-card-title">{task.title}</span>
    </div>
  );
};

const MatrixQuadrant = ({
  quadrant,
  tasks,
  taskActions,
}: {
  quadrant: (typeof QUADRANTS)[number];
  tasks: Task[];
  taskActions: TaskActions;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant.id });

  return (
    <div
      ref={setNodeRef}
      className={`matrix-quadrant ${quadrant.colorClass} ${isOver ? "drag-over" : ""}`}
    >
      <div className="quadrant-header">
        <Icon name={quadrant.icon} className="quadrant-icon" />
        <div className="quadrant-titles">
          <h2 className="quadrant-title">{quadrant.title}</h2>
          <span className="quadrant-subtitle">{quadrant.subtitle}</span>
        </div>
        <span className="column-count">{tasks.length}</span>
      </div>
      <div className="quadrant-cards">
        {tasks.length === 0 ? (
          <div className="column-empty">{quadrant.emptyText}</div>
        ) : (
          sortTasks(tasks).map((task) => (
            <MatrixCard key={task.id} task={task} actions={taskActions} />
          ))
        )}
      </div>
    </div>
  );
};

export const MatrixView = ({
  tasks,
  taskActions,
  triagePill,
}: {
  tasks: Task[];
  taskActions: TaskActions;
  /** Rendered while Unsorted Tasks exist and Triage is closed. */
  triagePill?: { count: number; onOpen: () => void };
}) => {
  const layout = partitionMatrix(tasks, new Date());

  return (
    <div className="matrix-layout">
      {triagePill && (
        <button className="triage-pill" onClick={triagePill.onOpen}>
          <Icon name="inbox" /> Sort {triagePill.count}{" "}
          {triagePill.count === 1 ? "task" : "tasks"}
        </button>
      )}
      <div className="matrix-grid">
        {QUADRANTS.map((q) => (
          <MatrixQuadrant
            key={q.id}
            quadrant={q}
            tasks={layout.quadrants[q.id]}
            taskActions={taskActions}
          />
        ))}
      </div>
    </div>
  );
};
