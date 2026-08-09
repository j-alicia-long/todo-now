// Tests for Target capture and note serialization (DOM provided by
// happy-dom via the test preload).

import { describe, test, expect } from "bun:test";
import { buildSelector, buildSnippet, serializeNote } from "./report-capture";

const mount = (html: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
};

describe("buildSelector", () => {
  test("anchors at an id and stops walking up", () => {
    const host = mount(
      '<section id="root"><div class="col"><button class="add">Go</button></div></section>'
    );
    const btn = host.querySelector("button")!;
    expect(buildSelector(btn)).toBe("section#root > div.col > button.add");
    host.remove();
  });

  test("disambiguates siblings with nth-of-type", () => {
    const host = mount('<ul class="list"><li>a</li><li>b</li><li>c</li></ul>');
    const second = host.querySelectorAll("li")[1];
    expect(buildSelector(second)).toContain("li:nth-of-type(2)");
    host.remove();
  });
});

describe("buildSnippet", () => {
  test("returns outerHTML and caps length", () => {
    const host = mount(`<p class="note">${"x".repeat(50)}</p>`);
    const p = host.querySelector("p")!;
    expect(buildSnippet(p)).toBe(p.outerHTML);
    expect(buildSnippet(p, 20)).toHaveLength(21); // 20 chars + ellipsis
    host.remove();
  });
});

describe("serializeNote", () => {
  test("turns mention chips into [tN] tokens", () => {
    const host = mount(
      'The <span data-target-id="t1" contenteditable="false">t1 · button</span> is misaligned'
    );
    expect(serializeNote(host)).toBe("The [t1] is misaligned");
    host.remove();
  });

  test("keeps line breaks and trims noise", () => {
    const host = mount("line one<br>line two<div>line three</div>");
    expect(serializeNote(host)).toBe("line one\nline two\nline three");
    host.remove();
  });
});
