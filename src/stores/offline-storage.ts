// IndexedDB-backed OfflineStorage: a "lists" store keyed by API path
// holding each family's last successfully fetched list, and a "queue"
// store holding the ordered pending-mutation queue. Best-effort by
// design — a storage failure must never break a live request, so reads
// resolve empty and writes resolve silently on error.

import type { OfflineStorage, QueuedOp } from "./offline-transport";

const DB_NAME = "todo-offline";
const LISTS_STORE = "lists";
const QUEUE_STORE = "queue";
const QUEUE_KEY = "ops";

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LISTS_STORE)) {
        db.createObjectStore(LISTS_STORE);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const read = async <T>(store: string, key: string): Promise<T | undefined> => {
  try {
    const db = await openDb();
    return await request(db.transaction(store).objectStore(store).get(key));
  } catch {
    return undefined;
  }
};

const write = async (store: string, key: string, value: unknown) => {
  try {
    const db = await openDb();
    await request(
      db.transaction(store, "readwrite").objectStore(store).put(value, key)
    );
  } catch {
    // best-effort: a failed write must not break the live request
  }
};

export const indexedDbStorage: OfflineStorage = {
  readList: (path) => read(LISTS_STORE, path),
  writeList: (path, data) => write(LISTS_STORE, path, data),
  readQueue: async () => (await read<QueuedOp[]>(QUEUE_STORE, QUEUE_KEY)) ?? [],
  writeQueue: (ops) => write(QUEUE_STORE, QUEUE_KEY, ops),
};
