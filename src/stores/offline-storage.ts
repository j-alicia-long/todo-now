// IndexedDB-backed OfflineStorage: one object store keyed by API path,
// holding each family's last successfully fetched list. Best-effort by
// design — a storage failure must never break a live request, so reads
// resolve undefined and writes resolve silently on error.

import type { OfflineStorage } from "./offline-transport";

const DB_NAME = "todo-offline";
const LISTS_STORE = "lists";

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(LISTS_STORE);
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

export const indexedDbStorage: OfflineStorage = {
  readList: async (path) => {
    try {
      const db = await openDb();
      const store = db.transaction(LISTS_STORE).objectStore(LISTS_STORE);
      return await request(store.get(path));
    } catch {
      return undefined;
    }
  },
  writeList: async (path, data) => {
    try {
      const db = await openDb();
      const store = db
        .transaction(LISTS_STORE, "readwrite")
        .objectStore(LISTS_STORE);
      await request(store.put(data, path));
    } catch {
      // best-effort: a failed mirror write must not break the fetch
    }
  },
};
