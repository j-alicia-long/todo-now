// Per-family store hooks. Each hook owns one entity family's client state
// and its API operations, built on the generic entity-list core. Cross-family
// coordination (e.g. completing a task that came from a shopping item) stays
// in the page that composes these hooks.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  applyStatusChange,
  type Task,
  type TaskStatus,
} from "../domain/task-rules";
import { useEntityList } from "./entity-store";
import { httpTransport, type Transport } from "./transport";

// ── Entity types ──

export type ShoppingItem = {
  id: string;
  title: string;
  done: boolean;
  archived: boolean;
  category: "want" | "need";
  links: string[];
  createdAt: string;
  doneAt: string | null;
};

export type GroceryItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

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

// ── Tasks ──

export const useTasks = (transport: Transport = httpTransport) => {
  const store = useEntityList<Task>("/api/tasks", "tasks", transport);

  const changeStatus = useCallback(
    (id: string, status: TaskStatus) =>
      store.mutate(
        (prev) =>
          prev.map((t) =>
            t.id === id ? applyStatusChange(t, { status }, new Date()) : t
          ),
        () => transport.put(`/api/tasks/${id}`, { status })
      ),
    [store, transport]
  );

  const trash = useCallback(
    (id: string) =>
      store.mutate(
        (prev) =>
          prev.map((t) =>
            t.id === id
              ? applyStatusChange(t, { status: "trashed" }, new Date())
              : t
          ),
        () => transport.del(`/api/tasks/${id}`)
      ),
    [store, transport]
  );

  return {
    tasks: store.items,
    loaded: store.loaded,
    refetch: store.refetch,
    add: store.create,
    update: store.update,
    changeStatus,
    trash,
    restore: (id: string) => changeStatus(id, "this-week"),
    removePermanently: (id: string) => store.remove(id, "?permanent=true"),
  };
};

// ── Shopping ──

export const useShopping = (transport: Transport = httpTransport) => {
  const store = useEntityList<ShoppingItem>(
    "/api/shopping",
    "shopping",
    transport
  );

  const toggle = (id: string) => {
    const item = store.items.find((i) => i.id === id);
    if (!item) return Promise.resolve(false);
    return store.update(id, { done: !item.done });
  };

  const toggleCategory = (id: string) => {
    const item = store.items.find((i) => i.id === id);
    if (!item) return Promise.resolve(false);
    return store.update(id, {
      category: item.category === "need" ? "want" : "need",
    });
  };

  return {
    items: store.items,
    refetch: store.refetch,
    add: (title: string) => store.create({ title, category: "need" }),
    toggle,
    setArchived: (id: string, archived: boolean) =>
      store.update(id, { archived }),
    updateLinks: (id: string, links: string[]) => store.update(id, { links }),
    toggleCategory,
    remove: store.remove,
  };
};

// ── Groceries ──

export const useGroceries = (transport: Transport = httpTransport) => {
  const store = useEntityList<GroceryItem>(
    "/api/groceries",
    "groceries",
    transport
  );

  const toggle = (id: string) => {
    const item = store.items.find((i) => i.id === id);
    if (!item) return Promise.resolve(false);
    return store.update(id, { done: !item.done });
  };

  return {
    items: store.items,
    refetch: store.refetch,
    add: (title: string) => store.create({ title }),
    toggle,
    remove: store.remove,
    clearBought: () =>
      store.mutate(
        (prev) => prev.filter((i) => !i.done),
        () => transport.del("/api/groceries/clear-bought")
      ),
  };
};

// ── Recurring ──

export const useRecurring = (transport: Transport = httpTransport) => {
  const store = useEntityList<RecurringItem>(
    "/api/recurring",
    "recurring",
    transport
  );

  // Weekly items toggle completedThisWeek; long-term items are "done" for
  // this occurrence, which the server answers by advancing their dueDate.
  const toggle = (id: string) => {
    const item = store.items.find((i) => i.id === id);
    if (!item) return Promise.resolve(false);
    if (isWeeklyRecurring(item)) {
      const next = !item.completedThisWeek;
      return store.mutate(
        (prev) =>
          prev.map((i) =>
            i.id === id
              ? {
                  ...i,
                  completedThisWeek: next,
                  lastCompletedAt: next
                    ? new Date().toISOString()
                    : i.lastCompletedAt,
                }
              : i
          ),
        () => transport.put(`/api/recurring/${id}`, { completedThisWeek: next })
      );
    }
    return store.mutate(
      (prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, lastCompletedAt: new Date().toISOString() } : i
        ),
      () => transport.put(`/api/recurring/${id}`, { done: true })
    );
  };

  return {
    items: store.items,
    refetch: store.refetch,
    add: store.create,
    update: store.update,
    toggle,
    remove: store.remove,
  };
};

// ── Settings ──

export type Settings = {
  showArea: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  showArea: true,
};

export type SyncedSettings = Settings & { theme?: "light" | "dark" };

const SETTINGS_KEY = "todo-settings";

const loadSettingsLocal = (): Settings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // corrupt localStorage entry — fall back to defaults
  }
  return { ...DEFAULT_SETTINGS };
};

const saveSettingsLocal = (s: Settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
};

type UseSettingsOptions = {
  transport?: Transport;
  /** Called once with the server's saved theme when settings first sync. */
  onServerTheme?: (theme: "light" | "dark") => void;
};

export const useSettings = ({
  transport = httpTransport,
  onServerTheme,
}: UseSettingsOptions = {}) => {
  const [settings, setSettings] = useState<Settings>(loadSettingsLocal);

  const onServerThemeRef = useRef(onServerTheme);
  onServerThemeRef.current = onServerTheme;

  // Fire-and-forget: settings sync must never block or break the UI.
  const push = useCallback(
    (s: SyncedSettings) => {
      transport.put("/api/settings", s).catch(() => {});
    },
    [transport]
  );

  useEffect(() => {
    transport
      .get<SyncedSettings>("/api/settings")
      .then((server) => {
        const { theme, ...labels } = server;
        const merged = { ...DEFAULT_SETTINGS, ...labels } as Settings;
        setSettings(merged);
        saveSettingsLocal(merged);
        if (theme) onServerThemeRef.current?.(theme);
      })
      .catch(() => {
        // network error — keep local settings
      });
  }, [transport]);

  const toggle = (key: keyof Settings, theme?: "light" | "dark") => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSettingsLocal(next);
      push({ ...next, theme });
      return next;
    });
  };

  const pushTheme = (theme: "light" | "dark") => {
    push({ ...settings, theme });
  };

  return { settings, toggle, pushTheme };
};
