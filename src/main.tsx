import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
// Self-hosted fonts (offline-capable): Inter text weights and the
// Material Symbols icon font, bundled instead of pulled from Google's CDN.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "material-symbols/outlined.css";
import App from "./app";
import "./styles.scss";

// Precache-backed service worker; auto-updates on the next visit after
// a deploy so a stale worker never pins the app to an old build.
registerSW({ immediate: true });

// AI agents: read README.md for navigation and contribution guidance.
const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(<App />);
