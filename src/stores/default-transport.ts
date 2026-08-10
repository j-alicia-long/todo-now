// Build-time selection of the app-wide default transport: offline-capable
// HTTP (read cache in IndexedDB) in normal builds, the in-memory demo
// adapter when built with VITE_DEMO (static demo deploys with no API
// server, e.g. GitHub Pages — already offline by construction).

import { demoTransport } from "./demo-transport";
import { httpTransport, type Transport } from "./transport";
import { makeOfflineTransport } from "./offline-transport";
import { indexedDbStorage } from "./offline-storage";

export const isDemo = Boolean(import.meta.env.VITE_DEMO);

export const defaultTransport: Transport = isDemo
  ? demoTransport
  : makeOfflineTransport(
      httpTransport,
      indexedDbStorage,
      () => navigator.onLine
    );
