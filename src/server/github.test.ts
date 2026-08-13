import { describe, expect, test } from "bun:test";
import { createGitHubIssueCreator } from "./github";

const issue = {
  title: "Bug report",
  body: "Something broke",
  labels: ["bug"],
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

describe("createGitHubIssueCreator", () => {
  test("no-op when repo is null", async () => {
    let called = false;
    const creator = createGitHubIssueCreator(null, "token", async () => {
      called = true;
      return jsonResponse(201, {});
    });
    expect(await creator.create(issue)).toBeNull();
    expect(called).toBe(false);
  });

  test("no-op when token is null", async () => {
    let called = false;
    const creator = createGitHubIssueCreator("o/r", null, async () => {
      called = true;
      return jsonResponse(201, {});
    });
    expect(await creator.create(issue)).toBeNull();
    expect(called).toBe(false);
  });

  test("POSTs the issue to the repo with auth headers", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const creator = createGitHubIssueCreator(
      "j-alicia-long/todo-now",
      "tok-123",
      async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init;
        return jsonResponse(201, {
          number: 42,
          html_url: "https://github.com/j-alicia-long/todo-now/issues/42",
        });
      }
    );

    const created = await creator.create(issue);

    expect(capturedUrl).toBe(
      "https://api.github.com/repos/j-alicia-long/todo-now/issues"
    );
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
    expect(headers.Accept).toBe("application/vnd.github+json");
    expect(headers["User-Agent"]).toBeTruthy();
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      title: "Bug report",
      body: "Something broke",
      labels: ["bug"],
    });
    expect(created).toEqual({
      number: 42,
      url: "https://github.com/j-alicia-long/todo-now/issues/42",
    });
  });

  test("returns null on a non-2xx response", async () => {
    const creator = createGitHubIssueCreator("o/r", "tok", async () =>
      jsonResponse(422, { message: "Validation Failed" })
    );
    expect(await creator.create(issue)).toBeNull();
  });
});
