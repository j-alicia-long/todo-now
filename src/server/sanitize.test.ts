// Tests for the Snippet sanitizer: personal text must never survive
// into a GitHub issue body, while structure (tags, classes, ids, state
// attributes, SVG geometry) must pass through untouched.

import { describe, test, expect } from "bun:test";
import { sanitizeSnippet } from "./sanitize";

describe("sanitizeSnippet", () => {
  test("masks text nodes with same-length placeholders", () => {
    const out = sanitizeSnippet('<span class="task-label">Call dentist</span>');
    expect(out).toBe('<span class="task-label">xxxx xxxxxxx</span>');
  });

  test("keeps structural attributes verbatim", () => {
    const input =
      '<li id="task-3" class="task-item done" style="height: 40px" role="listitem" data-state="open">Buy milk</li>';
    const out = sanitizeSnippet(input);
    expect(out).toContain('id="task-3"');
    expect(out).toContain('class="task-item done"');
    expect(out).toContain('style="height: 40px"');
    expect(out).toContain('role="listitem"');
    expect(out).toContain('data-state="open"');
    expect(out).not.toContain("Buy milk");
  });

  test("masks text-bearing attributes, preserving length", () => {
    const out = sanitizeSnippet(
      '<button aria-label="Delete Call dentist" title="Call dentist"></button>'
    );
    expect(out).toBe(
      '<button aria-label="xxxxxx xxxx xxxxxxx" title="xxxx xxxxxxx"></button>'
    );
  });

  test("masks href and src (personal links)", () => {
    const out = sanitizeSnippet(
      '<a class="item-link" href="https://example.com/wishlist">shop</a>'
    );
    expect(out).toContain('class="item-link"');
    expect(out).not.toContain("example.com");
    expect(out).toContain('href="xxxxxxxxxxxxxxxxxxxxxxxxxxxx"');
  });

  test("masks input values and placeholders", () => {
    const out = sanitizeSnippet(
      '<input type="text" value="my secret task" placeholder="Add a task…">'
    );
    expect(out).toContain('type="text"');
    expect(out).not.toContain("secret");
    expect(out).not.toContain("Add a task");
  });

  test("keeps SVG geometry so icons stay identifiable", () => {
    const input =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M12 5v14"></path></svg>';
    expect(sanitizeSnippet(input)).toBe(input);
  });

  test("preserves whitespace and nesting across text nodes", () => {
    const out = sanitizeSnippet(
      '<div class="card">\n  Renew passport\n  <em>by Friday</em>\n</div>'
    );
    expect(out).toBe(
      '<div class="card">\n  xxxxx xxxxxxxx\n  <em>xx xxxxxx</em>\n</div>'
    );
  });

  test("tolerates snippets truncated mid-tag", () => {
    const out = sanitizeSnippet(
      '<div class="task">Water plants</div><span aria-label="Wat…'
    );
    expect(out).toContain('class="task"');
    expect(out).not.toContain("Water plants");
    expect(out).not.toContain("Wat…");
    expect(out).toContain('aria-label="xxxx');
  });

  test("masks trailing text after the last tag", () => {
    const out = sanitizeSnippet("<br>loose personal text");
    expect(out).toBe("<br>xxxxx xxxxxxxx xxxx");
  });

  test("handles empty input", () => {
    expect(sanitizeSnippet("")).toBe("");
  });
});
