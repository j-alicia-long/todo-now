import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";
import {
  applyStatusChange,
  promoteDueSoon,
  purgeTrash,
  type Task,
} from "./src/domain/task-rules";
import {
  advanceDueDate,
  applyRecurringCompletion,
  resetWeeklyItems,
  type RecurringItem,
} from "./src/domain/recurrence";

// AI agents: read README.md for navigation and contribution guidance.
type Mode = "development" | "production";
const app = new Hono();

const mode: Mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

// ── Data layer ──
const DATA_PATH = import.meta.dir + "/data/tasks.json";
const SETTINGS_PATH = import.meta.dir + "/data/settings.json";
const SHOPPING_PATH = import.meta.dir + "/data/shopping.json";
const GROCERY_PATH = import.meta.dir + "/data/groceries.json";
const RECURRING_PATH = import.meta.dir + "/data/recurring.json";

// Raw task rows from disk may predate the current schema
type LegacyTaskRecord = Omit<Task, "status"> & {
  status?: string;
  done?: boolean;
};

const readTasks = async (): Promise<Task[]> => {
  try {
    const file = Bun.file(DATA_PATH);
    if (await file.exists()) {
      const raw = JSON.parse(await file.text()) as LegacyTaskRecord[];
      let needsMigration = false;
      const now = new Date();
      let tasks = raw.map((t) => {
        // Legacy file-format migrations only; lifecycle rules live in task-rules.ts
        if (!t.status) {
          needsMigration = true;
          t.status = t.done ? "done" : "this-week";
        } else if (t.status === "active") {
          needsMigration = true;
          t.status = "this-week";
        }
        if (t.deletedAt === undefined) {
          t.deletedAt = null;
        }
        if (!t.source) {
          t.source = "board";
        }
        if (t.sourceItemId === undefined || t.sourceItemId === null) {
          t.sourceItemId = null;
          if (t.source === "shopping" || t.source === "grocery") {
            needsMigration = true;
          }
        }
        return t as Task;
      });

      const normalized = purgeTrash(promoteDueSoon(tasks, now), now);
      if (normalized !== tasks) {
        needsMigration = true;
        tasks = normalized;
      }

      if (needsMigration) {
        const shopping = await readShopping();
        const groceries = await readGroceries();
        for (const t of tasks) {
          if (!t.sourceItemId && t.source === "shopping") {
            const match = shopping.find((s) => s.title === t.title);
            if (match) t.sourceItemId = match.id;
          } else if (!t.sourceItemId && t.source === "grocery") {
            const match = groceries.find((g) => g.title === t.title);
            if (match) t.sourceItemId = match.id;
          }
        }
        await writeTasks(tasks);
      }
      return tasks;
    }
  } catch {
    // corrupt or missing data file — fall back to empty list
  }
  return [];
};

const writeTasks = async (tasks: Task[]): Promise<void> => {
  await Bun.write(DATA_PATH, JSON.stringify(tasks, null, 2));
};

// ── Shopping data layer ──

type ShoppingItem = {
  id: string;
  title: string;
  done: boolean;
  archived: boolean;
  category: "want" | "need";
  links: string[];
  createdAt: string;
  doneAt: string | null;
};

const readShopping = async (): Promise<ShoppingItem[]> => {
  try {
    const file = Bun.file(SHOPPING_PATH);
    if (await file.exists()) {
      const raw = JSON.parse(await file.text()) as ShoppingItem[];
      return raw.map((i) => ({
        ...i,
        category: i.category || "need",
        links: Array.isArray(i.links) ? i.links : [],
        doneAt: i.doneAt ?? null,
      }));
    }
  } catch {
    // corrupt or missing data file — fall back to empty list
  }
  return [];
};

const writeShopping = async (items: ShoppingItem[]): Promise<void> => {
  await Bun.write(SHOPPING_PATH, JSON.stringify(items, null, 2));
};

// ── Grocery data layer ──

type GroceryItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  category: "task" | "reference";
};

const readGroceries = async (): Promise<GroceryItem[]> => {
  try {
    const file = Bun.file(GROCERY_PATH);
    if (await file.exists())
      return JSON.parse(await file.text()) as GroceryItem[];
  } catch {
    // corrupt or missing data file — fall back to empty list
  }
  return [];
};

const writeGroceries = async (items: GroceryItem[]): Promise<void> => {
  await Bun.write(GROCERY_PATH, JSON.stringify(items, null, 2));
};

// ── Recurring data layer ──
// Legacy file-format migrations only; week & recurrence rules live in
// src/domain/recurrence.ts

const readRecurring = async (): Promise<RecurringItem[]> => {
  try {
    const file = Bun.file(RECURRING_PATH);
    if (await file.exists()) {
      const raw = JSON.parse(await file.text()) as RecurringItem[];
      let needsMigration = false;
      const migrated = raw.map((i) => {
        const item: RecurringItem = {
          id: i.id,
          title: i.title || "Untitled",
          frequency: i.frequency === "long-term" ? "long-term" : "weekly",
          dayOfWeek: i.dayOfWeek ?? null,
          repeatEvery: i.repeatEvery ?? 1,
          repeatUnit: i.repeatUnit ?? "week",
          repeatDays:
            i.repeatDays ?? (i.dayOfWeek != null ? [i.dayOfWeek] : []),
          endsType: i.endsType ?? "never",
          endsOn: i.endsOn ?? null,
          endsAfter: i.endsAfter ?? null,
          note: i.note || "",
          link: i.link || "",
          completedThisWeek: i.completedThisWeek || false,
          lastCompletedAt: i.lastCompletedAt || null,
          createdAt: i.createdAt,
          dueDate: i.dueDate ?? null,
          showEarlyDays: i.showEarlyDays ?? null,
          area: i.area || "",
          category: i.category === "reference" ? "reference" : "task",
        };
        if (
          item.frequency === "long-term" &&
          item.repeatUnit === "week" &&
          item.repeatEvery === 1
        ) {
          item.repeatUnit = "year";
          needsMigration = true;
        }
        return item;
      });
      const items = resetWeeklyItems(migrated, new Date());
      if (needsMigration || items !== migrated) await writeRecurring(items);
      return items;
    }
  } catch {
    // corrupt or missing data file — fall back to empty list
  }
  return [];
};

const writeRecurring = async (items: RecurringItem[]): Promise<void> => {
  await Bun.write(RECURRING_PATH, JSON.stringify(items, null, 2));
};

// ── Settings ──
const readSettings = async (): Promise<Record<string, unknown>> => {
  try {
    const file = Bun.file(SETTINGS_PATH);
    if (await file.exists()) {
      return JSON.parse(await file.text());
    }
  } catch {
    // corrupt or missing data file — fall back to empty settings
  }
  return {};
};

const writeSettings = async (
  settings: Record<string, unknown>
): Promise<void> => {
  await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
};

// ── API Routes ──
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

app.get("/api/tasks", async (c) => {
  const tasks = await readTasks();
  return c.json(tasks);
});

app.post("/api/tasks", async (c) => {
  const body = await c.req.json();
  const tasks = await readTasks();

  const task: Task = {
    id: crypto.randomUUID().slice(0, 8),
    title: body.title || "Untitled",
    done: false,
    status: body.status || "this-week",
    priority: body.priority || "medium",
    effort: body.effort || "medium",
    decisionLoad: body.decisionLoad || "medium",
    area: body.area || "life-admin",
    dueDate: body.dueDate || null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    deletedAt: null,
    source: body.source || "board",
    sourceItemId: body.sourceItemId || null,
  };

  tasks.push(task);
  await writeTasks(tasks);
  return c.json(task, 201);
});

app.put("/api/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const tasks = await readTasks();
  const idx = tasks.findIndex((t) => t.id === id);

  if (idx === -1) return c.json({ error: "Not found" }, 404);

  const task = tasks[idx];
  const updated: Task = {
    ...task,
    ...body,
    id: task.id,
    createdAt: task.createdAt,
  };

  if (body.status !== undefined || body.done !== undefined) {
    const lifecycle = applyStatusChange(
      task,
      { status: body.status, done: body.done },
      new Date()
    );
    updated.status = lifecycle.status;
    updated.done = lifecycle.done;
    updated.completedAt = lifecycle.completedAt;
    updated.deletedAt = lifecycle.deletedAt;
  }

  tasks[idx] = updated;
  await writeTasks(tasks);
  return c.json(updated);
});

app.delete("/api/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const permanent = c.req.query("permanent") === "true";
  const tasks = await readTasks();
  const idx = tasks.findIndex((t) => t.id === id);

  if (idx === -1) return c.json({ error: "Not found" }, 404);

  if (permanent) {
    tasks.splice(idx, 1);
  } else {
    tasks[idx] = applyStatusChange(
      tasks[idx],
      { status: "trashed" },
      new Date()
    );
  }

  await writeTasks(tasks);
  return c.json({ deleted: true });
});

// ── Shopping API ──

app.get("/api/shopping", async (c) => {
  const items = await readShopping();
  return c.json(items);
});

app.post("/api/shopping", async (c) => {
  const body = await c.req.json();
  const items = await readShopping();
  const item: ShoppingItem = {
    id: crypto.randomUUID().slice(0, 8),
    title: body.title || "Untitled",
    done: false,
    archived: false,
    category: body.category === "want" ? "want" : "need",
    links: Array.isArray(body.links) ? body.links : [],
    createdAt: new Date().toISOString(),
    doneAt: null,
  };
  items.push(item);
  await writeShopping(items);
  return c.json(item, 201);
});

app.put("/api/shopping/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const items = await readShopping();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return c.json({ error: "Not found" }, 404);
  const prev = items[idx];
  items[idx] = { ...prev, ...body, id: prev.id, createdAt: prev.createdAt };
  if (body.done === true && !prev.done) {
    items[idx].doneAt = new Date().toISOString();
  } else if (body.done === false && prev.done) {
    items[idx].doneAt = null;
  }
  await writeShopping(items);
  return c.json(items[idx]);
});

app.delete("/api/shopping/:id", async (c) => {
  const id = c.req.param("id");
  const items = await readShopping();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return c.json({ error: "Not found" }, 404);
  items.splice(idx, 1);
  await writeShopping(items);
  return c.json({ deleted: true });
});

// ── Groceries API ──

app.get("/api/groceries", async (c) => {
  const items = await readGroceries();
  return c.json(items);
});

app.post("/api/groceries", async (c) => {
  const body = await c.req.json();
  const items = await readGroceries();
  const item: GroceryItem = {
    id: crypto.randomUUID().slice(0, 8),
    title: body.title || "Untitled",
    done: false,
    createdAt: new Date().toISOString(),
    category: body.category === "reference" ? "reference" : "task",
  };
  items.push(item);
  await writeGroceries(items);
  return c.json(item, 201);
});

app.put("/api/groceries/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const items = await readGroceries();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return c.json({ error: "Not found" }, 404);
  items[idx] = {
    ...items[idx],
    ...body,
    id: items[idx].id,
    createdAt: items[idx].createdAt,
  };
  await writeGroceries(items);
  return c.json(items[idx]);
});

app.delete("/api/groceries/clear-bought", async (c) => {
  const items = await readGroceries();
  const remaining = items.filter((i) => !i.done);
  await writeGroceries(remaining);
  return c.json({ cleared: items.length - remaining.length });
});

app.delete("/api/groceries/:id", async (c) => {
  const id = c.req.param("id");
  const items = await readGroceries();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return c.json({ error: "Not found" }, 404);
  items.splice(idx, 1);
  await writeGroceries(items);
  return c.json({ deleted: true });
});

// ── Recurring API ──

app.get("/api/recurring", async (c) => {
  const items = await readRecurring();
  return c.json(items);
});

app.post("/api/recurring", async (c) => {
  const body = await c.req.json();
  const items = await readRecurring();
  const isEvent = body.category === "reference";
  const item: RecurringItem = {
    id: crypto.randomUUID().slice(0, 8),
    title: body.title || "Untitled",
    frequency: isEvent
      ? "weekly"
      : body.frequency === "long-term"
        ? "long-term"
        : "weekly",
    dayOfWeek: body.dayOfWeek ?? null,
    repeatEvery: isEvent ? 1 : (body.repeatEvery ?? 1),
    repeatUnit: isEvent ? "week" : (body.repeatUnit ?? "week"),
    repeatDays: isEvent
      ? []
      : (body.repeatDays ?? (body.dayOfWeek != null ? [body.dayOfWeek] : [])),
    endsType: isEvent ? "never" : (body.endsType ?? "never"),
    endsOn: isEvent ? null : (body.endsOn ?? null),
    endsAfter: isEvent ? null : (body.endsAfter ?? null),
    note: body.note || "",
    link: body.link || "",
    completedThisWeek: false,
    lastCompletedAt: null,
    createdAt: new Date().toISOString(),
    dueDate: body.dueDate ?? null,
    showEarlyDays: body.showEarlyDays ?? null,
    area: body.area || "",
    category: isEvent ? "reference" : "task",
  };
  items.push(item);
  await writeRecurring(items);
  return c.json(item, 201);
});

app.put("/api/recurring/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const items = await readRecurring();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return c.json({ error: "Not found" }, 404);
  const prev = items[idx];
  const merged: RecurringItem = {
    ...prev,
    ...body,
    id: prev.id,
    createdAt: prev.createdAt,
  };
  // Completion stamping is a domain rule; evaluate it against the
  // pre-merge item so "already completed" checks see the previous state.
  const stamped = applyRecurringCompletion(
    prev,
    { completedThisWeek: body.completedThisWeek, done: body.done },
    new Date()
  );
  merged.lastCompletedAt = stamped.lastCompletedAt;
  merged.completedThisWeek = stamped.completedThisWeek;
  // Completing a long-term item advances its dueDate to the next
  // occurrence (or ends the recurrence per its ends settings).
  items[idx] = body.done === true ? advanceDueDate(merged, new Date()) : merged;
  await writeRecurring(items);
  return c.json(items[idx]);
});

app.delete("/api/recurring/:id", async (c) => {
  const id = c.req.param("id");
  const items = await readRecurring();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return c.json({ error: "Not found" }, 404);
  items.splice(idx, 1);
  await writeRecurring(items);
  return c.json({ deleted: true });
});

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
