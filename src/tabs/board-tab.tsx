// Board tab: drag-and-drop task columns with recurring chips merged in.

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { type Task, type TaskStatus } from "../domain/task-rules";
import {
  boardWeeklyItems,
  isWeeklyRecurring,
  upcomingLongTermItems,
  type RecurringItem,
} from "../domain/recurrence";
import { type Settings } from "../stores/hooks";
import { TaskCard, type TaskActions } from "../components/task-card";
import {
  BoardColumn,
  type RecurringCardActions,
} from "../components/board-column";

const BOARD_COLUMNS: {
  id: TaskStatus;
  title: string;
  icon: string;
  colorClass: string;
}[] = [
  {
    id: "this-week",
    title: "This Week",
    icon: "bolt",
    colorClass: "col-purple",
  },
  {
    id: "this-month",
    title: "This Month",
    icon: "date_range",
    colorClass: "col-purple",
  },
  { id: "done", title: "Done", icon: "check_circle", colorClass: "col-green" },
];

export const BoardTab = ({
  tasks,
  taskActions,
  recurringItems,
  recurringActions,
  settings,
}: {
  tasks: Task[];
  taskActions: TaskActions;
  recurringItems: RecurringItem[];
  recurringActions: RecurringCardActions;
  settings: Settings;
}) => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const isTouchDevice =
    typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
  const sensors = useSensors(
    ...(isTouchDevice
      ? []
      : [useSensor(PointerSensor, { activationConstraint: { distance: 8 } })])
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const targetColumn = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetColumn) return;
    taskActions.changeStatus(taskId, targetColumn);
  };

  const tasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);
  const recurringTasks = recurringItems.filter((i) => i.category === "task");
  const weeklyTasks = recurringTasks.filter(isWeeklyRecurring);
  const longTermTasks = recurringTasks.filter((i) => !isWeeklyRecurring(i));
  const allBoardRecurring = [
    ...boardWeeklyItems(weeklyTasks, new Date()),
    ...upcomingLongTermItems(longTermTasks, new Date()),
  ];
  const boardRecurringTasks = allBoardRecurring.filter(
    (i) => !i.completedThisWeek
  );
  const boardRecurringDone = allBoardRecurring.filter(
    (i) => i.completedThisWeek
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="board">
        {BOARD_COLUMNS.map((col) => (
          <BoardColumn
            key={col.id}
            id={col.id}
            title={col.title}
            icon={col.icon}
            colorClass={col.colorClass}
            tasks={tasksByStatus(col.id)}
            taskActions={taskActions}
            settings={settings}
            recurring={
              col.id === "this-week"
                ? { items: boardRecurringTasks, actions: recurringActions }
                : col.id === "done"
                  ? { items: boardRecurringDone, actions: recurringActions }
                  : undefined
            }
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            actions={{
              changeStatus: () => {},
              update: () => {},
              trash: () => {},
            }}
            settings={settings}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
