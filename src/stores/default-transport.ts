// Build-time selection of the app-wide default transport: real HTTP in
// normal builds, the in-memory demo adapter when built with VITE_DEMO
// (static demo deploys with no API server, e.g. GitHub Pages).

import { demoTransport } from "./demo-transport";
import { httpTransport, type Transport } from "./transport";

export const isDemo = Boolean(import.meta.env.VITE_DEMO);

export const defaultTransport: Transport = isDemo
  ? demoTransport
  : httpTransport;
