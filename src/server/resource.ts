// Generic resource module: serves the CRUD routes for one list family.
// The interface is one registration call per family; behind it live the
// HTTP semantics every family shares (JSON parsing, find-by-id, 404s,
// whitelisted merges, response shapes). Family differences enter only
// through the pure hooks in a FamilyConfig, and persistence enters only
// through the injected ListStore seam — file-backed in production,
// in-memory in tests.

import type { Hono } from "hono";

/** Persistence seam: the resource module never touches storage directly. */
export type ListStore<T> = {
  read: () => Promise<T[]>;
  write: (items: T[]) => Promise<void>;
};

export type RemoveOptions = {
  /** True when the request carried `?permanent=true`. */
  permanent: boolean;
};

export type FamilyConfig<T extends { id: string }> = {
  /**
   * Build a new item from a POST body. Owns defaults, ids, and
   * created-at stamping.
   */
  construct: (body: Record<string, unknown>, now: Date) => T;
  /**
   * Fields a PUT may change. Everything else — ids, timestamps,
   * lifecycle fields — is owned by the hooks below.
   */
  writable: readonly string[];
  /**
   * Domain rules applied after the whitelisted merge. Receives the
   * pre-merge item (for "already done" checks), the merged item, and
   * the raw body (for command-style fields like `done` that aren't
   * part of the entity). Defaults to the merged item unchanged.
   */
  applyUpdate?: (
    prev: T,
    merged: T,
    body: Record<string, unknown>,
    now: Date
  ) => T;
  /**
   * How the family leaves the list. Return the replacement item for a
   * soft delete, or null to remove the row. Defaults to null.
   */
  applyRemove?: (prev: T, opts: RemoveOptions, now: Date) => T | null;
};

const mergeWritable = <T extends { id: string }>(
  prev: T,
  body: Record<string, unknown>,
  writable: readonly string[]
): T => {
  const merged = { ...prev };
  for (const key of writable) {
    if (key in body) {
      (merged as Record<string, unknown>)[key] = body[key];
    }
  }
  return merged;
};

/** Mount GET/POST/PUT/DELETE for one family at `endpoint`. */
export const createResourceRoutes = <T extends { id: string }>(
  app: Hono,
  endpoint: string,
  config: FamilyConfig<T>,
  store: ListStore<T>
): void => {
  app.get(endpoint, async (c) => {
    const items = await store.read();
    return c.json(items);
  });

  app.post(endpoint, async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const items = await store.read();
    const item = config.construct(body, new Date());
    items.push(item);
    await store.write(items);
    return c.json(item, 201);
  });

  app.put(`${endpoint}/:id`, async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json()) as Record<string, unknown>;
    const items = await store.read();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return c.json({ error: "Not found" }, 404);

    const prev = items[idx];
    const merged = mergeWritable(prev, body, config.writable);
    items[idx] = config.applyUpdate
      ? config.applyUpdate(prev, merged, body, new Date())
      : merged;
    await store.write(items);
    return c.json(items[idx]);
  });

  app.delete(`${endpoint}/:id`, async (c) => {
    const id = c.req.param("id");
    const permanent = c.req.query("permanent") === "true";
    const items = await store.read();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return c.json({ error: "Not found" }, 404);

    const replacement = config.applyRemove
      ? config.applyRemove(items[idx], { permanent }, new Date())
      : null;
    if (replacement === null) {
      items.splice(idx, 1);
    } else {
      items[idx] = replacement;
    }
    await store.write(items);
    return c.json({ deleted: true });
  });
};
