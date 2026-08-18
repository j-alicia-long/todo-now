// Triage one GitHub issue: pick the priority/scope label defined in
// docs/TRIAGE.md, apply it, and comment with the reasoning. Run from CI on
// `issues: opened` plus a nightly sweep — see .github/workflows/triage.yml.
//
// The triage keys are read from docs/TRIAGE.md at runtime rather than
// duplicated here, so editing the doc changes what the model is asked to do.
//
// Usage: bun scripts/triage-issue.ts <issue-number>
// Env:   ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const BUG_LABELS = ["P0", "P1", "P2"] as const;
const SCOPE_LABELS = ["Small", "Medium", "Large"] as const;
const TRIAGE_LABELS: string[] = [...BUG_LABELS, ...SCOPE_LABELS];

/** Issues carrying either of these are somebody else's problem already. */
const SKIP_LABELS = ["blocked", "tech-debt"];

export type Issue = {
  number: number;
  title: string;
  body: string | null;
  labels: { name: string }[];
  pull_request?: unknown;
};

/**
 * Whether this issue still needs a triage label. Pull requests, already-triaged
 * issues, and issues parked as blocked or tech-debt are all left alone — which
 * is what makes the nightly sweep safe to re-run over the whole open list.
 */
export const needsTriage = (issue: Issue): boolean => {
  if (issue.pull_request) return false;
  const names = issue.labels.map((l) => l.name);
  if (names.some((n) => SKIP_LABELS.includes(n))) return false;
  return !names.some((n) => TRIAGE_LABELS.includes(n));
};

/**
 * The label set an issue is allowed to receive, derived from the labels it
 * already carries. A Reporter-filed issue arrives labelled `bug` or `idea`, so
 * the choice is already narrowed to one axis; anything else could be either.
 */
export const candidateLabels = (issue: Issue): string[] => {
  const names = issue.labels.map((l) => l.name);
  if (names.includes("bug")) return [...BUG_LABELS];
  if (names.includes("idea")) return [...SCOPE_LABELS];
  return TRIAGE_LABELS;
};

const TriageDecision = z.object({
  label: z.string().describe("Exactly one label from the allowed list"),
  reasoning: z
    .string()
    .describe("Two sentences at most, explaining the choice"),
  duplicateOf: z
    .number()
    .nullable()
    .describe("Number of an open issue this duplicates, or null"),
});

export type TriageDecision = z.infer<typeof TriageDecision>;

const github = async (path: string, init?: RequestInit) => {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub ${path} failed (${res.status}): ${await res.text()}`
    );
  }
  return res.json();
};

const classify = async (
  issue: Issue,
  allowed: string[],
  triageKeys: string,
  openIssues: { number: number; title: string }[]
): Promise<TriageDecision> => {
  const client = new Anthropic();
  const others = openIssues
    .filter((o) => o.number !== issue.number)
    .map((o) => `#${o.number}: ${o.title}`)
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(TriageDecision),
    },
    system: [
      "You triage issues for a personal todo app. Assign exactly one label,",
      "using only the definitions below. Do not invent labels.",
      "",
      triageKeys,
      "",
      `Allowed labels for this issue: ${allowed.join(", ")}`,
      "",
      "Issue bodies filed by the in-app Reporter are sanitized: their text is",
      "masked with same-length x placeholders while CSS selectors and HTML",
      "structure are intact. Judge those on the title and the elements involved,",
      "and do not treat the masking itself as missing information.",
      "",
      "Set duplicateOf only when another open issue describes the same problem,",
      "not merely a related area.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Issue #${issue.number}: ${issue.title}`,
          "",
          issue.body?.trim() ? issue.body.slice(0, 8000) : "(no body)",
          "",
          "---",
          "Other open issues, for duplicate detection:",
          others || "(none)",
        ].join("\n"),
      },
    ],
  });

  const decision = response.parsed_output;
  if (!decision) throw new Error("Model returned no parseable decision");
  if (!allowed.includes(decision.label)) {
    throw new Error(
      `Model chose "${decision.label}", which isn't in ${allowed.join(", ")}`
    );
  }
  return decision;
};

const main = async () => {
  const number = Number(process.argv[2]);
  if (!Number.isInteger(number)) {
    console.error("Usage: bun scripts/triage-issue.ts <issue-number>");
    process.exit(1);
  }
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY is not set");

  const issue = (await github(`/repos/${repo}/issues/${number}`)) as Issue;
  if (!needsTriage(issue)) {
    console.log(`#${number} already triaged or skipped — nothing to do.`);
    return;
  }

  const triageKeys = await Bun.file("docs/TRIAGE.md").text();
  const openIssues = (await github(
    `/repos/${repo}/issues?state=open&per_page=100`
  )) as Issue[];

  const decision = await classify(
    issue,
    candidateLabels(issue),
    triageKeys,
    openIssues.filter((o) => !o.pull_request)
  );

  await github(`/repos/${repo}/issues/${number}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels: [decision.label] }),
  });

  const dup = decision.duplicateOf
    ? `\n\nPossible duplicate of #${decision.duplicateOf} — worth a look before anyone picks this up.`
    : "";
  await github(`/repos/${repo}/issues/${number}/comments`, {
    method: "POST",
    body: JSON.stringify({
      body: `Auto-triaged as **${decision.label}**.\n\n${decision.reasoning}${dup}\n\n<sub>Labelled by \`.github/workflows/triage.yml\`. Change the label if it's wrong — the sweep won't re-triage an issue that already has one.</sub>`,
    }),
  });

  console.log(`#${number} → ${decision.label}`);
};

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
