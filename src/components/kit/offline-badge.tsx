// Connectivity + sync indicator, driven by the offline transport's
// observable state. Stays visible whenever queued changes exist (even
// back online), switches to "Syncing…" while the queue replays, and
// flashes a short success badge once everything reaches the server.
// Renders nothing in demo builds (null source).

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui";
import { offlineTransport } from "@/stores/default-transport";
import {
  useOfflineState,
  type OfflineStateSource,
} from "@/stores/use-offline-state";

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

const successStyle: CSSProperties = {
  ...badgeStyle,
  background: "var(--success)",
  color: "var(--accent-text)",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const changes = (n: number) => `${n} ${n === 1 ? "change" : "changes"}`;
const unsynced = (n: number) =>
  `${n} unsynced ${n === 1 ? "change" : "changes"}`;

const label = ({
  offline,
  pending,
  syncing,
}: ReturnType<typeof useOfflineState>) => {
  if (syncing) return `Syncing ${changes(pending)}…`;
  if (offline) {
    return pending > 0
      ? `Offline — ${unsynced(pending)}`
      : "Offline — changes will sync when you're back";
  }
  return unsynced(pending);
};

export const OfflineBadge = ({
  source = offlineTransport,
  flashMs = 2000,
}: {
  source?: OfflineStateSource | null;
  flashMs?: number;
} = {}) => {
  const state = useOfflineState(source);
  const [flash, setFlash] = useState(false);
  const prevPending = useRef(state.pending);

  useEffect(() => {
    const drained =
      prevPending.current > 0 && state.pending === 0 && !state.syncing;
    prevPending.current = state.pending;
    if (!drained) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), flashMs);
    return () => clearTimeout(t);
  }, [state.pending, state.syncing, flashMs]);

  if (flash && state.pending === 0 && !state.offline && !state.syncing) {
    return (
      <div style={successStyle}>
        <Icon name="check_circle" /> All changes synced
      </div>
    );
  }
  if (!state.offline && !state.syncing && state.pending === 0) return null;
  return <div style={badgeStyle}>{label(state)}</div>;
};
