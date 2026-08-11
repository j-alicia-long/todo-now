// GitHub adapter for the IssueCreator seam: files report issues via the
// `gh` CLI, which is already authenticated on Zo (and on dev machines
// with gh installed) — no token to manage. Filing is enabled by passing
// a repo; a null repo yields a no-op creator so local dev doesn't spam
// the real tracker.

import type { CreatedIssue, IssueCreator } from "./reports";

export const createGhIssueCreator = (repo: string | null): IssueCreator => ({
  create: async (issue): Promise<CreatedIssue | null> => {
    if (!repo) return null;
    const proc = Bun.spawn(
      [
        "gh",
        "api",
        `repos/${repo}/issues`,
        "-f",
        `title=${issue.title}`,
        "-f",
        `body=${issue.body}`,
        ...issue.labels.flatMap((l) => ["-f", `labels[]=${l}`]),
      ],
      { stdout: "pipe", stderr: "pipe" }
    );
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      console.error(`gh issue create failed (${code}): ${err.trim()}`);
      return null;
    }
    const data = JSON.parse(out) as { number: number; html_url: string };
    return { number: data.number, url: data.html_url };
  },
});
