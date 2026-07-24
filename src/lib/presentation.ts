// Presentation helpers shared across components: display labels, date
// formatting, and card grouping/ordering. No data fetching, no mutation.

import { type Task } from "../domain/task-rules";
import { toLocalDateKey, type RecurringItem } from "../domain/recurrence";

// ── Area labels ──

export const AREA_LABELS: Record<string, string> = {
  "life-admin": "Life Admin",
  social: "Social",
  health: "Health",
  learning: "Learning",
  career: "Career",
  "personal-project": "Project",
};

export const AREA_COLORS: Record<string, string> = {
  "life-admin": "area-blue",
  social: "area-purple",
  health: "area-orange",
  learning: "area-teal",
  career: "area-green",
  "personal-project": "area-pink",
};

export const AREA_OPTIONS = Object.entries(AREA_LABELS);

// ── Due date formatting ──

export const getDaysLeft = (date: string): number => {
  const d = new Date(date + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
};

export const formatDueDate = (date: string): string => {
  const diff = getDaysLeft(date);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day";
  return `${diff} days`;
};

export const formatDueDateFull = (date: string): string => {
  const d = new Date(date + "T00:00:00");
  return (
    "Due: " +
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  );
};

export const dueUrgencyClass = (date: string): string => {
  const diff = getDaysLeft(date);
  if (diff <= 2) return "due-red";
  if (diff <= 4) return "due-orange";
  if (diff <= 7) return "due-yellow";
  return "due-green";
};

// ── Relative time ──

export const daysAgo = (isoDate: string): string => {
  const d = Math.round((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
};

export const timeSince = (isoDate: string): string => {
  const ms = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
};

export const formatHeadingDate = (): string =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

// ── URLs ──

export const linkLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const getDomain = linkLabel;

// ── Task ordering & grouping ──

export const sortTasks = (tasks: Task[]): Task[] =>
  [...tasks].sort((a, b) => {
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return 0;
  });

const formatDateLabel = (dateKey: string, todayStr: string): string => {
  if (dateKey === todayStr) return "Today";
  if (dateKey === "unknown") return "Earlier";
  return new Date(dateKey + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export const groupDoneByDate = (
  tasks: Task[]
): { dateKey: string; label: string; tasks: Task[] }[] => {
  const todayStr = toLocalDateKey(new Date());
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const dateKey = t.completedAt
      ? toLocalDateKey(new Date(t.completedAt))
      : "unknown";
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(t);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return sorted.map(([dateKey, tasks]) => ({
    dateKey,
    label: formatDateLabel(dateKey, todayStr),
    tasks,
  }));
};

export const groupRecurringDoneByDate = (
  items: RecurringItem[]
): { dateKey: string; label: string; items: RecurringItem[] }[] => {
  const todayStr = toLocalDateKey(new Date());
  const groups = new Map<string, RecurringItem[]>();
  for (const item of items) {
    const dateKey = item.lastCompletedAt
      ? toLocalDateKey(new Date(item.lastCompletedAt))
      : "unknown";
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(item);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return sorted.map(([dateKey, grpItems]) => ({
    dateKey,
    label: formatDateLabel(dateKey, todayStr),
    items: grpItems,
  }));
};

// ── Recurrence labels ──

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export const REPEAT_UNITS: ("day" | "week" | "month" | "year")[] = [
  "day",
  "week",
  "month",
  "year",
];

export const formatRecurrence = (item: RecurringItem): string => {
  const every = item.repeatEvery || 1;
  const unit = item.repeatUnit || "week";
  const days = item.repeatDays || [];
  let result: string;
  if (every === 1) {
    result =
      unit === "day"
        ? "Daily"
        : unit === "week"
          ? "Weekly"
          : unit === "month"
            ? "Monthly"
            : "Yearly";
  } else {
    const plural = unit + "s";
    result = "Every " + every + " " + plural;
  }
  if (unit === "week" && days.length > 0) {
    result += " on " + days.map((d) => DAY_NAMES[d]).join(", ");
  }
  if (item.endsType === "on" && item.endsOn) {
    result +=
      " until " +
      new Date(item.endsOn + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  } else if (item.endsType === "after" && item.endsAfter) {
    result += " (" + item.endsAfter + "x)";
  }
  return result;
};
