import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";

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

type TaskStatus = "this-week" | "this-month" | "future" | "done" | "trashed";

type Task = {
  id: string;
  title: string;
  done: boolean;
  status: TaskStatus;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  decisionLoad: "low" | "medium" | "high";
  area: string;
  dueDate: string | null;
  isSmallWin: boolean;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function readTasks(): Promise<Task[]> {
  try {
    const file = Bun.file(DATA_PATH);
    if (await file.exists()) {
      const raw = JSON.parse(await file.text()) as any[];
      let needsMigration = false;
      const now = Date.now();
      const tasks = raw
        .map((t) => {
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
          if (t.status === "this-month" && t.dueDate) {
            const dueMs = new Date(t.dueDate).getTime();
            if (dueMs - now <= SEVEN_DAYS_MS) {
              needsMigration = true;
              t.status = "this-week";
            }
          }
          return t as Task;
        })
        .filter((t) => {
          if (t.status === "trashed" && t.deletedAt) {
            const elapsed = now - new Date(t.deletedAt).getTime();
            if (elapsed > TRASH_TTL_MS) {
              needsMigration = true;
              return false;
            }
          }
          return true;
        });
      if (needsMigration) await writeTasks(tasks);
      return tasks;
    }
  } catch {}
  return [];
}

async function writeTasks(tasks: Task[]): Promise<void> {
  await Bun.write(DATA_PATH, JSON.stringify(tasks, null, 2));
}

function inferSmallWin(task: Partial<Task>): boolean {
  if (task.effort === "high") return false;
  if (task.decisionLoad !== "low") return false;
  return true;
}

// ── Shopping data layer ──

type ShoppingItem = {
  id: string;
  title: string;
  done: boolean;
  archived: boolean;
  category: "want" | "need";
  createdAt: string;
  doneAt: string | null;
};

async function readShopping(): Promise<ShoppingItem[]> {
  try {
    const file = Bun.file(SHOPPING_PATH);
    if (await file.exists()) {
      const raw = JSON.parse(await file.text()) as any[];
      return raw.map((i) => ({
        ...i,
        category: i.category || "need",
        doneAt: i.doneAt ?? null,
      }));
    }
  } catch {}
  return [];
}

async function writeShopping(items: ShoppingItem[]): Promise<void> {
  await Bun.write(SHOPPING_PATH, JSON.stringify(items, null, 2));
}

// ── Grocery data layer ──

type GroceryItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  category: "task" | "reference";
};

async function readGroceries(): Promise<GroceryItem[]> {
  try {
    const file = Bun.file(GROCERY_PATH);
    if (await file.exists()) return JSON.parse(await file.text()) as GroceryItem[];
  } catch {}
  return [];
}

async function writeGroceries(items: GroceryItem[]): Promise<void> {
  await Bun.write(GROCERY_PATH, JSON.stringify(items, null, 2));
}

// ── Recurring data layer ──

type RecurringItem = {
  id: string;
  title: string;
  frequency: "weekly" | "long-term";
  dayOfWeek: number | null;
  repeatEvery: number;
  repeatUnit: "day" | "week" | "month" | "year";
  repeatDays: number[];
  endsType: "never" | "on" | "after";
  endsOn: string | null;
  endsAfter: number | null;
  note: string;
  link: string;
  completedThisWeek: boolean;
  lastCompletedAt: string | null;
  dueDate: string | null;
  area: string;
  createdAt: string;
  category: "task" | "reference";
};

function getWeekStart(): number {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  return monday.getTime();
}

async function readRecurring(): Promise<RecurringItem[]> {
  try {
    const file = Bun.file(RECURRING_PATH);
    if (await file.exists()) {
      const raw = JSON.parse(await file.text()) as any[];
      const weekStart = getWeekStart();
      let needsReset = false;
      const items = raw.map((i) => {
        const item: RecurringItem = {
          id: i.id,
          title: i.title || "Untitled",
          frequency: i.frequency === "long-term" ? "long-term" : "weekly",
          dayOfWeek: i.dayOfWeek ?? null,
          repeatEvery: i.repeatEvery ?? 1,
          repeatUnit: i.repeatUnit ?? "week",
          repeatDays: i.repeatDays ?? (i.dayOfWeek != null ? [i.dayOfWeek] : []),
          endsType: i.endsType ?? "never",
          endsOn: i.endsOn ?? null,
          endsAfter: i.endsAfter ?? null,
          note: i.note || "",
          link: i.link || "",
          completedThisWeek: i.completedThisWeek || false,
          lastCompletedAt: i.lastCompletedAt || null,
          createdAt: i.createdAt,
          dueDate: i.dueDate ?? null,
          area: i.area || "",
          category: i.category === "reference" ? "reference" : "task",
        };
        if (item.frequency === "long-term" && item.repeatUnit === "week" && item.repeatEvery === 1) {
          item.repeatUnit = "year";
          needsReset = true;
        }
        if (item.frequency === "weekly" && item.completedThisWeek) {
          const lastDone = item.lastCompletedAt ? new Date(item.lastCompletedAt).getTime() : 0;
          if (lastDone < weekStart) {
            item.completedThisWeek = false;
            needsReset = true;
          }
        }
        return item;
      });
      if (needsReset) await writeRecurring(items);
      return items;
    }
  } catch {}
  return [];
}

async function writeRecurring(items: RecurringItem[]): Promise<void> {
  await Bun.write(RECURRING_PATH, JSON.stringify(items, null, 2));
}

// ── Settings ──
async function readSettings(): Promise<Record<string, any>> {
  try {
    const file = Bun.file(SETTINGS_PATH);
    if (await file.exists()) {
      return JSON.parse(await file.text());
    }
  } catch {}
  return {};
}

async function writeSettings(settings: Record<string, any>): Promise<void> {
  await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

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
    isSmallWin: body.isSmallWin ?? inferSmallWin(body),
    createdAt: new Date().toISOString(),
    completedAt: null,
    deletedAt: null,
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
  const updated: Task = { ...task, ...body, id: task.id, createdAt: task.createdAt };

  if (body.status && body.status !== "trashed" && task.status === "trashed") {
    updated.deletedAt = null;
  }

  if (body.status === "done" && task.status !== "done") {
    updated.done = true;
    updated.completedAt = new Date().toISOString();
  } else if (body.status && body.status !== "done" && task.status === "done") {
    updated.done = false;
    updated.completedAt = null;
  } else if (body.done === true && !task.done) {
    updated.status = "done";
    updated.completedAt = new Date().toISOString();
  } else if (body.done === false) {
    updated.status = "this-week";
    updated.completedAt = null;
  }

  if (body.isSmallWin === undefined && (body.effort !== undefined || body.decisionLoad !== undefined)) {
    updated.isSmallWin = inferSmallWin(updated);
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
    tasks[idx].status = "trashed";
    tasks[idx].deletedAt = new Date().toISOString();
    tasks[idx].done = false;
    tasks[idx].completedAt = null;
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
  items[idx] = { ...items[idx], ...body, id: items[idx].id, createdAt: items[idx].createdAt };
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
  const item: RecurringItem = {
    id: crypto.randomUUID().slice(0, 8),
    title: body.title || "Untitled",
    frequency: body.frequency === "long-term" ? "long-term" : "weekly",
    dayOfWeek: body.dayOfWeek ?? null,
    repeatEvery: body.repeatEvery ?? 1,
    repeatUnit: body.repeatUnit ?? "week",
    repeatDays: body.repeatDays ?? (body.dayOfWeek != null ? [body.dayOfWeek] : []),
    endsType: body.endsType ?? "never",
    endsOn: body.endsOn ?? null,
    endsAfter: body.endsAfter ?? null,
    note: body.note || "",
    link: body.link || "",
    completedThisWeek: false,
    lastCompletedAt: null,
    createdAt: new Date().toISOString(),
    dueDate: body.dueDate ?? null,
    area: body.area || "",
    category: body.category === "reference" ? "reference" : "task",
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
  items[idx] = { ...prev, ...body, id: prev.id, createdAt: prev.createdAt };
  if (body.completedThisWeek === true && !prev.completedThisWeek) {
    items[idx].lastCompletedAt = new Date().toISOString();
  }
  if (body.done === true) {
    items[idx].lastCompletedAt = new Date().toISOString();
    if (items[idx].frequency === "weekly") {
      items[idx].completedThisWeek = true;
    }
  }
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
    (t) => t.status === "done" && t.completedAt && now - new Date(t.completedAt).getTime() > FOUR_WEEKS_MS
  );

  const shopping = await readShopping();
  const oldBought = shopping.filter(
    (i) => i.done && i.doneAt && now - new Date(i.doneAt).getTime() > FOUR_WEEKS_MS
  );

  if (oldDone.length === 0 && oldBought.length === 0) {
    return c.json({ archived: 0, message: "Nothing old enough to archive" });
  }

  const weekOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const lines: string[] = [`## Week of ${weekOf}\n`];

  if (oldDone.length > 0) {
    lines.push("### Completed Tasks");
    for (const t of oldDone) {
      const date = t.completedAt
        ? new Date(t.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "";
      lines.push(`- ${t.title}${date ? ` (completed ${date})` : ""}`);
    }
    lines.push("");
  }

  if (oldBought.length > 0) {
    lines.push("### Items Bought");
    for (const i of oldBought) {
      const date = i.doneAt
        ? new Date(i.doneAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "";
      lines.push(`- ${i.title}${date ? ` (bought ${date})` : ""}`);
    }
    lines.push("");
  }

  lines.push("---\n");
  const section = lines.join("\n");

  const archiveFile = Bun.file(ARCHIVE_PATH);
  let existing = "";
  if (await archiveFile.exists()) {
    existing = await archiveFile.text();
  } else {
    existing = "# Todo Archive\n\n";
  }
  await Bun.write(ARCHIVE_PATH, existing + section);

  const remainingTasks = tasks.filter((t) => !oldDone.some((d) => d.id === t.id));
  await writeTasks(remainingTasks);

  const remainingShopping = shopping.filter((i) => !oldBought.some((b) => b.id === i.id));
  await writeShopping(remainingShopping);

  return c.json({ archived: oldDone.length + oldBought.length, tasks: oldDone.length, shopping: oldBought.length });
});

// ── Static / SPA serving ──

if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

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
function configureProduction(app: Hono) {
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
}

/**
 * Configure routing for development builds.
 *
 * - Boots Vite in middleware mode for transforms.
 * - Static files from `public/` are served at root paths (matching Vite convention).
 * - Mirrors production routing semantics so SPA routes behave consistently.
 */
async function configureDevelopment(app: Hono): Promise<ViteDevServer> {
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
}
