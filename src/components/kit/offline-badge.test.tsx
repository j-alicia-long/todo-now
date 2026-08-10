// Badge lifecycle: offline/unsynced → "Syncing…" during replay → a
// short "All changes synced" flash when the queue drains. The badge
// stays visible whenever queued changes exist, even back online.

import { describe, expect, test } from "bun:test";
import { render, act } from "@testing-library/react";
import type { OfflineState } from "@/stores/offline-transport";
import type { OfflineStateSource } from "@/stores/use-offline-state";
import { OfflineBadge } from "./offline-badge";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("OfflineBadge", () => {
  test("renders nothing when online and idle", () => {
    const fx = makeSource({ offline: false, pending: 0, syncing: false });
    const { container } = render(<OfflineBadge source={fx.source} />);
    expect(container.textContent).toBe("");
  });

  test("shows unsynced count while offline", () => {
    const fx = makeSource({ offline: true, pending: 2, syncing: false });
    const { container } = render(<OfflineBadge source={fx.source} />);
    expect(container.textContent).toContain("Offline — 2 unsynced changes");
  });

  test("keeps the unsynced badge when back online but not yet synced", () => {
    const fx = makeSource({ offline: false, pending: 2, syncing: false });
    const { container } = render(<OfflineBadge source={fx.source} />);
    expect(container.textContent).toContain("2 unsynced changes");
  });

  test("shows syncing while the queue replays", () => {
    const fx = makeSource({ offline: false, pending: 2, syncing: true });
    const { container } = render(<OfflineBadge source={fx.source} />);
    expect(container.textContent).toContain("Syncing 2 changes…");
  });

  test("flashes a success badge when the queue drains, then hides", async () => {
    const fx = makeSource({ offline: true, pending: 1, syncing: false });
    const { container } = render(
      <OfflineBadge source={fx.source} flashMs={10} />
    );

    act(() => fx.set({ offline: false, pending: 1, syncing: true }));
    act(() => fx.set({ offline: false, pending: 0, syncing: false }));
    expect(container.textContent).toContain("All changes synced");

    await act(() => sleep(30));
    expect(container.textContent).toBe("");
  });
});
