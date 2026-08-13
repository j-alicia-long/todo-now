// GitHub adapter for the IssueCreator seam: files report issues via
// the GitHub REST API (POST /repos/{repo}/issues). Runtime-agnostic —
// plain fetch, no CLI — so it runs on Cloudflare Workers. Filing is
// enabled by passing both a repo and a token (on Workers the token
// arrives through the GITHUB_TOKEN secret binding); a missing repo or
// token yields a no-op creator so local dev doesn't spam the real
// tracker.

import type { CreatedIssue, IssueCreator } from "./reports";

const API_VERSION = "2022-11-28";

/** Narrow fetch seam so tests can inject a fake. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const createGitHubIssueCreator = (
  repo: string | null,
  token: string | null,
  fetchImpl: FetchLike = fetch
): IssueCreator => ({
  create: async (issue): Promise<CreatedIssue | null> => {
    if (!repo || !token) return null;
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": API_VERSION,
        // GitHub rejects requests without a User-Agent.
        "User-Agent": "todo-now-reporter",
      },
      body: JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
      }),
    });
    if (!res.ok) {
      console.error(
        `GitHub issue create failed (${res.status}): ${(await res.text()).slice(0, 500)}`
      );
      return null;
    }
    const data = (await res.json()) as { number: number; html_url: string };
    return { number: data.number, url: data.html_url };
  },
});
