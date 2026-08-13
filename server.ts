import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import type { Hono } from "hono";
import { createApp } from "./src/server/app";
import { createGitHubIssueCreator } from "./src/server/github";
import {
  tasksStore,
  shoppingStore,
  groceriesStore,
  recurringStore,
  settingsStore,
  archiveStore,
  reportsWriter,
} from "./src/server/files";

// AI agents: read README.md for navigation and contribution guidance.
type Mode = "development" | "production";

const mode: Mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

// Issue filing needs a repo and a token: REPORTS_REPO env overrides;
// production defaults to the app repo; dev defaults to disabled so
// local testing doesn't create real issues.
const reportsRepo =
  process.env.REPORTS_REPO ??
  (mode === "production" ? "j-alicia-long/todo-now" : null);
const githubToken = process.env.GITHUB_TOKEN ?? null;

// All routes are mounted by the app module; only runtime concerns
// (static serving, port selection) live here.
const app = createApp({
  tasksStore,
  shoppingStore,
  groceriesStore,
  recurringStore,
  settingsStore,
  archiveStore,
  reportsWriter,
  issueCreator: createGitHubIssueCreator(reportsRepo, githubToken),
});

// ── Static / SPA serving ──
// (configured at the bottom of this file, after the helpers are defined)

/**
 * Determine port based on mode. In production, use the published_port if available.
 * In development, always use the local_port.
 * Ports are managed by the system and injected via the PORT environment variable.
 */
const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

export default { fetch: app.fetch, port, idleTimeout: 255 };

/**
 * Configure routing for production builds.
 *
 * - Streams prebuilt assets from `dist`.
 * - Static files from `public/` are copied to `dist/` by Vite and served at root paths.
 * - Falls back to `index.html` for any other GET so the SPA router can resolve the request.
 */
const configureProduction = (app: Hono) => {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();

    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/assets/")) return next();

    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) {
        return new Response(file);
      }
    }

    return serveStatic({ path: "./dist/index.html" })(c, next);
  });
};

/**
 * Configure routing for development builds.
 *
 * - Boots Vite in middleware mode for transforms.
 * - Static files from `public/` are served at root paths (matching Vite convention).
 * - Mirrors production routing semantics so SPA routes behave consistently.
 */
const configureDevelopment = async (app: Hono): Promise<ViteDevServer> => {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    if (c.req.path === "/favicon.ico") return c.redirect("/favicon.svg", 302);

    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        let template = await Bun.file("./index.html").text();
        template = await vite.transformIndexHtml(url, template);
        return c.html(template, {
          headers: { "Cache-Control": "no-store, must-revalidate" },
        });
      }

      const publicFile = Bun.file(`./public${url}`);
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, {
            headers: { "Cache-Control": "no-store, must-revalidate" },
          });
        }
      }

      let result;
      try {
        result = await vite.transformRequest(url);
      } catch {
        result = null;
      }

      if (result) {
        return new Response(result.code, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store, must-revalidate",
          },
        });
      }

      let template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, {
        headers: { "Cache-Control": "no-store, must-revalidate" },
      });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
};

if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}
