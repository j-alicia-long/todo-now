import { describe, expect, test } from "bun:test";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { Transport } from "./transport";
import {
  useTasks,
  useShopping,
  useGroceries,
  useRecurring,
  type ShoppingItem,
  type GroceryItem,
  type RecurringItem,
} from "./hooks";
import type { Task } from "../domain/task-rules";

// ── In-memory transport fixture ──
// Mimics the server's REST conventions for a single collection endpoint,
// recording every call so tests can assert on the wire traffic.

type Call = { method: string; path: string; body?: unknown };

const makeMemoryTransport = <T extends { id: string }>(
  endpoint: string,
  initial: T[]
) => {
  let items = structuredClone(initial);
  const calls: Call[] = [];
  let failNext = false;

  const transport: Transport = {
    get: async <R>(path: string): Promise<R> => {
      calls.push({ method: "GET", path });
      if (path !== endpoint) throw new Error(`unexpected GET ${path}`);
      return structuredClone(items) as R;
    },
    post: async <R>(path: string, body: unknown): Promise<R> => {
      calls.push({ method: "POST", path, body });
      if (failNext) {
        failNext = false;
        throw new Error("simulated failure");
      }
      const item = { id: `id-${items.length + 1}`, ...(body as object) } as T;
      items.push(item);
      return structuredClone(item) as unknown as R;
    },
    put: async <R>(path: string, body: unknown): Promise<R> => {
      calls.push({ method: "PUT", path, body });
      if (failNext) {
        failNext = false;
        throw new Error("simulated failure");
      }
      const id = path.slice(`${endpoint}/`.length);
      items = items.map((i) =>
        i.id === id ? { ...i, ...(body as object) } : i
      );
      return structuredClone(items.find((i) => i.id === id)) as R;
    },
    del: async (path: string): Promise<void> => {
      calls.push({ method: "DELETE", path });
      if (failNext) {
        failNext = false;
        throw new Error("simulated failure");
      }
      const id = path.slice(`${endpoint}/`.length).replace(/\?.*$/, "");
      items = items.filter((i) => i.id !== id);
    },
  };

  return {
    transport,
    calls,
    getItems: () => items,
    setItems: (next: T[]) => {
      items = structuredClone(next);
    },
    failNextMutation: () => {
      failNext = true;
    },
  };
};

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "A task",
  status: "this-week",
  done: false,
  priority: "medium",
  effort: "medium",
  decisionLoad: "medium",
  area: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
  deletedAt: null,
  dueDate: null,
  source: "board",
  sourceItemId: null,
  ...overrides,
});

const makeRecurring = (
  overrides: Partial<RecurringItem> = {}
): RecurringItem => ({
  id: "r1",
  title: "Recurring",
  frequency: "weekly",
  dayOfWeek: null,
  repeatEvery: 1,
  repeatUnit: "week",
  repeatDays: [],
  endsType: "never",
  endsOn: null,
  endsAfter: null,
  note: "",
  link: "",
  completedThisWeek: false,
  lastCompletedAt: null,
  dueDate: null,
  area: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  category: "task",
  ...overrides,
});

// ── Tasks ──

describe("useTasks", () => {
  test("fetches tasks on mount and reports loaded", async () => {
    const fx = makeMemoryTransport("/api/tasks", [makeTask()]);
    const { result } = renderHook(() => useTasks(fx.transport));

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].id).toBe("t1");
  });

  test("add POSTs and appends the server response", async () => {
    const fx = makeMemoryTransport<Task>("/api/tasks", []);
    const { result } = renderHook(() => useTasks(fx.transport));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.add({ title: "New", status: "this-week" });
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(fx.calls.at(-1)).toMatchObject({
      method: "POST",
      path: "/api/tasks",
      body: { title: "New", status: "this-week" },
    });
  });

  test("changeStatus applies lifecycle rules optimistically and PUTs only the status", async () => {
    const fx = makeMemoryTransport("/api/tasks", [makeTask()]);
    const { result } = renderHook(() => useTasks(fx.transport));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(async () => {
      await result.current.changeStatus("t1", "done");
    });

    const t = result.current.tasks[0];
    expect(t.status).toBe("done");
    expect(t.done).toBe(true);
    expect(t.completedAt).not.toBeNull();
    expect(fx.calls.at(-1)).toMatchObject({
      method: "PUT",
      path: "/api/tasks/t1",
      body: { status: "done" },
    });
  });

  test("trash stamps deletedAt locally and sends DELETE", async () => {
    const fx = makeMemoryTransport("/api/tasks", [makeTask()]);
    const { result } = renderHook(() => useTasks(fx.transport));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(async () => {
      await result.current.trash("t1");
    });

    const t = result.current.tasks[0];
    expect(t.status).toBe("trashed");
    expect(t.deletedAt).not.toBeNull();
    expect(fx.calls.at(-1)).toMatchObject({
      method: "DELETE",
      path: "/api/tasks/t1",
    });
  });

  test("removePermanently drops the task and DELETEs with ?permanent=true", async () => {
    const fx = makeMemoryTransport("/api/tasks", [makeTask()]);
    const { result } = renderHook(() => useTasks(fx.transport));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(async () => {
      await result.current.removePermanently("t1");
    });

    expect(result.current.tasks).toHaveLength(0);
    expect(fx.calls.at(-1)).toMatchObject({
      method: "DELETE",
      path: "/api/tasks/t1?permanent=true",
    });
  });

  test("failed mutation reconciles by refetching server state", async () => {
    const fx = makeMemoryTransport("/api/tasks", [makeTask()]);
    const { result } = renderHook(() => useTasks(fx.transport));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    fx.failNextMutation();
    let ok = true;
    await act(async () => {
      ok = await result.current.changeStatus("t1", "done");
    });

    expect(ok).toBe(false);
    // Optimistic change rolled back to the server's version.
    await waitFor(() =>
      expect(result.current.tasks[0].status).toBe("this-week")
    );
  });
});

// ── Shopping ──

const makeShoppingItem = (
  overrides: Partial<ShoppingItem> = {}
): ShoppingItem => ({
  id: "s1",
  title: "Socks",
  done: false,
  archived: false,
  category: "need",
  links: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  doneAt: null,
  ...overrides,
});

describe("useShopping", () => {
  test("add sends category 'need' by default", async () => {
    const fx = makeMemoryTransport<ShoppingItem>("/api/shopping", []);
    const { result } = renderHook(() => useShopping(fx.transport));
    await waitFor(() =>
      expect(fx.calls.some((c) => c.method === "GET")).toBe(true)
    );

    await act(async () => {
      await result.current.add("Socks");
    });

    expect(fx.calls.at(-1)).toMatchObject({
      method: "POST",
      body: { title: "Socks", category: "need" },
    });
    expect(result.current.items).toHaveLength(1);
  });

  test("toggle flips done optimistically and PUTs the new value", async () => {
    const fx = makeMemoryTransport("/api/shopping", [makeShoppingItem()]);
    const { result } = renderHook(() => useShopping(fx.transport));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.toggle("s1");
    });

    expect(result.current.items[0].done).toBe(true);
    expect(fx.calls.at(-1)).toMatchObject({
      method: "PUT",
      path: "/api/shopping/s1",
      body: { done: true },
    });
  });

  test("toggleCategory flips between need and want", async () => {
    const fx = makeMemoryTransport("/api/shopping", [makeShoppingItem()]);
    const { result } = renderHook(() => useShopping(fx.transport));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.toggleCategory("s1");
    });

    expect(result.current.items[0].category).toBe("want");
    expect(fx.calls.at(-1)).toMatchObject({
      method: "PUT",
      body: { category: "want" },
    });
  });

  test("setArchived updates the archived flag", async () => {
    const fx = makeMemoryTransport("/api/shopping", [makeShoppingItem()]);
    const { result } = renderHook(() => useShopping(fx.transport));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.setArchived("s1", true);
    });

    expect(result.current.items[0].archived).toBe(true);
    expect(fx.calls.at(-1)).toMatchObject({
      method: "PUT",
      body: { archived: true },
    });
  });
});

// ── Groceries ──

describe("useGroceries", () => {
  const makeGrocery = (overrides: Partial<GroceryItem> = {}): GroceryItem => ({
    id: "g1",
    title: "Milk",
    done: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });

  test("clearBought drops done items locally and DELETEs clear-bought", async () => {
    const fx = makeMemoryTransport("/api/groceries", [
      makeGrocery({ id: "g1", done: true }),
      makeGrocery({ id: "g2", done: false }),
    ]);
    const { result } = renderHook(() => useGroceries(fx.transport));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => {
      await result.current.clearBought();
    });

    expect(result.current.items.map((i) => i.id)).toEqual(["g2"]);
    expect(fx.calls.at(-1)).toMatchObject({
      method: "DELETE",
      path: "/api/groceries/clear-bought",
    });
  });
});

// ── Recurring ──

describe("useRecurring", () => {
  test("weekly item toggles completedThisWeek", async () => {
    const fx = makeMemoryTransport("/api/recurring", [makeRecurring()]);
    const { result } = renderHook(() => useRecurring(fx.transport));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.toggle("r1");
    });

    expect(result.current.items[0].completedThisWeek).toBe(true);
    expect(result.current.items[0].lastCompletedAt).not.toBeNull();
    expect(fx.calls.at(-1)).toMatchObject({
      method: "PUT",
      path: "/api/recurring/r1",
      body: { completedThisWeek: true },
    });
  });

  test("un-toggling a weekly item keeps lastCompletedAt", async () => {
    const completedAt = "2026-02-01T00:00:00.000Z";
    const fx = makeMemoryTransport("/api/recurring", [
      makeRecurring({ completedThisWeek: true, lastCompletedAt: completedAt }),
    ]);
    const { result } = renderHook(() => useRecurring(fx.transport));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.toggle("r1");
    });

    expect(result.current.items[0].completedThisWeek).toBe(false);
    expect(result.current.items[0].lastCompletedAt).toBe(completedAt);
    expect(fx.calls.at(-1)).toMatchObject({
      body: { completedThisWeek: false },
    });
  });

  test("long-term item PUTs done:true and stamps lastCompletedAt locally", async () => {
    const fx = makeMemoryTransport("/api/recurring", [
      makeRecurring({ repeatUnit: "month", frequency: "long-term" }),
    ]);
    const { result } = renderHook(() => useRecurring(fx.transport));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.toggle("r1");
    });

    expect(result.current.items[0].lastCompletedAt).not.toBeNull();
    expect(fx.calls.at(-1)).toMatchObject({
      method: "PUT",
      path: "/api/recurring/r1",
      body: { done: true },
    });
  });
});
