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
import {
  advanceDueDate,
  applyRecurringCompletion,
  isWeeklyRecurring,
  type RecurringItem,
} from "../domain/recurrence";
import { useEntityList } from "./entity-store";
import { defaultTransport } from "./default-transport";
import type { Transport } from "./transport";
import {
  constructGroceryItem,
  constructRecurringItem,
  constructShoppingItem,
  constructTask,
} from "../domain/construct";
import { CARD_KEYS, type CardKey } from "../domain/card-rewards";
import type { ShoppingItem, GroceryItem } from "../domain/entities";

// Re-exported so store consumers keep a single import site.
export { isWeeklyRecurring, type RecurringItem };
export type { ShoppingItem, GroceryItem };

// ── Tasks ──

export const useTasks = (transport: Transport = defaultTransport) => {
  const store = useEntityList<Task>(
    "/api/tasks",
    "tasks",
    transport,
    constructTask
  );

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

export const useShopping = (transport: Transport = defaultTransport) => {
  const store = useEntityList<ShoppingItem>(
    "/api/shopping",
    "shopping",
    transport,
    constructShoppingItem
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

export const useGroceries = (transport: Transport = defaultTransport) => {
  const store = useEntityList<GroceryItem>(
    "/api/groceries",
    "groceries",
    transport,
    constructGroceryItem
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

export const useRecurring = (transport: Transport = defaultTransport) => {
  const store = useEntityList<RecurringItem>(
    "/api/recurring",
    "recurring",
    transport,
    constructRecurringItem
  );

  // Weekly items toggle completedThisWeek; long-term items are "done" for
  // this occurrence, which also advances their dueDate. Optimistic updates
  // share the server's domain rules.
  const toggle = (id: string) => {
    const item = store.items.find((i) => i.id === id);
    if (!item) return Promise.resolve(false);
    const change = isWeeklyRecurring(item)
      ? { completedThisWeek: !item.completedThisWeek }
      : { done: true };
    return store.mutate(
      (prev) =>
        prev.map((i) => {
          if (i.id !== id) return i;
          const now = new Date();
          const stamped = applyRecurringCompletion(i, change, now);
          return change.done ? advanceDueDate(stamped, now) : stamped;
        }),
      () => transport.put(`/api/recurring/${id}`, change)
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

export type BoardView = "columns" | "matrix";

export type Settings = {
  showArea: boolean;
  defaultBoardView: BoardView;
  /** Hide recurring task cards on the Board (the Recurring tab is unaffected). */
  hideRecurringOnBoard: boolean;
  /** Shake the phone to open the Reporter (Report Mode). */
  shakeToReport: boolean;
  /** Show the floating bug-report button. Report Mode is still reachable via
   *  ⌘⇧P (desktop) or shake (mobile) when this is off. */
  showReportButton: boolean;
  /** The Wallet: cards on hand, filtering /cards recommendations. */
  walletCards: CardKey[];
};

export const DEFAULT_SETTINGS: Settings = {
  showArea: true,
  defaultBoardView: "columns",
  hideRecurringOnBoard: false,
  shakeToReport: true,
  showReportButton: true,
  walletCards: [...CARD_KEYS],
};

/** Settings keys with boolean values — the ones `toggle` can flip. */
export type BooleanSettingKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

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
  transport = defaultTransport,
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

  const set = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
    theme?: "light" | "dark"
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettingsLocal(next);
      push({ ...next, theme });
      return next;
    });
  };

  const toggle = (key: BooleanSettingKey, theme?: "light" | "dark") => {
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

  return { settings, toggle, set, pushTheme };
};
