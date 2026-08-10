// Construction defaults for the four list families — the item a bare
// POST body becomes. Shared by the server (create routes) and the client
// (optimistic creates, offline creates), so both build identical items.
// A client-supplied id is honored; otherwise one is generated. IDs are
// 8-char random strings either way.

import type { Task, TaskStatus } from "./task-rules";
import type { RecurringItem } from "./recurrence";
import type { ShoppingItem, GroceryItem } from "./entities";

export const newId = () => crypto.randomUUID().slice(0, 8);

type Body = Record<string, unknown>;

const idFrom = (body: Body) =>
  typeof body.id === "string" && body.id ? body.id : newId();

// Offline replay POSTs the full item it built earlier; honoring its
// original createdAt keeps synced data indistinguishable from online.
const createdAtFrom = (body: Body, now: Date) =>
  typeof body.createdAt === "string" && body.createdAt
    ? body.createdAt
    : now.toISOString();

export const constructTask = (body: Body, now: Date): Task => ({
  id: idFrom(body),
  title: (body.title as string) || "Untitled",
  done: false,
  status: (body.status as TaskStatus) || "this-week",
  effort: (body.effort as Task["effort"]) || "medium",
  decisionLoad: (body.decisionLoad as Task["decisionLoad"]) || "medium",
  area: (body.area as string) || "life-admin",
  dueDate: (body.dueDate as string) || null,
  importance: (body.importance as Task["importance"]) ?? null,
  createdAt: createdAtFrom(body, now),
  completedAt: null,
  deletedAt: null,
  source: (body.source as Task["source"]) || "board",
  sourceItemId: (body.sourceItemId as string) || null,
  links: Array.isArray(body.links) ? (body.links as string[]) : [],
});

export const constructShoppingItem = (body: Body, now: Date): ShoppingItem => ({
  id: idFrom(body),
  title: (body.title as string) || "Untitled",
  done: false,
  archived: false,
  category: body.category === "want" ? "want" : "need",
  links: Array.isArray(body.links) ? (body.links as string[]) : [],
  createdAt: createdAtFrom(body, now),
  doneAt: null,
});

export const constructGroceryItem = (body: Body, now: Date): GroceryItem => ({
  id: idFrom(body),
  title: (body.title as string) || "Untitled",
  done: false,
  createdAt: createdAtFrom(body, now),
  category: body.category === "reference" ? "reference" : "task",
});

export const constructRecurringItem = (
  body: Body,
  now: Date
): RecurringItem => {
  const isEvent = body.category === "reference";
  return {
    id: idFrom(body),
    title: (body.title as string) || "Untitled",
    frequency: isEvent
      ? "weekly"
      : body.frequency === "long-term"
        ? "long-term"
        : "weekly",
    dayOfWeek: (body.dayOfWeek as number) ?? null,
    repeatEvery: isEvent ? 1 : ((body.repeatEvery as number) ?? 1),
    repeatUnit: isEvent
      ? "week"
      : ((body.repeatUnit as RecurringItem["repeatUnit"]) ?? "week"),
    repeatDays: isEvent
      ? []
      : ((body.repeatDays as number[]) ??
        (body.dayOfWeek != null ? [body.dayOfWeek as number] : [])),
    endsType: isEvent
      ? "never"
      : ((body.endsType as RecurringItem["endsType"]) ?? "never"),
    endsOn: isEvent ? null : ((body.endsOn as string) ?? null),
    endsAfter: isEvent ? null : ((body.endsAfter as number) ?? null),
    note: (body.note as string) || "",
    link: (body.link as string) || "",
    completedThisWeek: false,
    lastCompletedAt: null,
    createdAt: createdAtFrom(body, now),
    dueDate: (body.dueDate as string) ?? null,
    showEarlyDays: (body.showEarlyDays as number) ?? null,
    area: (body.area as string) || "",
    category: isEvent ? "reference" : "task",
  };
};
