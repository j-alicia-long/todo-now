import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";
import { createResourceRoutes } from "./src/server/resource";
import {
  tasksFamily,
  shoppingFamily,
  groceriesFamily,
  recurringFamily,
} from "./src/server/families";
import {
  tasksStore,
  shoppingStore,
  groceriesStore,
  recurringStore,
  readTasks,
  writeTasks,
  readShopping,
  writeShopping,
  readGroceries,
  writeGroceries,
  readSettings,
  writeSettings,
} from "./src/server/files";

// AI agents: read README.md for navigation and contribution guidance.
type Mode = "development" | "production";
const app = new Hono();

const mode: Mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

// ── API Routes ──
// List families are served by the generic resource module; per-family
// rules live in src/server/families.ts, persistence in src/server/files.ts.

app.get("/api/settings", async (c) => {
  const settings = await readSettings();
  return c.json(settings);
});

app.put("/api/settings", async (c) => {
  const body = await c.req.json();
  const current = await readSettings();
  const merged = { ...current, ...body };
  await writeSettings(merged);
  return c.json(merged);
});

createResourceRoutes(app, "/api/tasks", tasksFamily, tasksStore);
createResourceRoutes(app, "/api/shopping", shoppingFamily, shoppingStore);

// Collection-level op; registered before the groceries /:id routes so
// "clear-bought" isn't captured as an id.
app.delete("/api/groceries/clear-bought", async (c) => {
  const items = await readGroceries();
  const remaining = items.filter((i) => !i.done);
  await writeGroceries(remaining);
  return c.json({ cleared: items.length - remaining.length });
});

createResourceRoutes(app, "/api/groceries", groceriesFamily, groceriesStore);
createResourceRoutes(app, "/api/recurring", recurringFamily, recurringStore);

// ── Weekly Archive ──

const ARCHIVE_PATH = import.meta.dir + "/data/archive.md";
const FOUR_WEEKS_MS = 4 * 7 * 24 * 60 * 60 * 1000;

app.post("/api/archive", async (c) => {
  const now = Date.now();

  const tasks = await readTasks();
  const oldDone = tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completedAt &&
      now - new Date(t.completedAt).getTime() > FOUR_WEEKS_MS
  );

  const shopping = await readShopping();
  const oldBought = shopping.filter(
    (i) =>
      i.done && i.doneAt && now - new Date(i.doneAt).getTime() > FOUR_WEEKS_MS
  );

  if (oldDone.length === 0 && oldBought.length === 0) {
    return c.json({ archived: 0, message: "Nothing old enough to archive" });
  }

  const weekOf = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const lines: string[] = [`## Week of ${weekOf}\n`];

  if (oldDone.length > 0) {
    lines.push("### Completed Tasks");
    for (const t of oldDone) {
      const date = t.completedAt
        ? new Date(t.completedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "";
      lines.push(`- ${t.title}${date ? ` (completed ${date})` : ""}`);
    }
    lines.push("");
  }

  if (oldBought.length > 0) {
    lines.push("### Items Bought");
    for (const i of oldBought) {
      const date = i.doneAt
        ? new Date(i.doneAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "";
      lines.push(`- ${i.title}${date ? ` (bought ${date})` : ""}`);
    }
    lines.push("");
  }

  lines.push("---\n");
  const section = lines.join("\n");

  const archiveFile = Bun.file(ARCHIVE_PATH);
  const existing = (await archiveFile.exists())
    ? await archiveFile.text()
    : "# Todo Archive\n\n";
  await Bun.write(ARCHIVE_PATH, existing + section);

  const remainingTasks = tasks.filter(
    (t) => !oldDone.some((d) => d.id === t.id)
  );
  await writeTasks(remainingTasks);

  const remainingShopping = shopping.filter(
    (i) => !oldBought.some((b) => b.id === i.id)
  );
  await writeShopping(remainingShopping);

  return c.json({
    archived: oldDone.length + oldBought.length,
    tasks: oldDone.length,
    shopping: oldBought.length,
  });
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
