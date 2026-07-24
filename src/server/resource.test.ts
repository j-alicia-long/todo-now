// Route tests for the generic resource module: HTTP semantics exercised
// once through a bare Hono app and an in-memory ListStore — the second
// adapter that justifies the persistence seam.

import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import {
  createResourceRoutes,
  type FamilyConfig,
  type ListStore,
} from "./resource";

type Widget = {
  id: string;
  title: string;
  count: number;
  createdAt: string;
  stampedAt: string | null;
};

const makeMemoryStore = <T>(initial: T[]): ListStore<T> & { data: T[] } => {
  const box = {
    data: initial,
    read: async () => [...box.data],
    write: async (items: T[]) => {
      box.data = items;
    },
  };
  return box;
};

const baseFamily: FamilyConfig<Widget> = {
  writable: ["title", "count"],
  construct: (body, now) => ({
    id: "fixed-id",
    title: (body.title as string) || "Untitled",
    count: 0,
    createdAt: now.toISOString(),
    stampedAt: null,
  }),
};

const widget = (overrides: Partial<Widget> = {}): Widget => ({
  id: "w1",
  title: "Widget",
  count: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  stampedAt: null,
  ...overrides,
});

const mount = (
  family: FamilyConfig<Widget>,
  initial: Widget[]
): { app: Hono; store: ListStore<Widget> & { data: Widget[] } } => {
  const app = new Hono();
  const store = makeMemoryStore(initial);
  createResourceRoutes(app, "/api/widgets", family, store);
  return { app, store };
};

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

describe("GET collection", () => {
  test("returns the store's items", async () => {
    const { app } = mount(baseFamily, [widget()]);
    const res = await app.request("/api/widgets");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([widget()]);
  });
});

describe("POST", () => {
  test("constructs, appends, and returns 201 with the item", async () => {
    const { app, store } = mount(baseFamily, [widget()]);
    const res = await app.request(
      "/api/widgets",
      json("POST", { title: "New" })
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as Widget;
    expect(created.title).toBe("New");
    expect(store.data).toHaveLength(2);
    expect(store.data[1]).toEqual(created);
  });
});

describe("PUT", () => {
  test("merges only whitelisted fields", async () => {
    const { app, store } = mount(baseFamily, [widget()]);
    const res = await app.request(
      "/api/widgets/w1",
      json("PUT", {
        title: "Renamed",
        count: 5,
        id: "hacked",
        createdAt: "1999-01-01",
        stampedAt: "1999-01-01",
      })
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as Widget;
    expect(updated.title).toBe("Renamed");
    expect(updated.count).toBe(5);
    // Non-whitelisted fields can't be smuggled in
    expect(updated.id).toBe("w1");
    expect(updated.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(updated.stampedAt).toBeNull();
    expect(store.data[0]).toEqual(updated);
  });

  test("runs applyUpdate against the pre-merge item", async () => {
    const family: FamilyConfig<Widget> = {
      ...baseFamily,
      applyUpdate: (prev, merged, body, now) =>
        body.stamp === true && prev.stampedAt === null
          ? { ...merged, stampedAt: now.toISOString() }
          : merged,
    };
    const { app } = mount(family, [widget()]);
    const res = await app.request(
      "/api/widgets/w1",
      json("PUT", { stamp: true })
    );
    const updated = (await res.json()) as Widget;
    expect(updated.stampedAt).not.toBeNull();
  });

  test("404s on unknown id", async () => {
    const { app } = mount(baseFamily, [widget()]);
    const res = await app.request("/api/widgets/nope", json("PUT", {}));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});

describe("DELETE", () => {
  test("hard-deletes by default and returns {deleted: true}", async () => {
    const { app, store } = mount(baseFamily, [widget()]);
    const res = await app.request("/api/widgets/w1", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(store.data).toHaveLength(0);
  });

  test("applyRemove can soft-delete, honoring ?permanent=true", async () => {
    const family: FamilyConfig<Widget> = {
      ...baseFamily,
      applyRemove: (prev, { permanent }, now) =>
        permanent ? null : { ...prev, stampedAt: now.toISOString() },
    };

    const soft = mount(family, [widget()]);
    await soft.app.request("/api/widgets/w1", { method: "DELETE" });
    expect(soft.store.data).toHaveLength(1);
    expect(soft.store.data[0].stampedAt).not.toBeNull();

    const hard = mount(family, [widget()]);
    await hard.app.request("/api/widgets/w1?permanent=true", {
      method: "DELETE",
    });
    expect(hard.store.data).toHaveLength(0);
  });

  test("404s on unknown id", async () => {
    const { app } = mount(baseFamily, [widget()]);
    const res = await app.request("/api/widgets/nope", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
