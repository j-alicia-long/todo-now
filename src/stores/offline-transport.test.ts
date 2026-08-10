// Tests for the offline transport at the Transport seam: a fake inner
// transport plus injected in-memory storage and connectivity — no fetch,
// no IndexedDB (the test DOM has none).

import { describe, expect, test } from "bun:test";
import type { Transport } from "./transport";
import {
  makeOfflineTransport,
  type OfflineState,
  type OfflineStorage,
  type QueuedOp,
} from "./offline-transport";

type Call = { method: string; path: string; body?: unknown };

const makeInner = () => {
  const calls: Call[] = [];
  let failWith: Error | null = null;
  const maybeFail = () => {
    if (failWith) throw failWith;
  };
  const inner: Transport = {
    get: async <T>(path: string): Promise<T> => {
      calls.push({ method: "GET", path });
      maybeFail();
      return [{ id: "t1", title: "From server" }] as T;
    },
    post: async <T>(path: string, body: unknown): Promise<T> => {
      calls.push({ method: "POST", path, body });
      maybeFail();
      return body as T;
    },
    put: async <T>(path: string, body: unknown): Promise<T> => {
      calls.push({ method: "PUT", path, body });
      maybeFail();
      return body as T;
    },
    del: async (path: string): Promise<void> => {
      calls.push({ method: "DELETE", path });
      maybeFail();
    },
  };
  return {
    inner,
    calls,
    failWith: (e: Error | null) => {
      failWith = e;
    },
  };
};

const makeMemoryStorage = () => {
  const lists = new Map<string, unknown>();
  let queue: QueuedOp[] = [];
  const storage: OfflineStorage = {
    readList: async (path) => lists.get(path),
    writeList: async (path, data) => {
      lists.set(path, data);
    },
    readQueue: async () => [...queue],
    writeQueue: async (ops) => {
      queue = [...ops];
    },
  };
  return { storage, lists, getQueue: () => queue };
};

const networkError = () => new TypeError("fetch failed");
const serverError = () => new Error("GET /api/tasks failed: 500");

describe("offline transport — reads", () => {
  test("successful GET mirrors the response into storage", async () => {
    const fx = makeInner();
    const { storage, lists } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => true);

    const result = await transport.get("/api/tasks");

    expect(result).toEqual([{ id: "t1", title: "From server" }]);
    expect(lists.get("/api/tasks")).toEqual([
      { id: "t1", title: "From server" },
    ]);
  });

  test("offline GET serves the last cached list", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    await storage.writeList("/api/tasks", [{ id: "t9", title: "Cached" }]);
    fx.failWith(networkError());

    const result = await transport.get("/api/tasks");

    expect(result).toEqual([{ id: "t9", title: "Cached" }]);
  });

  test("network failure while navigator claims online still serves cache", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => true);
    await storage.writeList("/api/tasks", [{ id: "t9", title: "Cached" }]);
    fx.failWith(networkError());

    const result = await transport.get("/api/tasks");

    expect(result).toEqual([{ id: "t9", title: "Cached" }]);
  });

  test("server error (HTTP 4xx/5xx) still throws", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => true);
    await storage.writeList("/api/tasks", [{ id: "t9", title: "Cached" }]);
    fx.failWith(serverError());

    expect(transport.get("/api/tasks")).rejects.toThrow("failed: 500");
  });

  test("offline GET with no cached list rethrows", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    fx.failWith(networkError());

    expect(transport.get("/api/tasks")).rejects.toThrow("fetch failed");
  });
});

describe("offline transport — write queue", () => {
  test("offline mutations enqueue in order and resolve successfully", async () => {
    const fx = makeInner();
    const { storage, getQueue } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    fx.failWith(networkError());

    const created = await transport.post("/api/tasks", {
      id: "n1",
      title: "Offline task",
    });
    await transport.put("/api/tasks/n1", { done: true });
    await transport.del("/api/tasks/n1");

    // POST resolves with its own body so the optimistic item sticks.
    expect(created).toEqual({ id: "n1", title: "Offline task" });
    expect(getQueue()).toEqual([
      {
        method: "POST",
        path: "/api/tasks",
        body: { id: "n1", title: "Offline task" },
      },
      { method: "PUT", path: "/api/tasks/n1", body: { done: true } },
      { method: "DELETE", path: "/api/tasks/n1" },
    ]);
  });

  test("server error (4xx/5xx) on a mutation still throws, nothing queued", async () => {
    const fx = makeInner();
    const { storage, getQueue } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => true);
    fx.failWith(serverError());

    expect(transport.put("/api/tasks/t1", { done: true })).rejects.toThrow(
      "failed: 500"
    );
    expect(getQueue()).toEqual([]);
  });

  test("mutation while queue is non-empty enqueues even if online (order preserved)", async () => {
    const fx = makeInner();
    const { storage, getQueue } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => true);
    await storage.writeQueue([
      { method: "PUT", path: "/api/tasks/t1", body: { done: true } },
    ]);

    await transport.put("/api/tasks/t1", { title: "Renamed" });

    expect(fx.calls).toEqual([]); // never hit the network out of order
    expect(getQueue()).toEqual([
      { method: "PUT", path: "/api/tasks/t1", body: { done: true } },
      { method: "PUT", path: "/api/tasks/t1", body: { title: "Renamed" } },
    ]);
  });
});

describe("offline transport — reads overlay the queue", () => {
  test("offline GET shows queued creates, edits, and deletes", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    await storage.writeList("/api/tasks", [
      { id: "t1", title: "Cached", done: false },
      { id: "t2", title: "Doomed", done: false },
    ]);
    fx.failWith(networkError());

    await transport.post("/api/tasks", { id: "n1", title: "New", done: false });
    await transport.put("/api/tasks/t1", { done: true });
    await transport.del("/api/tasks/t2");

    const result = await transport.get<unknown>("/api/tasks");

    expect(result).toEqual([
      { id: "t1", title: "Cached", done: true },
      { id: "n1", title: "New", done: false },
    ]);
  });

  test("offline create then edit of the same item overlays cleanly", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    await storage.writeList("/api/tasks", []);
    fx.failWith(networkError());

    await transport.post("/api/tasks", { id: "n1", title: "New", done: false });
    await transport.put("/api/tasks/n1", { title: "Renamed" });

    expect(await transport.get<unknown>("/api/tasks")).toEqual([
      { id: "n1", title: "Renamed", done: false },
    ]);
  });

  test("queued clear-bought drops done items from the grocery overlay", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    await storage.writeList("/api/groceries", [
      { id: "g1", title: "Milk", done: true },
      { id: "g2", title: "Eggs", done: false },
    ]);
    fx.failWith(networkError());

    await transport.del("/api/groceries/clear-bought");

    expect(await transport.get<unknown>("/api/groceries")).toEqual([
      { id: "g2", title: "Eggs", done: false },
    ]);
  });

  test("queue written by one transport instance overlays in a fresh one (reload)", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const first = makeOfflineTransport(fx.inner, storage, () => false);
    await storage.writeList("/api/tasks", []);
    fx.failWith(networkError());
    await first.post("/api/tasks", { id: "n1", title: "Survives" });

    const second = makeOfflineTransport(fx.inner, storage, () => false);

    expect(await second.get<unknown>("/api/tasks")).toEqual([
      { id: "n1", title: "Survives" },
    ]);
  });
});

describe("offline transport — replay", () => {
  test("replay sends queued ops in order, clears the queue, and notifies", async () => {
    const fx = makeInner();
    const { storage, getQueue } = makeMemoryStorage();
    let synced = 0;
    const transport = makeOfflineTransport(fx.inner, storage, () => false, {
      onSynced: () => {
        synced += 1;
      },
    });
    fx.failWith(networkError());
    await transport.post("/api/tasks", { id: "n1", title: "New" });
    await transport.put("/api/tasks/n1", { done: true });
    fx.failWith(null);
    fx.calls.length = 0;

    await transport.replay();

    expect(fx.calls).toEqual([
      { method: "POST", path: "/api/tasks", body: { id: "n1", title: "New" } },
      { method: "PUT", path: "/api/tasks/n1", body: { done: true } },
    ]);
    expect(getQueue()).toEqual([]);
    expect(synced).toBe(1);
  });

  test("replay stops on a network failure and keeps the remaining queue", async () => {
    const fx = makeInner();
    const { storage, getQueue } = makeMemoryStorage();
    let synced = 0;
    const transport = makeOfflineTransport(fx.inner, storage, () => false, {
      onSynced: () => {
        synced += 1;
      },
    });
    fx.failWith(networkError());
    await transport.post("/api/tasks", { id: "n1", title: "New" });
    await transport.put("/api/tasks/n1", { done: true });

    await transport.replay(); // still offline: nothing sent

    expect(getQueue()).toHaveLength(2);
    expect(synced).toBe(0);
  });

  test("replay drops an op the server rejects and continues", async () => {
    const fx = makeInner();
    const { storage, getQueue } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    fx.failWith(networkError());
    await transport.put("/api/tasks/gone", { done: true });
    await transport.put("/api/tasks/t1", { done: true });
    fx.failWith(null);

    // First replayed op gets a server rejection, second succeeds.
    const innerPut = fx.inner.put;
    let first = true;
    fx.inner.put = async <T>(path: string, body: unknown): Promise<T> => {
      if (first) {
        first = false;
        throw serverError();
      }
      return innerPut<T>(path, body);
    };
    fx.calls.length = 0;

    await transport.replay();

    expect(getQueue()).toEqual([]);
    expect(fx.calls.filter((c) => c.method === "PUT")).toHaveLength(1);
  });

  test("replay with an empty queue does not notify", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    let synced = 0;
    const transport = makeOfflineTransport(fx.inner, storage, () => true, {
      onSynced: () => {
        synced += 1;
      },
    });

    await transport.replay();

    expect(synced).toBe(0);
  });
});

describe("offline transport — observable state", () => {
  test("starts with the persisted queue's pending count", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    await storage.writeQueue([
      { method: "PUT", path: "/api/tasks/t1", body: { done: true } },
    ]);

    const transport = makeOfflineTransport(fx.inner, storage, () => true);
    await new Promise((r) => setTimeout(r, 0)); // let the startup queue read settle

    expect(transport.getState().pending).toBe(1);
  });

  test("queued mutation marks offline and bumps pending; subscribers hear it", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    const seen: number[] = [];
    transport.subscribe((s) => seen.push(s.pending));
    fx.failWith(networkError());

    await transport.put("/api/tasks/t1", { done: true });
    await transport.del("/api/tasks/t1");

    expect(transport.getState()).toMatchObject({ offline: true, pending: 2 });
    expect(seen).toContain(1);
    expect(seen).toContain(2);
  });

  test("a successful request marks online again", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    fx.failWith(networkError());
    await storage.writeList("/api/tasks", []);
    await transport.get("/api/tasks");
    expect(transport.getState().offline).toBe(true);

    fx.failWith(null);
    await transport.get("/api/tasks");

    expect(transport.getState().offline).toBe(false);
  });

  test("replay drains pending back to zero and clears offline", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    fx.failWith(networkError());
    await transport.put("/api/tasks/t1", { done: true });
    await transport.put("/api/tasks/t2", { done: true });
    fx.failWith(null);

    await transport.replay();

    expect(transport.getState()).toEqual({
      offline: false,
      pending: 0,
      syncing: false,
    });
  });

  test("replay reports syncing while it runs, then clears it on success", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    fx.failWith(networkError());
    await transport.put("/api/tasks/t1", { done: true });
    fx.failWith(null);
    const seen: OfflineState[] = [];
    transport.subscribe((s) => seen.push({ ...s }));

    await transport.replay();

    expect(seen.some((s) => s.syncing)).toBe(true);
    expect(transport.getState()).toEqual({
      offline: false,
      pending: 0,
      syncing: false,
    });
  });

  test("replay stopped by a network failure clears syncing and keeps the queue", async () => {
    const fx = makeInner();
    const { storage } = makeMemoryStorage();
    const transport = makeOfflineTransport(fx.inner, storage, () => false);
    fx.failWith(networkError());
    await transport.put("/api/tasks/t1", { done: true });

    await transport.replay(); // still offline: first send fails

    expect(transport.getState()).toEqual({
      offline: true,
      pending: 1,
      syncing: false,
    });
  });
});
