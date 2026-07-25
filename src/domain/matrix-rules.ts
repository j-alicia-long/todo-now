// Matrix rules — the single source of truth for the Eisenhower Matrix
// view: which Tasks appear on it, which Quadrant each one occupies, and
// what field changes a drop produces. Sibling to task-rules and
// recurrence. All functions are pure; the clock is always passed in as
// `now`. Urgency is derived, never stored (ADR-0001), and its 2-day
// cutoff deliberately matches the due-tag "red zone" so the Matrix and
// due colors never disagree.

import type { Task, Importance } from "./task-rules";
import { toLocalDateKey } from "./recurrence";

// Quadrant names come from the domain glossary (CONTEXT.md, "The
// Matrix"): a one-person system has nobody to delegate to.
export type Quadrant = "do" | "schedule" | "quick-hit" | "reconsider";

/** Due within this many days (or overdue) = urgent. Matches `due-red`. */
export const URGENT_WITHIN_DAYS = 2;
/** Dragging into an urgent Quadrant sets the due date this far out. */
export const ESCALATE_DUE_IN_DAYS = 2;
/** Dragging out of an urgent Quadrant pushes the due date this far out. */
export const DEESCALATE_DUE_IN_DAYS = 7;

const MS_PER_DAY = 86400000;

/** Calendar days from local today to the due date key (negative = overdue). */
const daysUntilDue = (dueDate: string, now: Date): number => {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
};

const dateKeyDaysFromNow = (days: number, now: Date): string => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return toLocalDateKey(d);
};

/** Urgent iff due within 2 days or overdue. No due date = not urgent. */
export const isUrgent = (task: Task, now: Date): boolean =>
  task.dueDate !== null &&
  daysUntilDue(task.dueDate, now) <= URGENT_WITHIN_DAYS;

/** Only live Board Tasks (This Week / This Month) appear on the Matrix. */
export const isOnMatrix = (task: Task): boolean =>
  task.status === "this-week" || task.status === "this-month";

/** Unsorted = importance never judged. */
export const isUnsorted = (task: Task): boolean => task.importance === null;

const isImportantQuadrant = (q: Quadrant): boolean =>
  q === "do" || q === "schedule";

const isUrgentQuadrant = (q: Quadrant): boolean =>
  q === "do" || q === "quick-hit";

/**
 * The single Quadrant a sorted Task occupies, or null while Unsorted.
 * Callers should scope with `isOnMatrix` first.
 */
export const quadrantOf = (task: Task, now: Date): Quadrant | null => {
  if (task.importance === null) return null;
  const important = task.importance === "important";
  const urgent = isUrgent(task, now);
  if (important) return urgent ? "do" : "schedule";
  return urgent ? "quick-hit" : "reconsider";
};

export type MatrixLayout = {
  quadrants: Record<Quadrant, Task[]>;
  unsorted: Task[];
};

/**
 * Partition Tasks into the four Quadrants plus the Unsorted tray,
 * dropping everything out of Matrix scope (Future, Done, Trashed).
 * Input order is preserved within each cell.
 */
export const partitionMatrix = (tasks: Task[], now: Date): MatrixLayout => {
  const layout: MatrixLayout = {
    quadrants: { do: [], schedule: [], "quick-hit": [], reconsider: [] },
    unsorted: [],
  };
  for (const task of tasks) {
    if (!isOnMatrix(task)) continue;
    const quadrant = quadrantOf(task, now);
    if (quadrant === null) layout.unsorted.push(task);
    else layout.quadrants[quadrant].push(task);
  }
  return layout;
};

export type MatrixDropChanges = {
  importance: Importance;
  /** Present only when the drop crosses the urgency boundary (ADR-0001). */
  dueDate?: string;
};

/**
 * Field changes for "Task dropped on Quadrant `target`":
 * - every drop sets importance to the target column's value
 * - into an urgent Quadrant while not urgent → dueDate = today+2
 * - out of an urgent Quadrant while urgent → dueDate = today+7
 * - a drop on the Task's current Quadrant is a no-op (null)
 */
export const applyMatrixDrop = (
  task: Task,
  target: Quadrant,
  now: Date
): MatrixDropChanges | null => {
  if (quadrantOf(task, now) === target) return null;

  const changes: MatrixDropChanges = {
    importance: isImportantQuadrant(target) ? "important" : "not-important",
  };
  const urgent = isUrgent(task, now);
  if (isUrgentQuadrant(target) && !urgent) {
    changes.dueDate = dateKeyDaysFromNow(ESCALATE_DUE_IN_DAYS, now);
  } else if (!isUrgentQuadrant(target) && urgent) {
    changes.dueDate = dateKeyDaysFromNow(DEESCALATE_DUE_IN_DAYS, now);
  }
  return changes;
};
