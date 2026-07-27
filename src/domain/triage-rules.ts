// Triage rules — the pure source of truth for the Triage flow: which
// Tasks form the stack, in what order, and what a Skip does. Sibling to
// matrix-rules; the stack is exactly the Matrix partition's Unsorted
// list. The UI holds only `skippedIds` (rotation state) — never a copy
// of the task list — so given the same Tasks, clock, and skips, the
// stack is always the same. Sorting a Task needs no rules here: it is
// applyMatrixDrop from matrix-rules (ADR-0001 semantics included).

import type { Task } from "./task-rules";
import { partitionMatrix } from "./matrix-rules";

/**
 * The Triage stack, front (active Task) first: Unsorted Board Tasks in
 * partition order, with skipped Tasks rotated to the back in skip
 * order. Tasks that stopped being Unsorted drop out without disturbing
 * the rest; stale ids in `skippedIds` are ignored.
 */
export const triageStack = (
  tasks: Task[],
  skippedIds: string[],
  now: Date
): Task[] => {
  const unsorted = partitionMatrix(tasks, now).unsorted;
  const skippedSet = new Set(skippedIds);
  const unskipped = unsorted.filter((t) => !skippedSet.has(t.id));
  const byId = new Map(unsorted.map((t) => [t.id, t]));
  const skipped = skippedIds
    .map((id) => byId.get(id))
    .filter((t): t is Task => t !== undefined);
  return [...unskipped, ...skipped];
};

/**
 * Rotation update for "Skip the active Task": send it to the back of
 * the stack. Re-skipping an already-skipped Task moves it to the end
 * again, so repeated skips cycle through the whole stack and wrap.
 */
export const applySkip = (skippedIds: string[], taskId: string): string[] => [
  ...skippedIds.filter((id) => id !== taskId),
  taskId,
];
