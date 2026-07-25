// Matrix view of the Board: the Eisenhower 2×2 grid (Do / Schedule /
// Quick-hit / Reconsider) plus the Unsorted tray. A thin consumer of
// matrix-rules — all placement comes from the domain module. Quadrants
// are drop targets; the drop itself is handled by the Board tab's
// DndContext.

import { useDroppable } from "@dnd-kit/core";
import { type Task } from "../domain/task-rules";
import { partitionMatrix, type Quadrant } from "../domain/matrix-rules";
import { type Settings } from "../stores/hooks";
import { Icon } from "./ui";
import { TaskCard, type TaskActions } from "./task-card";
import { sortTasks } from "../lib/presentation";

const QUADRANTS: {
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

const MatrixQuadrant = ({
  quadrant,
  tasks,
  taskActions,
  settings,
}: {
  quadrant: (typeof QUADRANTS)[number];
  tasks: Task[];
  taskActions: TaskActions;
  settings: Settings;
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

export const MatrixView = ({
  tasks,
  taskActions,
  settings,
}: {
  tasks: Task[];
  taskActions: TaskActions;
  settings: Settings;
}) => {
  const layout = partitionMatrix(tasks, new Date());

  return (
    <div className="matrix-layout">
      <div className="matrix-grid">
        {QUADRANTS.map((q) => (
          <MatrixQuadrant
            key={q.id}
            quadrant={q}
            tasks={layout.quadrants[q.id]}
            taskActions={taskActions}
            settings={settings}
          />
        ))}
      </div>
      <div className="matrix-unsorted">
        <div className="quadrant-header">
          <Icon name="inbox" className="quadrant-icon" />
          <div className="quadrant-titles">
            <h2 className="quadrant-title">Unsorted</h2>
            <span className="quadrant-subtitle">Drag into a quadrant</span>
          </div>
          <span className="column-count">{layout.unsorted.length}</span>
        </div>
        <div className="quadrant-cards">
          {layout.unsorted.length === 0 ? (
            <div className="column-empty">Everything is sorted</div>
          ) : (
            sortTasks(layout.unsorted).map((task) => (
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
    </div>
  );
};
