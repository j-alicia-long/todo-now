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
  /** Days before the due/recurrence day the item appears on the Board.
   *  null = default: 14 for long-term items, 0 for weekly items. */
  showEarlyDays: number | null;
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
 * (0=Sunday..6=Saturday): the next occurrence of that weekday, counting
 * today when the weekday matches.
 */
export const deriveFirstDueDate = (dayOfWeek: number, now: Date): string => {
  const daysUntil = (dayOfWeek - now.getDay() + 7) % 7;
  const occurrence = new Date(now);
  occurrence.setDate(now.getDate() + daysUntil);
  return toLocalDateKey(occurrence);
};

export const DEFAULT_SHOW_EARLY_LONG_TERM = 14;
export const DEFAULT_SHOW_EARLY_WEEKLY = 0;

/** Effective "appear on Board N days early" value, applying defaults. */
export const effectiveShowEarlyDays = (i: RecurringItem): number =>
  i.showEarlyDays ??
  (isWeeklyRecurring(i)
    ? DEFAULT_SHOW_EARLY_WEEKLY
    : DEFAULT_SHOW_EARLY_LONG_TERM);

/**
 * Weekly items that belong on today's Board: within showEarlyDays of a
 * scheduled weekday (0 = only on the day itself), items with no specific
 * days, plus already-completed ones so they can render in the Done column.
 */
export const boardWeeklyItems = (
  weekly: RecurringItem[],
  now: Date
): RecurringItem[] => {
  const todayDow = now.getDay();
  return weekly.filter((i) => {
    if (i.completedThisWeek) return true;
    if (i.repeatDays.length === 0) return true;
    const early = effectiveShowEarlyDays(i);
    return i.repeatDays.some((d) => (d - todayDow + 7) % 7 <= early);
  });
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Long-term items that belong on the Board: from showEarlyDays before the
 * due date (default 14), dropping off 24 hours after the due date passes.
 */
export const upcomingLongTermItems = (
  longTerm: RecurringItem[],
  now: Date
): RecurringItem[] =>
  longTerm.filter((i) => {
    if (!i.dueDate) return false;
    const delta = new Date(i.dueDate).getTime() - now.getTime();
    return delta <= effectiveShowEarlyDays(i) * DAY_MS && delta > -DAY_MS;
  });

// ── Due-date advancement ──

const addInterval = (
  d: Date,
  every: number,
  unit: RecurringItem["repeatUnit"]
): Date => {
  const next = new Date(d);
  if (unit === "day") next.setDate(next.getDate() + every);
  else if (unit === "week") next.setDate(next.getDate() + 7 * every);
  else if (unit === "month") next.setMonth(next.getMonth() + every);
  else next.setFullYear(next.getFullYear() + every);
  return next;
};

const MAX_STEPS = 1000;

/**
 * Advance a long-term item's dueDate to its next occurrence after
 * completion: step from the old dueDate (keeping the schedule anchored),
 * repeating until the result is in the future. Ends rules are enforced:
 * - endsOn: past the cutoff, recurrence ends (dueDate → null)
 * - endsAfter: the occurrence index is derived by walking the anchored
 *   grid back to createdAt — no completion counter is stored, so manually
 *   editing dueDate re-anchors the grid
 * Weekly items and items without a dueDate are returned unchanged.
 */
export const advanceDueDate = (
  item: RecurringItem,
  now: Date
): RecurringItem => {
  if (isWeeklyRecurring(item) || !item.dueDate) return item;
  const every = Math.max(1, item.repeatEvery || 1);
  const unit = item.repeatUnit;
  const current = new Date(item.dueDate + "T00:00:00");

  // Always advance at least one interval (completing early still moves to
  // the next occurrence), then catch up past `now` if occurrences lapsed.
  let next = addInterval(current, every, unit);
  for (let i = 0; next.getTime() <= now.getTime() && i < MAX_STEPS; i++) {
    next = addInterval(next, every, unit);
  }

  if (item.endsType === "on" && item.endsOn) {
    const cutoff = new Date(item.endsOn + "T23:59:59.999");
    if (next > cutoff) return { ...item, dueDate: null };
  }

  if (item.endsType === "after" && item.endsAfter) {
    // Walk back from the current due date to find the grid anchor (the
    // first occurrence at or after creation), then index `next` on it.
    const created = new Date(item.createdAt);
    const createdDay = new Date(
      created.getFullYear(),
      created.getMonth(),
      created.getDate()
    );
    let anchor = current;
    for (let i = 0; i < MAX_STEPS; i++) {
      const prev = addInterval(anchor, -every, unit);
      if (prev < createdDay) break;
      anchor = prev;
    }
    let index = 1;
    let cursor = anchor;
    for (let i = 0; cursor.getTime() < next.getTime() && i < MAX_STEPS; i++) {
      cursor = addInterval(cursor, every, unit);
      index++;
    }
    if (index > item.endsAfter) return { ...item, dueDate: null };
  }

  return { ...item, dueDate: toLocalDateKey(next) };
};
