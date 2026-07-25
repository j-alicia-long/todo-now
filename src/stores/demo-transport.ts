// Demo transport: an in-memory adapter for the Transport seam, used by
// the static demo build (VITE_DEMO) where there is no API server. It
// emulates the server's REST semantics by reusing the same FamilyConfig
// hooks (src/server/families.ts) the real routes run, so demo behavior
// matches production. State lives in module memory and resets on reload.

import { mergeWritable, type FamilyConfig } from "../server/resource";
import {
  tasksFamily,
  shoppingFamily,
  groceriesFamily,
  recurringFamily,
} from "../server/families";
import type { GroceryItem } from "../domain/entities";
import type { Transport } from "./transport";
import {
  demoTasks,
  demoShopping,
  demoGroceries,
  demoRecurring,
  demoSettings,
} from "./demo-data";

type Collection = {
  list: () => unknown;
  create: (body: Record<string, unknown>) => unknown;
  update: (id: string, body: Record<string, unknown>) => unknown;
  remove: (id: string, permanent: boolean) => void;
};

const makeCollection = <T extends { id: string }>(
  config: FamilyConfig<T>,
  initial: T[]
) => {
  let items = structuredClone(initial);

  return {
    list: () => structuredClone(items),
    create: (body: Record<string, unknown>) => {
      const item = config.construct(body, new Date());
      items.push(item);
      return structuredClone(item);
    },
    update: (id: string, body: Record<string, unknown>) => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error(`Not found: ${id}`);
      const prev = items[idx];
      const merged = mergeWritable(prev, body, config.writable);
      items[idx] = config.applyUpdate
        ? config.applyUpdate(prev, merged, body, new Date())
        : merged;
      return structuredClone(items[idx]);
    },
    remove: (id: string, permanent: boolean) => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error(`Not found: ${id}`);
      const replacement = config.applyRemove
        ? config.applyRemove(items[idx], { permanent }, new Date())
        : null;
      if (replacement === null) {
        items.splice(idx, 1);
      } else {
        items[idx] = replacement;
      }
    },
    prune: (keep: (item: T) => boolean) => {
      items = items.filter(keep);
    },
  };
};

const groceries = makeCollection(groceriesFamily, demoGroceries);

const collections: Record<string, Collection> = {
  "/api/tasks": makeCollection(tasksFamily, demoTasks),
  "/api/shopping": makeCollection(shoppingFamily, demoShopping),
  "/api/groceries": groceries,
  "/api/recurring": makeCollection(recurringFamily, demoRecurring),
};

let settings: Record<string, unknown> = { ...demoSettings };

/** Split "/api/tasks/abc?x=1" into endpoint, id, and query params. */
const parseItemPath = (path: string) => {
  const [pathname, query = ""] = path.split("?");
  const cut = pathname.lastIndexOf("/");
  return {
    endpoint: pathname.slice(0, cut),
    id: pathname.slice(cut + 1),
    params: new URLSearchParams(query),
  };
};

const collectionFor = (endpoint: string, method: string): Collection => {
  const col = collections[endpoint];
  if (!col) throw new Error(`${method} ${endpoint}: no demo route`);
  return col;
};

export const demoTransport: Transport = {
  get: <T>(path: string): Promise<T> => {
    if (path === "/api/settings") {
      return Promise.resolve({ ...settings } as T);
    }
    return Promise.resolve(collectionFor(path, "GET").list() as T);
  },
  post: <T>(path: string, body: unknown): Promise<T> => {
    const created = collectionFor(path, "POST").create(
      body as Record<string, unknown>
    );
    return Promise.resolve(created as T);
  },
  put: <T>(path: string, body: unknown): Promise<T> => {
    if (path === "/api/settings") {
      settings = { ...settings, ...(body as Record<string, unknown>) };
      return Promise.resolve({ ...settings } as T);
    }
    const { endpoint, id } = parseItemPath(path);
    const updated = collectionFor(endpoint, "PUT").update(
      id,
      body as Record<string, unknown>
    );
    return Promise.resolve(updated as T);
  },
  del: (path: string): Promise<void> => {
    if (path === "/api/groceries/clear-bought") {
      groceries.prune((i: GroceryItem) => !i.done);
      return Promise.resolve();
    }
    const { endpoint, id, params } = parseItemPath(path);
    collectionFor(endpoint, "DELETE").remove(
      id,
      params.get("permanent") === "true"
    );
    return Promise.resolve();
  },
};
