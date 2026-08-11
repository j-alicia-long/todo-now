// Reports server module: validates a submitted Report, renders it to
// Markdown, saves it to the reports folder, and files a sanitized copy
// as a GitHub issue (the tracker — status lives there; the local file
// is the full-fidelity companion). Not a list family — write-only, no
// CRUD — so it doesn't use the generic resource module. Persistence and
// issue filing enter through the injected ReportWriter / IssueCreator
// seams; the adapters live in files.ts and github.ts.

import type { Hono } from "hono";
import type { ReportKind, ReportPayload, ReportTarget } from "../domain/report";
import { sanitizeSnippet } from "./sanitize";

export type ReportWriter = {
  /** Save a rendered report; returns the name actually used. */
  save: (fileName: string, markdown: string) => Promise<string>;
  /** Overwrite an already-saved report (issue backlink stamping). */
  update: (fileName: string, markdown: string) => Promise<void>;
};

export type CreatedIssue = { number: number; url: string };

export type IssueCreator = {
  /** File a GitHub issue; null when filing is disabled or fails. */
  create: (issue: {
    title: string;
    body: string;
    labels: string[];
  }) => Promise<CreatedIssue | null>;
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
 * The saved report file: frontmatter with the Page Context and the
 * linked issue, the note (Mentions as [tN] tokens), then one section per
 * Target so an agent can resolve each token to a selector and Snippet.
 * `issue` is the issue URL, or "pending" until one is filed.
 */
export const renderReportMarkdown = (
  report: ReportPayload,
  now: Date,
  issue: string = "pending"
): string => {
  const { kind, note, context, targets } = report;
  const lines: string[] = [
    "---",
    `kind: ${kind}`,
    `created: ${now.toISOString()}`,
    `issue: ${issue}`,
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

const TITLE_MAX = 80;

/**
 * Issue title: the note's first line, verbatim (the user's words are
 * never reworded), capped for readability. Falls back to a plain label
 * for note-less reports.
 */
export const issueTitle = (report: ReportPayload): string => {
  const firstLine = report.note.split("\n")[0].trim();
  if (!firstLine) return report.kind === "bug" ? "Bug report" : "Idea";
  if (firstLine.length <= TITLE_MAX) return firstLine;
  return firstLine.slice(0, TITLE_MAX - 1).trimEnd() + "…";
};

/**
 * The GitHub issue body: same shape as the report file but with every
 * Snippet passed through sanitizeSnippet — the repo is public, so
 * personal task text must not leave the machine. The note and selectors
 * are included verbatim. Ends with a backlink to the full-fidelity
 * local file for content-dependent repros.
 */
export const renderIssueMarkdown = (
  report: ReportPayload,
  now: Date,
  fileName: string
): string => {
  const { note, context, targets } = report;
  const lines: string[] = [
    note || "(no note)",
    "",
    "## Page Context",
    "",
    `- Tab: ${context.tab || "unknown"}`,
    `- URL: ${context.url || "unknown"}`,
    `- Viewport: ${context.viewport.width}x${context.viewport.height}`,
    `- User agent: ${context.userAgent || "unknown"}`,
    `- Created: ${now.toISOString()}`,
    "",
  ];
  if (targets.length > 0) {
    lines.push("## Targets", "");
    for (const t of targets) {
      lines.push(`### [${t.id}] ${t.tag}`, "");
      if (t.selector) lines.push(`Selector: \`${t.selector}\``, "");
      if (t.snippet) {
        lines.push("```html", sanitizeSnippet(t.snippet), "```", "");
      }
    }
  }
  lines.push(
    "---",
    "",
    "*Snippets are sanitized (text masked, structure kept). Full-fidelity report:*",
    `\`reports/${fileName}\` *in the synced personal-os tree (not in this repo).*`
  );
  return lines.join("\n");
};

export const createReportRoutes = (
  app: Hono,
  path: string,
  writer: ReportWriter,
  issues: IssueCreator
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
    const { report } = parsed;
    // The file is saved first so a failed issue call can never lose a
    // report; it stays `issue: pending` until backfilled.
    const file = await writer.save(
      reportFileName(report, now),
      renderReportMarkdown(report, now)
    );
    let issueUrl: string | null = null;
    try {
      const issue = await issues.create({
        title: issueTitle(report),
        body: renderIssueMarkdown(report, now, file),
        labels: [report.kind],
      });
      if (issue) {
        issueUrl = issue.url;
        await writer.update(file, renderReportMarkdown(report, now, issue.url));
      }
    } catch (error) {
      console.error("Report issue filing failed:", error);
    }
    return c.json({ file, issue: issueUrl }, 201);
  });
};
