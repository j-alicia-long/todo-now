// Offline transport: the third Transport implementation. Wraps the HTTP
// transport with a local read cache and an ordered write queue so the
// app keeps working with no network. Storage and connectivity are
// injected: IndexedDB + navigator.onLine in production, in-memory fakes
// in tests (the test DOM has no IndexedDB).
//
// Reads:  successful GETs mirror each list into storage; a network
//         failure serves the cached list with any queued mutations
//         overlaid, so offline changes survive refetches and reloads.
// Writes: a network failure enqueues the op (ordered) and resolves
//         successfully so the store's optimistic state sticks. While
//         the queue is non-empty, new mutations enqueue directly —
//         never overtaking earlier queued ops on the wire.
// Replay: sends the queue in order (stopping if still offline,
//         dropping ops the server rejects), then notifies via onSynced
//         so stores can refetch. Conflict model: single user,
//         replay-in-order, last write wins.
//
// Only network failures trigger any of this — a real server error
// (HTTP 4xx/5xx) still throws so stores keep their revert behavior.

import type { Transport } from "./transport";

export type QueuedOp = {
  method: "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
};

export type OfflineStorage = {
  readList: (path: string) => Promise<unknown>;
  writeList: (path: string, data: unknown) => Promise<void>;
  readQueue: () => Promise<QueuedOp[]>;
  writeQueue: (ops: QueuedOp[]) => Promise<void>;
};

export type OfflineTransport = Transport & {
  /** Send the queued mutations in order, then refetch via onSynced. */
  replay: () => Promise<void>;
};

// A fetch-level network failure (no HTTP response) surfaces as a
// TypeError; a server rejection reaches ensureOk and throws a plain
// Error. Only the former means "offline."
const isNetworkFailure = (e: unknown) => e instanceof TypeError;

type Entity = { id?: unknown; done?: unknown };

// Apply one queued op to a cached list, mirroring the optimistic
// update the store already showed: creates append, edits merge,
// deletes drop. clear-bought is the one collection-level op.
const overlayOp = (list: Entity[], op: QueuedOp, listPath: string) => {
  if (op.method === "POST" && op.path === listPath) {
    return [...list, op.body as Entity];
  }
  if (!op.path.startsWith(`${listPath}/`)) return list;
  const id = op.path.slice(listPath.length + 1).replace(/\?.*$/, "");
  if (op.method === "PUT") {
    return list.map((i) =>
      i.id === id ? { ...i, ...(op.body as object) } : i
    );
  }
  if (op.method === "DELETE") {
    if (id === "clear-bought") return list.filter((i) => !i.done);
    return list.filter((i) => i.id !== id);
  }
  return list;
};

export const makeOfflineTransport = (
  inner: Transport,
  storage: OfflineStorage,
  isOnline: () => boolean,
  opts: { onSynced?: () => void } = {}
): OfflineTransport => {
  const shouldFallBack = (e: unknown) => !isOnline() || isNetworkFailure(e);

  const enqueue = async (op: QueuedOp) => {
    const queue = await storage.readQueue();
    await storage.writeQueue([...queue, op]);
  };

  const send = <T>(op: QueuedOp): Promise<T> =>
    op.method === "POST"
      ? inner.post<T>(op.path, op.body)
      : op.method === "PUT"
        ? inner.put<T>(op.path, op.body)
        : (inner.del(op.path) as Promise<T>);

  // Run a mutation, or queue it when offline. Queued ops resolve with
  // their own body so optimistic creates keep the item they built.
  const mutateOrQueue = async <T>(op: QueuedOp): Promise<T> => {
    const queue = await storage.readQueue();
    if (queue.length > 0) {
      await storage.writeQueue([...queue, op]);
      return op.body as T;
    }
    try {
      return await send<T>(op);
    } catch (e) {
      if (!shouldFallBack(e)) throw e;
      await enqueue(op);
      return op.body as T;
    }
  };

  return {
    get: async <T>(path: string): Promise<T> => {
      try {
        const data = await inner.get<T>(path);
        await storage.writeList(path, data);
        return data;
      } catch (e) {
        if (shouldFallBack(e)) {
          const cached = await storage.readList(path);
          if (cached !== undefined) {
            const queue = await storage.readQueue();
            return queue.reduce(
              (list, op) => overlayOp(list, op, path),
              cached as Entity[]
            ) as T;
          }
        }
        throw e;
      }
    },
    post: <T>(path: string, body: unknown) =>
      mutateOrQueue<T>({ method: "POST", path, body }),
    put: <T>(path: string, body: unknown) =>
      mutateOrQueue<T>({ method: "PUT", path, body }),
    del: async (path: string) => {
      await mutateOrQueue({ method: "DELETE", path });
    },
    replay: async () => {
      let queue = await storage.readQueue();
      if (queue.length === 0) return;
      while (queue.length > 0) {
        try {
          await send(queue[0]);
        } catch (e) {
          if (isNetworkFailure(e)) return; // still offline; try later
          console.error("Dropping queued op the server rejected:", queue[0], e);
        }
        queue = queue.slice(1);
        await storage.writeQueue(queue);
      }
      opts.onSynced?.();
    },
  };
};
