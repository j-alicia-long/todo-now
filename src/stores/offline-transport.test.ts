// Tests for the offline transport at the Transport seam: a fake inner
// transport plus injected in-memory storage and connectivity — no fetch,
// no IndexedDB (the test DOM has none).

import { describe, expect, test } from "bun:test";
import type { Transport } from "./transport";
import { makeOfflineTransport, type OfflineStorage } from "./offline-transport";

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
  const storage: OfflineStorage = {
    readList: async (path) => lists.get(path),
    writeList: async (path, data) => {
      lists.set(path, data);
    },
  };
  return { storage, lists };
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
