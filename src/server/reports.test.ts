// Tests for the reports module: payload validation, Markdown rendering,
// filename slugs, issue title/body rendering, and the POST route
// exercised through a bare Hono app with in-memory ReportWriter and
// IssueCreator fakes.

import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import type { ReportPayload } from "../domain/report";
import {
  createReportRoutes,
  parseReportPayload,
  renderReportMarkdown,
  renderIssueMarkdown,
  reportFileName,
  issueTitle,
  type IssueCreator,
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
    expect(md).toContain("issue: pending");
    expect(md).toContain("tab: board");
    expect(md).toContain("viewport: 390x844");
    expect(md).toContain("The [t1] overlaps the drawer");
    expect(md).toContain("### [t1] button");
    expect(md).toContain("Selector: `div.board-column > button.add-task-btn`");
    expect(md).toContain('<button class="add-task-btn">Add</button>');
  });

  test("stamps the issue URL when provided", () => {
    const md = renderReportMarkdown(
      report(),
      NOW,
      "https://github.com/o/r/issues/7"
    );
    expect(md).toContain("issue: https://github.com/o/r/issues/7");
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

describe("issueTitle", () => {
  test("uses the note's first line verbatim", () => {
    expect(issueTitle(report({ note: "The [t1] overlaps\nmore detail" }))).toBe(
      "The [t1] overlaps"
    );
  });

  test("caps long titles with an ellipsis", () => {
    const title = issueTitle(report({ note: "z".repeat(120) }));
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).toEndWith("…");
  });

  test("falls back to a kind label for note-less reports", () => {
    expect(issueTitle(report({ note: "" }))).toBe("Bug report");
    expect(issueTitle(report({ kind: "idea", note: "" }))).toBe("Idea");
  });
});

describe("renderIssueMarkdown", () => {
  const personal = report({
    targets: [
      {
        id: "t1",
        tag: "span",
        selector: "li.task-item > span.task-label",
        snippet: '<span class="task-label">Renew my passport</span>',
      },
    ],
  });

  test("keeps note and selector verbatim but sanitizes snippets", () => {
    const md = renderIssueMarkdown(personal, NOW, "r.md");
    expect(md).toContain("The [t1] overlaps the drawer");
    expect(md).toContain("Selector: `li.task-item > span.task-label`");
    expect(md).toContain('<span class="task-label">xxxxx xx xxxxxxxx</span>');
    expect(md).not.toContain("Renew my passport");
  });

  test("includes page context and a backlink to the local file", () => {
    const md = renderIssueMarkdown(personal, NOW, "2026-08-09-1435-r.md");
    expect(md).toContain("- Tab: board");
    expect(md).toContain("- Viewport: 390x844");
    expect(md).toContain("`reports/2026-08-09-1435-r.md`");
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
  const mount = (
    createIssue?: IssueCreator["create"]
  ): {
    app: Hono;
    saved: Map<string, string>;
    filed: { title: string; body: string; labels: string[] }[];
  } => {
    const app = new Hono();
    const saved = new Map<string, string>();
    const filed: { title: string; body: string; labels: string[] }[] = [];
    const writer: ReportWriter = {
      save: async (name, markdown) => {
        saved.set(name, markdown);
        return name;
      },
      update: async (name, markdown) => {
        saved.set(name, markdown);
      },
    };
    const issues: IssueCreator = {
      create: async (issue) => {
        filed.push(issue);
        return createIssue
          ? createIssue(issue)
          : { number: 12, url: "https://github.com/o/r/issues/12" };
      },
    };
    createReportRoutes(app, "/api/reports", writer, issues);
    return { app, saved, filed };
  };

  const post = (app: Hono, body: unknown) =>
    app.request("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  test("saves the full report, files a sanitized issue, and links them", async () => {
    const { app, saved, filed } = mount();
    const res = await post(app, report());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { file: string; issue: string | null };
    expect(saved.size).toBe(1);
    expect(body.issue).toBe("https://github.com/o/r/issues/12");
    // Local file keeps the raw snippet and gains the issue backlink.
    const markdown = saved.get(body.file)!;
    expect(markdown).toContain("issue: https://github.com/o/r/issues/12");
    expect(markdown).toContain('<button class="add-task-btn">Add</button>');
    // Issue carries the sanitized snippet and a kind label.
    expect(filed).toHaveLength(1);
    expect(filed[0].labels).toEqual(["bug"]);
    expect(filed[0].body).toContain(
      '<button class="add-task-btn">xxx</button>'
    );
    expect(filed[0].body).not.toContain(">Add<");
  });

  test("keeps the file with issue pending when filing is disabled", async () => {
    const { app, saved } = mount(async () => null);
    const res = await post(app, report());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { file: string; issue: string | null };
    expect(body.issue).toBeNull();
    expect(saved.get(body.file)!).toContain("issue: pending");
  });

  test("keeps the file when issue filing throws", async () => {
    const { app, saved } = mount(async () => {
      throw new Error("network down");
    });
    const res = await post(app, report());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { file: string; issue: string | null };
    expect(body.issue).toBeNull();
    expect(saved.get(body.file)!).toContain("issue: pending");
  });

  test("rejects invalid payloads without saving or filing", async () => {
    const { app, saved, filed } = mount();
    const res = await post(app, { kind: "nope" });
    expect(res.status).toBe(400);
    expect(saved.size).toBe(0);
    expect(filed).toHaveLength(0);
  });
});
