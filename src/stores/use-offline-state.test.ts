import { describe, expect, test } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import type { OfflineState } from "./offline-transport";
import { useOfflineState, type OfflineStateSource } from "./use-offline-state";

const makeSource = (initial: OfflineState) => {
  let state = initial;
  const listeners = new Set<(s: OfflineState) => void>();
  const source: OfflineStateSource = {
    getState: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return {
    source,
    set: (next: OfflineState) => {
      state = next;
      for (const fn of listeners) fn(state);
    },
  };
};

describe("useOfflineState", () => {
  test("returns the source's current state and follows updates", () => {
    const fx = makeSource({ offline: false, pending: 0 });
    const { result } = renderHook(() => useOfflineState(fx.source));

    expect(result.current).toEqual({ offline: false, pending: 0 });

    act(() => fx.set({ offline: true, pending: 3 }));
    expect(result.current).toEqual({ offline: true, pending: 3 });

    act(() => fx.set({ offline: false, pending: 0 }));
    expect(result.current).toEqual({ offline: false, pending: 0 });
  });

  test("a null source (demo build) reads as online with nothing pending", () => {
    const { result } = renderHook(() => useOfflineState(null));
    expect(result.current).toEqual({ offline: false, pending: 0 });
  });
});
