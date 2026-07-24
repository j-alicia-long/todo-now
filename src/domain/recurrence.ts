// Pure Week & recurrence rules shared by server and client.
// No I/O, no clock reads — time-dependent functions take an injected `now`.

export type RecurringItem = {
  id: string;
  title: string;
  frequency: "weekly" | "long-term";
  dayOfWeek: number | null;
  repeatEvery: number;
  repeatUnit: "day" | "week" | "month" | "year";
  repeatDays: number[];
  endsType: "never" | "on" | "after";
  endsOn: string | null;
  endsAfter: number | null;
  note: string;
  link: string;
  completedThisWeek: boolean;
  lastCompletedAt: string | null;
  dueDate: string | null;
  area: string;
  createdAt: string;
  category: "task" | "reference";
};

/** A recurring item that repeats every single week (the default cadence). */
export const isWeeklyRecurring = (i: RecurringItem): boolean =>
  i.repeatUnit === "week" && i.repeatEvery === 1 && i.frequency !== "long-term";

// Local-timezone YYYY-MM-DD key (toISOString would use UTC and shift dates in the evening)
export const toLocalDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Start of the week containing `now`: Monday 00:00 local time, as epoch ms. */
export const getWeekStart = (now: Date): number => {
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diff
  );
  return monday.getTime();
};

/**
 * Clear completedThisWeek on weekly items whose completion predates the
 * current week's Monday. Returns the same array instance when nothing
 * changed, so callers can use an identity check to decide whether to persist.
 */
export const resetWeeklyItems = (
  items: RecurringItem[],
  now: Date
): RecurringItem[] => {
  const weekStart = getWeekStart(now);
  let changed = false;
  const next = items.map((item) => {
    if (item.frequency === "weekly" && item.completedThisWeek) {
      const lastDone = item.lastCompletedAt
        ? new Date(item.lastCompletedAt).getTime()
        : 0;
      if (lastDone < weekStart) {
        changed = true;
        return { ...item, completedThisWeek: false };
      }
    }
    return item;
  });
  return changed ? next : items;
};

export type RecurringCompletion = {
  completedThisWeek?: boolean;
  done?: boolean;
};

/**
 * Completion stamping rules, shared by the server PUT handler and the
 * client's optimistic toggle:
 * - completedThisWeek true (from false) stamps lastCompletedAt
 * - completedThisWeek false clears the flag but keeps lastCompletedAt
 * - done: true stamps lastCompletedAt and, for weekly items, also sets
 *   completedThisWeek
 * Returns the same instance when nothing applies.
 */
export const applyRecurringCompletion = (
  item: RecurringItem,
  change: RecurringCompletion,
  now: Date
): RecurringItem => {
  let next = item;
  if (change.completedThisWeek === true && !item.completedThisWeek) {
    next = {
      ...next,
      completedThisWeek: true,
      lastCompletedAt: now.toISOString(),
    };
  } else if (change.completedThisWeek === false && item.completedThisWeek) {
    next = { ...next, completedThisWeek: false };
  }
  if (change.done === true) {
    next = {
      ...next,
      lastCompletedAt: now.toISOString(),
      completedThisWeek:
        next.frequency === "weekly" ? true : next.completedThisWeek,
    };
  }
  return next;
};

/**
 * Default first due date for a new recurring task on `dayOfWeek`
 * (0=Sunday..6=Saturday): the next occurrence of that weekday — skipping
 * today — minus a 2-day heads-up buffer, pushed a week out if the buffered
 * date is not in the future.
 */
export const deriveFirstDueDate = (dayOfWeek: number, now: Date): string => {
  const todayDay = now.getDay();
  let daysUntil = (dayOfWeek - todayDay + 7) % 7;
  if (daysUntil === 0) daysUntil = 7;
  const recurDate = new Date(now);
  recurDate.setDate(now.getDate() + daysUntil - 2);
  if (recurDate <= now) recurDate.setDate(recurDate.getDate() + 7);
  return toLocalDateKey(recurDate);
};

/**
 * Weekly items that belong on today's Board: scheduled for today (or any
 * day), plus already-completed ones so they can render in the Done column.
 */
export const boardWeeklyItems = (
  weekly: RecurringItem[],
  now: Date
): RecurringItem[] => {
  const todayDow = now.getDay();
  return weekly.filter(
    (i) =>
      i.repeatDays.length === 0 ||
      i.repeatDays.includes(todayDow) ||
      i.completedThisWeek
  );
};

const DAY_MS = 24 * 60 * 60 * 1000;
const BOARD_WINDOW_MS = 7 * DAY_MS;

/**
 * Long-term items that belong on the Board: due within the next 7 days,
 * dropping off 24 hours after the due date passes.
 */
export const upcomingLongTermItems = (
  longTerm: RecurringItem[],
  now: Date
): RecurringItem[] =>
  longTerm.filter((i) => {
    if (!i.dueDate) return false;
    const delta = new Date(i.dueDate).getTime() - now.getTime();
    return delta <= BOARD_WINDOW_MS && delta > -DAY_MS;
  });
