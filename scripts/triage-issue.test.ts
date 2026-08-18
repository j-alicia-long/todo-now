// Guards the two pure decisions in the triage script: which issues the sweep
// touches, and which labels the model is allowed to choose from. The model
// call itself isn't tested — it's the part CI exercises for real.
//
// Not covered by `bun test src`; run `bun test scripts` (the triage workflow
// does this before it triages anything).

import { describe, expect, test } from "bun:test";
import { candidateLabels, needsTriage, type Issue } from "./triage-issue";

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  number: 1,
  title: "Something is off",
  body: "Details",
  labels: [],
  ...overrides,
});

const labels = (...names: string[]) => names.map((name) => ({ name }));

describe("needsTriage", () => {
  test("an untriaged issue needs triage", () => {
    expect(needsTriage(makeIssue({ labels: labels("bug") }))).toBe(true);
  });

  test("an issue with no labels at all needs triage", () => {
    expect(needsTriage(makeIssue())).toBe(true);
  });

  test("an already-triaged bug is left alone", () => {
    expect(needsTriage(makeIssue({ labels: labels("bug", "P1") }))).toBe(false);
  });

  test("an already-scoped idea is left alone", () => {
    expect(needsTriage(makeIssue({ labels: labels("idea", "Large") }))).toBe(
      false
    );
  });

  test("a blocked issue is left alone", () => {
    expect(needsTriage(makeIssue({ labels: labels("bug", "blocked") }))).toBe(
      false
    );
  });

  test("tech-debt is left alone", () => {
    expect(needsTriage(makeIssue({ labels: labels("tech-debt") }))).toBe(false);
  });

  test("pull requests are never triaged", () => {
    expect(needsTriage(makeIssue({ pull_request: {} }))).toBe(false);
  });
});

describe("candidateLabels", () => {
  test("a bug can only be a priority", () => {
    expect(candidateLabels(makeIssue({ labels: labels("bug") }))).toEqual([
      "P0",
      "P1",
      "P2",
    ]);
  });

  test("an idea can only be a scope", () => {
    expect(candidateLabels(makeIssue({ labels: labels("idea") }))).toEqual([
      "Small",
      "Medium",
      "Large",
    ]);
  });

  test("an unlabelled issue could be either", () => {
    expect(candidateLabels(makeIssue())).toEqual([
      "P0",
      "P1",
      "P2",
      "Small",
      "Medium",
      "Large",
    ]);
  });

  test("bug wins when an issue somehow carries both", () => {
    const both = makeIssue({ labels: labels("idea", "bug") });
    expect(candidateLabels(both)).toEqual(["P0", "P1", "P2"]);
  });
});
