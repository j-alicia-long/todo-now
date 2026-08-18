// Task lifecycle rules — the single source of truth for how a Task's
// status, done flag, completedAt, and deletedAt move together.
// Imported by both server.ts (persistence) and the UI (optimistic updates).
// All functions are pure; the clock is always passed in as `now`.

export type TaskStatus =
  "this-week" | "this-month" | "future" | "done" | "trashed";

// Binary judgment set explicitly by the user; null = not yet judged
// (Unsorted on the Matrix). Urgency is never stored — see ADR-0001.
export type Importance = "important" | "not-important";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  status: TaskStatus;
  effort: "low" | "medium" | "high";
  decisionLoad: "low" | "medium" | "high";
  area: string;
  dueDate: string | null;
  importance: Importance | null;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  source: "board" | "shopping" | "grocery";
  sourceItemId: string | null;
  links?: string[];
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

/** How long a completed Task stays visible in the Done column. */
export const DONE_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether a done Task should still show in the Done column: those completed
 * within the last week stay, older ones are hidden to keep the column tidy.
 * A done Task with no completedAt stamp (legacy data) is always kept, since
 * its age can't be determined. Hiding is display-only — the Task is not
 * trashed or deleted.
 */
export const isRecentlyDone = (task: Task, now: Date): boolean => {
  if (!task.completedAt) return true;
  return (
    now.getTime() - new Date(task.completedAt).getTime() <= DONE_VISIBLE_MS
  );
};

/**
 * Re-date a Task's completion to a target local day (a `YYYY-MM-DD` key),
 * for dragging a done card into a different day group in the Done column.
 *
 * Time-of-day is carried over from the existing completedAt so re-dating
 * doesn't reshuffle a day's cards or land on midnight (where a DST shift
 * could push the task onto the neighbouring day). A Task that isn't done
 * yet is completed as of the target day, using the current time-of-day.
 *
 * Returns the fields to write, or null when the change is a no-op or the
 * target isn't a real day ("unknown", the Earlier bucket).
 */
export const applyCompletionDateChange = (
  task: Task,
  targetDateKey: string,
  now: Date
): (StatusChange & { completedAt: string }) | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateKey)) return null;

  const timeSource = task.completedAt ? new Date(task.completedAt) : now;
  const [year, month, day] = targetDateKey.split("-").map(Number);
  const stamped = new Date(
    year,
    month - 1,
    day,
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds()
  ).toISOString();

  if (task.done && task.status === "done" && task.completedAt === stamped) {
    return null;
  }
  return { done: true, status: "done", completedAt: stamped };
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
