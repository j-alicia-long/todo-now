// Offline transport: the third Transport implementation. Wraps the HTTP
// transport with a local read cache so lists stay visible offline.
// Storage and connectivity are injected: IndexedDB + navigator.onLine in
// production, in-memory fakes in tests (the test DOM has no IndexedDB).
// Only network failures fall back to the cache — a real server error
// (HTTP 4xx/5xx) still throws so stores keep their revert behavior.

import type { Transport } from "./transport";

export type OfflineStorage = {
  readList: (path: string) => Promise<unknown>;
  writeList: (path: string, data: unknown) => Promise<void>;
};

// A fetch-level network failure (no HTTP response) surfaces as a
// TypeError; a server rejection reaches ensureOk and throws a plain
// Error. Only the former means "offline."
const isNetworkFailure = (e: unknown) => e instanceof TypeError;

export const makeOfflineTransport = (
  inner: Transport,
  storage: OfflineStorage,
  isOnline: () => boolean
): Transport => ({
  get: async <T>(path: string): Promise<T> => {
    try {
      const data = await inner.get<T>(path);
      await storage.writeList(path, data);
      return data;
    } catch (e) {
      if (!isOnline() || isNetworkFailure(e)) {
        const cached = await storage.readList(path);
        if (cached !== undefined) return cached as T;
      }
      throw e;
    }
  },
  post: inner.post,
  put: inner.put,
  del: inner.del,
});
