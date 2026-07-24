// Generic entity-list store: owns the fetch/optimistic-update/reconcile
// cycle that every list family (tasks, shopping, groceries, recurring)
// shares. Per-family hooks in hooks.ts wrap this with domain operations.

import { useState, useEffect, useCallback, useRef } from "react";
import type { Transport } from "./transport";

export type EntityList<T extends { id: string }> = {
  items: T[];
  /** True once the first fetch attempt has settled (success or failure). */
  loaded: boolean;
  refetch: () => Promise<void>;
  /**
   * Core mutation primitive: apply an optimistic state update, then run the
   * request. On failure, log and refetch to reconcile with the server.
   * Resolves true when the request succeeded.
   */
  mutate: (
    optimistic: (prev: T[]) => T[],
    request: () => Promise<unknown>
  ) => Promise<boolean>;
  /** POST to the collection endpoint and append the server's response. */
  create: (body: unknown) => Promise<T | null>;
  /** Optimistically merge fields into one item, then PUT them. */
  update: (id: string, fields: Record<string, unknown>) => Promise<boolean>;
  /** Optimistically drop one item, then DELETE it. */
  remove: (id: string, query?: string) => Promise<boolean>;
};

export const useEntityList = <T extends { id: string }>(
  endpoint: string,
  label: string,
  transport: Transport
): EntityList<T> => {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    try {
      setItems(await transport.get<T[]>(endpoint));
    } catch (e) {
      console.error(`Failed to fetch ${label}:`, e);
    } finally {
      setLoaded(true);
    }
  }, [endpoint, label, transport]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [refetch]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const mutate = useCallback(
    async (
      optimistic: (prev: T[]) => T[],
      request: () => Promise<unknown>
    ): Promise<boolean> => {
      setItems(optimistic);
      try {
        await request();
        return true;
      } catch (e) {
        console.error(`Failed to update ${label}:`, e);
        refetchRef.current();
        return false;
      }
    },
    [label]
  );

  const create = useCallback(
    async (body: unknown): Promise<T | null> => {
      try {
        const item = await transport.post<T>(endpoint, body);
        setItems((prev) => [...prev, item]);
        return item;
      } catch (e) {
        console.error(`Failed to add ${label}:`, e);
        return null;
      }
    },
    [endpoint, label, transport]
  );

  const update = useCallback(
    (id: string, fields: Record<string, unknown>) =>
      mutate(
        (prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)),
        () => transport.put(`${endpoint}/${id}`, fields)
      ),
    [endpoint, mutate, transport]
  );

  const remove = useCallback(
    (id: string, query = "") =>
      mutate(
        (prev) => prev.filter((i) => i.id !== id),
        () => transport.del(`${endpoint}/${id}${query}`)
      ),
    [endpoint, mutate, transport]
  );

  return { items, loaded, refetch, mutate, create, update, remove };
};
