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
import {
  isRecentlyDone,
  type Task,
  type TaskStatus,
} from "../domain/task-rules";
import { applyMatrixDrop, type Quadrant } from "../domain/matrix-rules";
import { triageStack, applySkip } from "../domain/triage-rules";
import {
  boardWeeklyItems,
  isWeeklyRecurring,
  recurringBoardColumn,
  upcomingLongTermItems,
  type RecurringItem,
} from "../domain/recurrence";
import { type BoardView, type Settings } from "../stores/hooks";
import { TaskCard, type TaskActions } from "../components/task-card";
import { MatrixView, MatrixCard } from "../components/matrix-view";
import { TriageModal } from "../components/triage-modal";
import { Icon } from "../components/kit/icon";
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
  const [boardView, setBoardView] = useState<BoardView>(
    settings.defaultBoardView
  );
  // Move mode: shows the arrow/archive buttons on cards. Deliberately plain
  // state (not persisted) so it resets to off whenever the board remounts.
  const [moveMode, setMoveMode] = useState(false);
  // Triage: open/closed per Matrix visit, plus the skip rotation
  // (task ids only — the stack itself derives from triage-rules).
  const [triageOpen, setTriageOpen] = useState(false);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  const isTouchDevice =
    typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  // useSensors filters out null — lets us skip the sensor without calling
  // the hook conditionally (which would break the Rules of Hooks).
  const sensors = useSensors(isTouchDevice ? null : pointerSensor);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (boardView === "matrix") {
      // Drops on a Quadrant map to field changes via the domain module
      // (importance write, plus a due-date write when crossing the
      // urgency boundary per ADR-0001). Same-Quadrant drops are no-ops.
      const changes = applyMatrixDrop(task, over.id as Quadrant, new Date());
      if (changes) taskActions.update(taskId, changes);
      return;
    }
    const targetColumn = over.id as TaskStatus;
    if (task.status === targetColumn) return;
    taskActions.changeStatus(taskId, targetColumn);
  };

  const tasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  // The Done column only keeps the last week of completions tidy; older done
  // tasks are hidden (not deleted). Other columns show everything.
  const columnTasks = (status: TaskStatus) =>
    status === "done"
      ? tasksByStatus("done").filter((t) => isRecentlyDone(t, new Date()))
      : tasksByStatus(status);

  // Triage stack derives fresh each render, so Tasks sorted, completed,
  // or created elsewhere flow in and out automatically.
  const stack = triageStack(tasks, skippedIds, new Date());
  const openTriage = () => {
    setSkippedIds([]);
    setTriageOpen(true);
  };
  const sortActive = (taskId: string, quadrant: Quadrant) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const changes = applyMatrixDrop(task, quadrant, new Date());
    if (changes) taskActions.update(taskId, changes);
  };

  const recurringTasks = recurringItems.filter((i) => i.category === "task");
  const weeklyTasks = recurringTasks.filter(isWeeklyRecurring);
  const longTermTasks = recurringTasks.filter((i) => !isWeeklyRecurring(i));
  // Board visibility only — recurring generation and the Recurring tab
  // are untouched by the hide setting.
  const allBoardRecurring = settings.hideRecurringOnBoard
    ? []
    : [
        ...boardWeeklyItems(weeklyTasks, new Date()),
        ...upcomingLongTermItems(longTermTasks, new Date()),
      ];
  const boardRecurringTasks = allBoardRecurring.filter(
    (i) => !i.completedThisWeek
  );
  // Route active recurring cards into This Week / This Month by due date,
  // rather than dumping them all into This Week.
  const boardRecurringThisWeek = boardRecurringTasks.filter(
    (i) => recurringBoardColumn(i, new Date()) === "this-week"
  );
  const boardRecurringThisMonth = boardRecurringTasks.filter(
    (i) => recurringBoardColumn(i, new Date()) === "this-month"
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
      <div className="board-toolbar">
        <div className="board-view-toggle" role="tablist">
          <button
            role="tab"
            aria-selected={boardView === "columns"}
            className={`board-view-btn ${boardView === "columns" ? "active" : ""}`}
            onClick={() => setBoardView("columns")}
          >
            <Icon name="view_week" /> Columns
          </button>
          <button
            role="tab"
            aria-selected={boardView === "matrix"}
            className={`board-view-btn ${boardView === "matrix" ? "active" : ""}`}
            onClick={() => {
              setBoardView("matrix");
              openTriage();
            }}
          >
            <Icon name="grid_view" /> Matrix
          </button>
        </div>
        {boardView === "columns" && (
          <button
            className={`move-mode-btn ${moveMode ? "active" : ""}`}
            aria-pressed={moveMode}
            onClick={() => setMoveMode((m) => !m)}
            title="Show move and archive buttons on cards"
          >
            <Icon name="swap_horiz" /> Move
          </button>
        )}
      </div>
      {boardView === "matrix" ? (
        <>
          <MatrixView
            tasks={tasks}
            taskActions={taskActions}
            triagePill={
              stack.length > 0 && !triageOpen
                ? { count: stack.length, onOpen: openTriage }
                : undefined
            }
          />
          {triageOpen && stack.length > 0 && (
            <TriageModal
              stack={stack}
              isTouch={isTouchDevice}
              onSort={sortActive}
              onSkip={(id) => setSkippedIds(applySkip(skippedIds, id))}
              onClose={() => setTriageOpen(false)}
            />
          )}
        </>
      ) : (
        <div className="board">
          {BOARD_COLUMNS.map((col) => (
            <BoardColumn
              key={col.id}
              id={col.id}
              title={col.title}
              icon={col.icon}
              colorClass={col.colorClass}
              tasks={columnTasks(col.id)}
              taskActions={taskActions}
              settings={settings}
              moveMode={moveMode}
              recurring={
                col.id === "this-week"
                  ? { items: boardRecurringThisWeek, actions: recurringActions }
                  : col.id === "this-month"
                    ? {
                        items: boardRecurringThisMonth,
                        actions: recurringActions,
                      }
                    : col.id === "done"
                      ? { items: boardRecurringDone, actions: recurringActions }
                      : undefined
              }
            />
          ))}
        </div>
      )}
      <DragOverlay>
        {activeTask ? (
          boardView === "matrix" ? (
            <MatrixCard
              task={activeTask}
              actions={{
                changeStatus: () => {},
                update: () => {},
                trash: () => {},
              }}
              isDragOverlay
            />
          ) : (
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
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
