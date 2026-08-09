// Reports server module: validates a submitted Report, renders it to
// Markdown, and saves it to the open-reports folder for an agent to work
// on later. Not a list family — write-only, no CRUD — so it doesn't use
// the generic resource module. Persistence enters through the injected
// ReportWriter seam; the file adapter lives in files.ts.

import type { Hono } from "hono";
import type { ReportKind, ReportPayload, ReportTarget } from "../domain/report";

export type ReportWriter = {
  /** Save a rendered report; returns the name actually used. */
  save: (fileName: string, markdown: string) => Promise<string>;
};

const NOTE_MAX = 5000;
const TARGETS_MAX = 20;
const SNIPPET_MAX = 4000;
const SELECTOR_MAX = 500;
const SLUG_MAX = 40;

const isKind = (v: unknown): v is ReportKind => v === "bug" || v === "idea";

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

/** Normalize an untrusted request body into a Report, or reject it. */
export const parseReportPayload = (
  body: unknown
): { ok: true; report: ReportPayload } | { ok: false; error: string } => {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body must be an object" };
  }
  const b = body as Record<string, unknown>;
  if (!isKind(b.kind)) {
    return { ok: false, error: "kind must be 'bug' or 'idea'" };
  }
  const note = str(b.note, NOTE_MAX).trim();
  const rawTargets = Array.isArray(b.targets) ? b.targets : [];
  const targets: ReportTarget[] = rawTargets
    .slice(0, TARGETS_MAX)
    .filter((t): t is Record<string, unknown> => typeof t === "object" && !!t)
    .map((t, i) => ({
      id: str(t.id, 8) || `t${i + 1}`,
      tag: str(t.tag, 32) || "element",
      selector: str(t.selector, SELECTOR_MAX),
      snippet: str(t.snippet, SNIPPET_MAX),
    }));
  if (!note && targets.length === 0) {
    return { ok: false, error: "Report needs a note or at least one target" };
  }
  const ctx =
    typeof b.context === "object" && b.context !== null
      ? (b.context as Record<string, unknown>)
      : {};
  const viewport =
    typeof ctx.viewport === "object" && ctx.viewport !== null
      ? (ctx.viewport as Record<string, unknown>)
      : {};
  return {
    ok: true,
    report: {
      kind: b.kind,
      note,
      targets,
      context: {
        tab: str(ctx.tab, 64),
        url: str(ctx.url, 256),
        viewport: {
          width: typeof viewport.width === "number" ? viewport.width : 0,
          height: typeof viewport.height === "number" ? viewport.height : 0,
        },
        userAgent: str(ctx.userAgent, 512),
      },
    },
  };
};

const slugify = (note: string): string => {
  const slug = note
    .toLowerCase()
    .replace(/\[t\d+\]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
  return slug || "report";
};

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD-HHmm-<slug>.md`, slug from the note's first words. */
export const reportFileName = (report: ReportPayload, now: Date): string => {
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${stamp}-${slugify(report.note)}.md`;
};

/**
 * The saved report file: frontmatter with the Page Context, the note
 * (Mentions as [tN] tokens), then one section per Target so an agent can
 * resolve each token to a selector and Snippet.
 */
export const renderReportMarkdown = (
  report: ReportPayload,
  now: Date
): string => {
  const { kind, note, context, targets } = report;
  const lines: string[] = [
    "---",
    `kind: ${kind}`,
    `created: ${now.toISOString()}`,
    `tab: ${context.tab || "unknown"}`,
    `url: ${context.url || "unknown"}`,
    `viewport: ${context.viewport.width}x${context.viewport.height}`,
    `userAgent: ${context.userAgent || "unknown"}`,
    "---",
    "",
    `# ${kind === "bug" ? "Bug report" : "Idea"}`,
    "",
    note || "(no note)",
    "",
  ];
  if (targets.length > 0) {
    lines.push("## Targets", "");
    for (const t of targets) {
      lines.push(`### [${t.id}] ${t.tag}`, "");
      if (t.selector) lines.push(`Selector: \`${t.selector}\``, "");
      if (t.snippet) lines.push("```html", t.snippet, "```", "");
    }
  }
  return lines.join("\n");
};

export const createReportRoutes = (
  app: Hono,
  path: string,
  writer: ReportWriter
) => {
  app.post(path, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = parseReportPayload(body);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const now = new Date();
    const file = await writer.save(
      reportFileName(parsed.report, now),
      renderReportMarkdown(parsed.report, now)
    );
    return c.json({ file }, 201);
  });
};
