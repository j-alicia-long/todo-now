// Element capture for the Reporter: builds a Target's descriptor
// (selector path) and Snippet from a live element, and serializes the
// compose form's note — text plus Mention chips — into the plain-text
// form saved in the report file ([tN] tokens).

const SNIPPET_MAX = 2000;
const SELECTOR_MAX_DEPTH = 8;

const segmentFor = (el: Element): string => {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const classes = Array.from(el.classList).slice(0, 3);
  const base = classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
  const parent = el.parentElement;
  if (!parent) return base;
  const sameTag = Array.from(parent.children).filter(
    (c) => c.tagName === el.tagName
  );
  if (sameTag.length > 1) {
    return `${base}:nth-of-type(${sameTag.indexOf(el) + 1})`;
  }
  return base;
};

/**
 * A CSS-style path from the nearest id-anchored ancestor (or body) down
 * to the element — enough for an agent to find it in the source, not
 * necessarily a valid document.querySelector string.
 */
export const buildSelector = (el: Element): string => {
  const parts: string[] = [];
  let node: Element | null = el;
  while (
    node &&
    node.tagName.toLowerCase() !== "html" &&
    node.tagName.toLowerCase() !== "body" &&
    parts.length < SELECTOR_MAX_DEPTH
  ) {
    parts.unshift(segmentFor(node));
    if (node.id) break; // an id anchors the path; no need to walk higher
    node = node.parentElement;
  }
  return parts.join(" > ");
};

/** The element's outerHTML, capped so huge subtrees don't bloat reports. */
export const buildSnippet = (el: Element, maxLength = SNIPPET_MAX): string => {
  const html = el.outerHTML.trim();
  if (html.length <= maxLength) return html;
  return html.slice(0, maxLength) + "…";
};

/**
 * Serialize the compose form's contenteditable note to plain text:
 * Mention chips (spans with data-target-id) become [tN] tokens, line
 * breaks become newlines, everything else keeps its text.
 */
export const serializeNote = (root: Node): string => {
  let out = "";
  const newline = () => {
    if (out && !out.endsWith("\n")) out += "\n";
  };
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.targetId) {
      out += `[${node.dataset.targetId}]`;
      return;
    }
    if (node.tagName === "BR") {
      out += "\n";
      return;
    }
    const isBlock = node.tagName === "DIV" || node.tagName === "P";
    if (isBlock) newline();
    for (const child of Array.from(node.childNodes)) walk(child);
    if (isBlock) newline();
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return out
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
