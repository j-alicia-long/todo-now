// App composition: mounts every route on a Hono app, with all
// persistence and side effects entering through injected seams. This
// module is runtime-agnostic — the entry point (server.ts) composes it
// with concrete adapters (file-backed on Bun, D1/R2 on Cloudflare
// Workers), and tests can compose it with in-memory fakes.

import { Hono } from "hono";
import type { Task } from "../domain/task-rules";
import type { RecurringItem } from "../domain/recurrence";
import type { ShoppingItem, GroceryItem } from "../domain/entities";
import { createResourceRoutes, type ListStore } from "./resource";
import {
  createReportRoutes,
  type ReportWriter,
  type IssueCreator,
} from "./reports";
import {
  tasksFamily,
  shoppingFamily,
  groceriesFamily,
  recurringFamily,
} from "./families";

// ── Seams ──
// Settings is a single merged object (GET/PUT); the Archive is one
// growing Markdown document. Neither is a list family, so they get
// their own narrow store shapes.

export type SettingsStore = {
  read: () => Promise<Record<string, unknown>>;
  write: (settings: Record<string, unknown>) => Promise<void>;
};

export type ArchiveStore = {
  /** The archive document, or null if none has been written yet. */
  read: () => Promise<string | null>;
  write: (markdown: string) => Promise<void>;
};

export type AppDeps = {
  tasksStore: ListStore<Task>;
  shoppingStore: ListStore<ShoppingItem>;
  groceriesStore: ListStore<GroceryItem>;
  recurringStore: ListStore<RecurringItem>;
  settingsStore: SettingsStore;
  archiveStore: ArchiveStore;
  reportsWriter: ReportWriter;
  issueCreator: IssueCreator;
};

const FOUR_WEEKS_MS = 4 * 7 * 24 * 60 * 60 * 1000;

export const createApp = (deps: AppDeps): Hono => {
  const app = new Hono();
  const {
    tasksStore,
    shoppingStore,
    groceriesStore,
    recurringStore,
    settingsStore,
    archiveStore,
    reportsWriter,
    issueCreator,
  } = deps;

  // ── API Routes ──
  // List families are served by the generic resource module; per-family
  // rules live in families.ts, persistence in the injected stores.

  app.get("/api/settings", async (c) => {
    const settings = await settingsStore.read();
    return c.json(settings);
  });

  app.put("/api/settings", async (c) => {
    const body = await c.req.json();
    const current = await settingsStore.read();
    const merged = { ...current, ...body };
    await settingsStore.write(merged);
    return c.json(merged);
  });

  createResourceRoutes(app, "/api/tasks", tasksFamily, tasksStore);
  createResourceRoutes(app, "/api/shopping", shoppingFamily, shoppingStore);

  // Collection-level op; registered before the groceries /:id routes so
  // "clear-bought" isn't captured as an id.
  app.delete("/api/groceries/clear-bought", async (c) => {
    const items = await groceriesStore.read();
    const remaining = items.filter((i) => !i.done);
    await groceriesStore.write(remaining);
    return c.json({ cleared: items.length - remaining.length });
  });

  createResourceRoutes(app, "/api/groceries", groceriesFamily, groceriesStore);
  createResourceRoutes(app, "/api/recurring", recurringFamily, recurringStore);

  // Reporter submissions: write-only. Each Report is saved as full
  // Markdown through the ReportWriter AND filed as a sanitized GitHub
  // issue through the IssueCreator (the tracker; see reports.ts).
  createReportRoutes(app, "/api/reports", reportsWriter, issueCreator);

  // ── Weekly Archive ──

  app.post("/api/archive", async (c) => {
    const now = Date.now();

    const tasks = await tasksStore.read();
    const oldDone = tasks.filter(
      (t) =>
        t.status === "done" &&
        t.completedAt &&
        now - new Date(t.completedAt).getTime() > FOUR_WEEKS_MS
    );

    const shopping = await shoppingStore.read();
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

    const existing = (await archiveStore.read()) ?? "# Todo Archive\n\n";
    await archiveStore.write(existing + section);

    const remainingTasks = tasks.filter(
      (t) => !oldDone.some((d) => d.id === t.id)
    );
    await tasksStore.write(remainingTasks);

    const remainingShopping = shopping.filter(
      (i) => !oldBought.some((b) => b.id === i.id)
    );
    await shoppingStore.write(remainingShopping);

    return c.json({
      archived: oldDone.length + oldBought.length,
      tasks: oldDone.length,
      shopping: oldBought.length,
    });
  });

  // ── Root redirect ──
  // The SPA router is based at "/todo", so the bare root renders
  // nothing. Send it to the app. Static/SPA serving is handled by the
  // runtime entry (Workers assets binding / Bun serveStatic).
  app.get("/", (c) => c.redirect("/todo", 302));

  return app;
};
