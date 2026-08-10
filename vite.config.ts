import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
