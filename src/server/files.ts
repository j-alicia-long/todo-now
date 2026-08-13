// File-backed store adapters for the ListStore seam. Each family
// persists to one JSON file in data/. The legacy migrations and
// normalize-on-read logic are storage-agnostic and live in
// normalize.ts (shared with the D1 adapter); this module owns only the
// file I/O and the write-back-on-change plumbing.

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import type { Task } from "../domain/task-rules";
import type { RecurringItem } from "../domain/recurrence";
import type { ShoppingItem, GroceryItem } from "../domain/entities";
import {
  normalizeTasks,
  normalizeShopping,
  normalizeRecurring,
} from "./normalize";
import type { ListStore } from "./resource";
import type { ReportWriter } from "./reports";
import type { SettingsStore, ArchiveStore } from "./app";

// In production on Zo, data lives OUTSIDE the Mutagen-synced personal-os
// tree so a broken/re-created file sync can never overwrite the live
// database (see docs/DEPLOY.md). Resolution order:
//   1. DATA_DIR env var (explicit override)
//   2. /home/workspace/todo-data — the Zo production location, used
//      whenever it exists so no env configuration is required there
//   3. ./data in the repo — local development and tests
const ZO_DATA_DIR = "/home/workspace/todo-data";
export const dataDir =
  process.env.DATA_DIR ??
  (existsSync(ZO_DATA_DIR) ? ZO_DATA_DIR : import.meta.dir + "/../../data");

const TASKS_PATH = dataDir + "/tasks.json";
const SHOPPING_PATH = dataDir + "/shopping.json";
const GROCERY_PATH = dataDir + "/groceries.json";
const RECURRING_PATH = dataDir + "/recurring.json";
const SETTINGS_PATH = dataDir + "/settings.json";

const readJsonList = async <T>(path: string): Promise<T[] | null> => {
  try {
    const file = Bun.file(path);
    if (await file.exists()) return JSON.parse(await file.text()) as T[];
  } catch {
    // corrupt or missing data file — caller falls back to empty list
  }
  return null;
};

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await Bun.write(path, JSON.stringify(value, null, 2));
};

// ── Tasks ──

export const readTasks = async (): Promise<Task[]> => {
  const raw = await readJsonList<Task>(TASKS_PATH);
  if (!raw) return [];
  const { tasks, changed } = await normalizeTasks(raw, new Date(), {
    readShopping,
    readGroceries,
  });
  if (changed) await writeTasks(tasks);
  return tasks;
};

export const writeTasks = (tasks: Task[]) => writeJson(TASKS_PATH, tasks);

export const tasksStore: ListStore<Task> = {
  read: readTasks,
  write: writeTasks,
};

// ── Shopping Items ──

export const readShopping = async (): Promise<ShoppingItem[]> => {
  const raw = await readJsonList<ShoppingItem>(SHOPPING_PATH);
  if (!raw) return [];
  return normalizeShopping(raw);
};

export const writeShopping = (items: ShoppingItem[]) =>
  writeJson(SHOPPING_PATH, items);

export const shoppingStore: ListStore<ShoppingItem> = {
  read: readShopping,
  write: writeShopping,
};

// ── Grocery Items ──

export const readGroceries = async (): Promise<GroceryItem[]> =>
  (await readJsonList<GroceryItem>(GROCERY_PATH)) ?? [];

export const writeGroceries = (items: GroceryItem[]) =>
  writeJson(GROCERY_PATH, items);

export const groceriesStore: ListStore<GroceryItem> = {
  read: readGroceries,
  write: writeGroceries,
};

// ── Recurring Items ──

export const readRecurring = async (): Promise<RecurringItem[]> => {
  const raw = await readJsonList<RecurringItem>(RECURRING_PATH);
  if (!raw) return [];
  const { items, changed } = normalizeRecurring(raw, new Date());
  if (changed) await writeRecurring(items);
  return items;
};

export const writeRecurring = (items: RecurringItem[]) =>
  writeJson(RECURRING_PATH, items);

export const recurringStore: ListStore<RecurringItem> = {
  read: readRecurring,
  write: writeRecurring,
};

// ── Reports ──
// File adapter for the ReportWriter seam: Reports land in <reports>/ as
// Markdown, one flat folder — status lives on each Report's GitHub
// issue, not in folder structure. Unlike the live database, Reports
// live INSIDE the Mutagen-synced personal-os tree on Zo so they sync to
// the Mac, where dev agents can read the full-fidelity copies (see
// reports/AGENTS.md there). They stay out of git because Snippets can
// contain personal task text; only sanitized issue bodies go public.
// Resolution:
//   1. REPORTS_DIR env var (explicit override)
//   2. the Zo synced-tree location, used whenever it exists
//   3. <dataDir>/reports — local development and tests
const ZO_REPORTS_DIR =
  "/home/workspace/personal-os/02-projects/todo-app/reports";
const reportsDir =
  process.env.REPORTS_DIR ??
  (existsSync(ZO_REPORTS_DIR) ? ZO_REPORTS_DIR : dataDir + "/reports");

export const reportsWriter: ReportWriter = {
  save: async (fileName, markdown) => {
    await mkdir(reportsDir, { recursive: true });
    // De-collide: same-minute reports get a numeric suffix.
    let name = fileName;
    for (let i = 2; await Bun.file(`${reportsDir}/${name}`).exists(); i++) {
      name = fileName.replace(/\.md$/, `-${i}.md`);
    }
    await Bun.write(`${reportsDir}/${name}`, markdown);
    return name;
  },
  update: async (fileName, markdown) => {
    await Bun.write(`${reportsDir}/${fileName}`, markdown);
  },
};

// ── Settings ──
// Not a list family: a single object with GET/PUT, served bespoke in
// the app module.

export const readSettings = async (): Promise<Record<string, unknown>> => {
  try {
    const file = Bun.file(SETTINGS_PATH);
    if (await file.exists()) {
      return JSON.parse(await file.text());
    }
  } catch {
    // corrupt or missing data file — fall back to empty settings
  }
  return {};
};

export const writeSettings = (settings: Record<string, unknown>) =>
  writeJson(SETTINGS_PATH, settings);

export const settingsStore: SettingsStore = {
  read: readSettings,
  write: writeSettings,
};

// ── Weekly Archive ──
// One growing Markdown document next to the JSON files.

const ARCHIVE_PATH = dataDir + "/archive.md";

export const archiveStore: ArchiveStore = {
  read: async () => {
    const file = Bun.file(ARCHIVE_PATH);
    return (await file.exists()) ? await file.text() : null;
  },
  write: async (markdown) => {
    await Bun.write(ARCHIVE_PATH, markdown);
  },
};
