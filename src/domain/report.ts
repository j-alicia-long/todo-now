// Report types shared by the Reporter (client) and the reports server
// module. A Report is a user-submitted observation about the app — a bug
// or an idea — saved as a Markdown file for an agent to work on later.
// Domain terms (Report, Kind, Target, Mention, Page Context) live in
// CONTEXT.md.

export type ReportKind = "bug" | "idea";

export type ReportTarget = {
  /** Short ID in selection order (t1, t2, …); the note references [t1]. */
  id: string;
  /** Lowercase HTML tag name, used as the Target's label. */
  tag: string;
  /** CSS-style path locating the element on the page. */
  selector: string;
  /** Trimmed outerHTML of the element (the Snippet). */
  snippet: string;
};

export type ReportContext = {
  /** Which tab/view was open when the Report was filed. */
  tab: string;
  url: string;
  viewport: { width: number; height: number };
  userAgent: string;
};

export type ReportPayload = {
  kind: ReportKind;
  /** Plain-text note; Mentions appear as [tN] tokens. */
  note: string;
  context: ReportContext;
  targets: ReportTarget[];
};
