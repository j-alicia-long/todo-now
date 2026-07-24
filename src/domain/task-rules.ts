// Task lifecycle rules — the single source of truth for how a Task's
// status, done flag, completedAt, and deletedAt move together.
// Imported by both server.ts (persistence) and the UI (optimistic updates).
// All functions are pure; the clock is always passed in as `now`.

export type TaskStatus =
  "this-week" | "this-month" | "future" | "done" | "trashed";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  status: TaskStatus;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  decisionLoad: "low" | "medium" | "high";
  area: string;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  source: "board" | "shopping" | "grocery";
  sourceItemId: string | null;
};

export type StatusChange = {
  status?: TaskStatus;
  done?: boolean;
};

export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DUE_SOON_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Apply a requested status/done change to a Task, keeping the lifecycle
 * fields consistent:
 * - entering `done` stamps completedAt; leaving it clears completedAt
 * - entering `trashed` stamps deletedAt; leaving it clears deletedAt (restore)
 * - `done: true` is shorthand for moving to `done`
 * - `done: false` on a done Task sends it back to This Week
 * A change that doesn't alter anything returns the task unchanged.
 */
export const applyStatusChange = (
  task: Task,
  change: StatusChange,
  now: Date
): Task => {
  const { status, done } = change;

  if (status !== undefined && status !== task.status) {
    const updated: Task = { ...task, status };
    if (status === "done") {
      updated.done = true;
      updated.completedAt = now.toISOString();
    } else {
      updated.done = false;
      updated.completedAt = null;
    }
    if (status === "trashed") {
      updated.deletedAt = now.toISOString();
    } else if (task.status === "trashed") {
      updated.deletedAt = null;
    }
    return updated;
  }

  if (done === true && !task.done) {
    return {
      ...task,
      done: true,
      status: "done",
      completedAt: now.toISOString(),
    };
  }
  if (done === false && task.done) {
    return { ...task, done: false, status: "this-week", completedAt: null };
  }

  return task;
};

/**
 * Tasks in This Month whose due date is within 7 days move to This Week.
 * Returns the same array instance when nothing changed.
 */
export const promoteDueSoon = (tasks: Task[], now: Date): Task[] => {
  let changed = false;
  const result = tasks.map((t) => {
    if (t.status === "this-month" && t.dueDate) {
      const dueMs = new Date(t.dueDate).getTime() - now.getTime();
      if (dueMs <= DUE_SOON_MS) {
        changed = true;
        return { ...t, status: "this-week" as TaskStatus };
      }
    }
    return t;
  });
  return changed ? result : tasks;
};

/**
 * Trashed Tasks older than 30 days are dropped.
 * Returns the same array instance when nothing changed.
 */
export const purgeTrash = (tasks: Task[], now: Date): Task[] => {
  const result = tasks.filter((t) => {
    if (t.status === "trashed" && t.deletedAt) {
      return now.getTime() - new Date(t.deletedAt).getTime() <= TRASH_TTL_MS;
    }
    return true;
  });
  return result.length === tasks.length ? tasks : result;
};
