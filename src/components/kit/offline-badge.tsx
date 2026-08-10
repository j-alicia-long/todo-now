// Connectivity + pending-changes indicator: shows when the app is
// offline and how many edits are waiting to sync, and disappears once
// the queue drains after reconnect. Driven by the offline transport's
// observable state; renders nothing in demo builds (null source).

import type { CSSProperties } from "react";
import { useOfflineState } from "@/stores/use-offline-state";

const badgeStyle: CSSProperties = {
  position: "fixed",
  bottom: 10,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 1000,
  padding: "4px 12px",
  borderRadius: 999,
  background: "rgba(60, 50, 40, 0.85)",
  color: "#faf6f1",
  fontSize: 12,
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

const label = (offline: boolean, pending: number) => {
  if (offline) {
    return pending > 0
      ? `Offline — ${pending} unsynced ${pending === 1 ? "change" : "changes"}`
      : "Offline — changes will sync when you're back";
  }
  return `Syncing ${pending} ${pending === 1 ? "change" : "changes"}…`;
};

export const OfflineBadge = () => {
  const { offline, pending } = useOfflineState();
  if (!offline && pending === 0) return null;
  return <div style={badgeStyle}>{label(offline, pending)}</div>;
};
