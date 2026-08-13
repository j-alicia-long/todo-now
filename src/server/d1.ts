// D1 store adapters: the Cloudflare Workers side of the persistence
// seams. Storage is deliberately blob-per-Family (see ADR 0002): one
// two-column table, families(name, json), where each Family's whole
// list is a single JSON document. The ListStore seam reads and writes
// whole lists anyway, and the shared normalize/migrate logic
// (normalize.ts) operates on parsed lists in JS, so blob-per-Family
// keeps all of it untouched — only this file's ~100 lines of I/O
// differ from the file adapter. Settings and the weekly Archive are
// two more rows in the same table.

import type { D1Database } from "@cloudflare/workers-types";
import type { Task } from "../domain/task-rules";
import type { RecurringItem } from "../domain/recurrence";
import type { ShoppingItem, GroceryItem } from "../domain/entities";
import {
  normalizeTasks,
  normalizeShopping,
  normalizeRecurring,
} from "./normalize";
import type { ListStore } from "./resource";
import type { SettingsStore, ArchiveStore } from "./app";

export type D1Stores = {
  tasksStore: ListStore<Task>;
  shoppingStore: ListStore<ShoppingItem>;
  groceriesStore: ListStore<GroceryItem>;
  recurringStore: ListStore<RecurringItem>;
  settingsStore: SettingsStore;
  archiveStore: ArchiveStore;
};

export const createD1Stores = (db: D1Database): D1Stores => {
  // Lazy, memoized schema creation: zero-ops for local Miniflare dev;
  // the Phase 2 import runs the same DDL via `wrangler d1 execute`.
  let schemaReady: Promise<unknown> | null = null;
  const ensureSchema = () =>
    (schemaReady ??= db
      .prepare(
        "CREATE TABLE IF NOT EXISTS families (name TEXT PRIMARY KEY, json TEXT NOT NULL)"
      )
      .run());

  const readRow = async <T>(name: string): Promise<T | null> => {
    await ensureSchema();
    const row = await db
      .prepare("SELECT json FROM families WHERE name = ?")
      .bind(name)
      .first<{ json: string }>();
    if (!row) return null;
    try {
      return JSON.parse(row.json) as T;
    } catch {
      // corrupt row — caller falls back to empty
      return null;
    }
  };

  const writeRow = async (name: string, value: unknown): Promise<void> => {
    await ensureSchema();
    await db
      .prepare("INSERT OR REPLACE INTO families (name, json) VALUES (?, ?)")
      .bind(name, JSON.stringify(value))
      .run();
  };

  const readShopping = async (): Promise<ShoppingItem[]> => {
    const raw = await readRow<ShoppingItem[]>("shopping");
    return raw ? normalizeShopping(raw) : [];
  };

  const readGroceries = async (): Promise<GroceryItem[]> =>
    (await readRow<GroceryItem[]>("groceries")) ?? [];

  const tasksStore: ListStore<Task> = {
    read: async () => {
      const raw = await readRow<Task[]>("tasks");
      if (!raw) return [];
      const { tasks, changed } = await normalizeTasks(raw, new Date(), {
        readShopping,
        readGroceries,
      });
      if (changed) await writeRow("tasks", tasks);
      return tasks;
    },
    write: (tasks) => writeRow("tasks", tasks),
  };

  const shoppingStore: ListStore<ShoppingItem> = {
    read: readShopping,
    write: (items) => writeRow("shopping", items),
  };

  const groceriesStore: ListStore<GroceryItem> = {
    read: readGroceries,
    write: (items) => writeRow("groceries", items),
  };

  const recurringStore: ListStore<RecurringItem> = {
    read: async () => {
      const raw = await readRow<RecurringItem[]>("recurring");
      if (!raw) return [];
      const { items, changed } = normalizeRecurring(raw, new Date());
      if (changed) await writeRow("recurring", items);
      return items;
    },
    write: (items) => writeRow("recurring", items),
  };

  const settingsStore: SettingsStore = {
    read: async () =>
      (await readRow<Record<string, unknown>>("settings")) ?? {},
    write: (settings) => writeRow("settings", settings),
  };

  // The archive Markdown document rides in the same table, JSON-encoded
  // as a plain string, so the Phase 2 import/export stays single-surface.
  const archiveStore: ArchiveStore = {
    read: () => readRow<string>("archive"),
    write: (markdown) => writeRow("archive", markdown),
  };

  return {
    tasksStore,
    shoppingStore,
    groceriesStore,
    recurringStore,
    settingsStore,
    archiveStore,
  };
};
