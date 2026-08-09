// Tests for the reports module: payload validation, Markdown rendering,
// filename slugs, and the POST route exercised through a bare Hono app
// with an in-memory ReportWriter.

import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import type { ReportPayload } from "../domain/report";
import {
  createReportRoutes,
  parseReportPayload,
  renderReportMarkdown,
  reportFileName,
  type ReportWriter,
} from "./reports";

const NOW = new Date("2026-08-09T14:35:22.000Z");

const report = (overrides: Partial<ReportPayload> = {}): ReportPayload => ({
  kind: "bug",
  note: "The [t1] overlaps the drawer",
  context: {
    tab: "board",
    url: "/todo",
    viewport: { width: 390, height: 844 },
    userAgent: "TestAgent/1.0",
  },
  targets: [
    {
      id: "t1",
      tag: "button",
      selector: "div.board-column > button.add-task-btn",
      snippet: '<button class="add-task-btn">Add</button>',
    },
  ],
  ...overrides,
});

describe("parseReportPayload", () => {
  test("accepts a valid payload", () => {
    const parsed = parseReportPayload(report());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.report.kind).toBe("bug");
      expect(parsed.report.targets).toHaveLength(1);
    }
  });

  test("rejects an unknown kind", () => {
    const parsed = parseReportPayload({ ...report(), kind: "rant" });
    expect(parsed.ok).toBe(false);
  });

  test("rejects an empty report", () => {
    const parsed = parseReportPayload(report({ note: "", targets: [] }));
    expect(parsed.ok).toBe(false);
  });

  test("allows targets-only reports", () => {
    const parsed = parseReportPayload(report({ note: "" }));
    expect(parsed.ok).toBe(true);
  });

  test("caps oversized fields instead of failing", () => {
    const parsed = parseReportPayload(report({ note: "x".repeat(9000) }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.report.note.length).toBeLessThanOrEqual(5000);
  });
});

describe("renderReportMarkdown", () => {
  test("includes frontmatter, note tokens, and target sections", () => {
    const md = renderReportMarkdown(report(), NOW);
    expect(md).toStartWith("---\nkind: bug\n");
    expect(md).toContain("created: 2026-08-09T14:35:22.000Z");
    expect(md).toContain("tab: board");
    expect(md).toContain("viewport: 390x844");
    expect(md).toContain("The [t1] overlaps the drawer");
    expect(md).toContain("### [t1] button");
    expect(md).toContain("Selector: `div.board-column > button.add-task-btn`");
    expect(md).toContain('<button class="add-task-btn">Add</button>');
  });

  test("renders ideas without targets", () => {
    const md = renderReportMarkdown(
      report({ kind: "idea", note: "Sort shopping by category", targets: [] }),
      NOW
    );
    expect(md).toContain("# Idea");
    expect(md).not.toContain("## Targets");
  });
});

describe("reportFileName", () => {
  test("stamps local date-time and slugs the note", () => {
    const name = reportFileName(
      report({ note: "Add button is misaligned!" }),
      new Date(2026, 7, 9, 14, 5)
    );
    expect(name).toBe("2026-08-09-1405-add-button-is-misaligned.md");
  });

  test("skips mention tokens and falls back for empty notes", () => {
    expect(
      reportFileName(report({ note: "[t1] [t2]" }), new Date(2026, 0, 2, 3, 4))
    ).toBe("2026-01-02-0304-report.md");
  });
});

describe("POST route", () => {
  const mount = () => {
    const app = new Hono();
    const saved: { name: string; markdown: string }[] = [];
    const writer: ReportWriter = {
      save: async (name, markdown) => {
        saved.push({ name, markdown });
        return name;
      },
    };
    createReportRoutes(app, "/api/reports", writer);
    return { app, saved };
  };

  const post = (app: Hono, body: unknown) =>
    app.request("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  test("saves a valid report and returns the file name", async () => {
    const { app, saved } = mount();
    const res = await post(app, report());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { file: string };
    expect(saved).toHaveLength(1);
    expect(body.file).toBe(saved[0].name);
    expect(saved[0].markdown).toContain("### [t1] button");
  });

  test("rejects invalid payloads without saving", async () => {
    const { app, saved } = mount();
    const res = await post(app, { kind: "nope" });
    expect(res.status).toBe(400);
    expect(saved).toHaveLength(0);
  });
});
