// React binding for the offline transport's observable state. The
// default source is the app-wide offline transport (null in demo
// builds, where there is no network to be offline from); tests inject
// a fake source.

import { useEffect, useState } from "react";
import type { OfflineState, OfflineTransport } from "./offline-transport";
import { offlineTransport } from "./default-transport";

export type OfflineStateSource = Pick<
  OfflineTransport,
  "getState" | "subscribe"
>;

const ONLINE_IDLE: OfflineState = { offline: false, pending: 0 };

export const useOfflineState = (
  source: OfflineStateSource | null = offlineTransport
): OfflineState => {
  const [state, setState] = useState(source?.getState() ?? ONLINE_IDLE);
  useEffect(() => source?.subscribe(setState), [source]);
  return state;
};
