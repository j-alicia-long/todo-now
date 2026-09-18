import { execSync } from "child_process";
import path from "path";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The demo build (VITE_DEMO, GitHub Pages) is a pure static client
// build with the in-memory transport — no Worker — so the Cloudflare
// plugin must stay out of it.
const isDemo = !!process.env.VITE_DEMO;

// Committer date of HEAD, baked into the bundle for the Settings footer.
// Falls back to build time when git isn't available (e.g. a tarball build).
const lastCommitDate = (() => {
  try {
    return execSync("git log -1 --format=%cI", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return new Date().toISOString();
  }
})();

export default defineConfig({
  define: {
    __LAST_COMMIT_DATE__: JSON.stringify(lastCommitDate),
  },
  plugins: [
    // React Compiler auto-memoizes components: skip hand-written useMemo/useCallback.
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
    // Offline app shell: precache the hashed build output (plus fonts and
    // icons) and auto-update the worker on the next visit after a deploy.
    // The manifest stays hand-written in public/manifest.json.
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,json}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Never let SPA navigation fallback swallow API requests.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
    // Runs the Worker (server.ts, per wrangler.jsonc) inside vite dev
    // with Miniflare-simulated local D1/R2, and emits the deployable
    // Worker bundle on build.
    !isDemo && cloudflare(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5173,
    strictPort: true,
    hmr: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
