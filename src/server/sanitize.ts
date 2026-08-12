// Snippet sanitizer for GitHub issue bodies. Reports' Snippets are raw
// outerHTML and can contain personal task text; issues live in the
// public repo, so anything text-bearing must be redacted before filing.
// Masking is same-length (`Call dentist` → `xxxx xxxxxxx`) so layout
// bugs that depend on content length stay diagnosable. Structure — tags,
// ids, classes, state attributes, SVG geometry — passes through intact,
// which is what agents actually match against the source.
//
// Regex/state-machine based rather than a real HTML parser: Snippets
// are capped and can be truncated mid-tag, which a strict parser would
// reject.

/** Attributes whose values identify structure or state, never content. */
const KEEP_ATTRS = new Set([
  "class",
  "id",
  "style",
  "type",
  "role",
  "disabled",
  "hidden",
  "tabindex",
  "contenteditable",
  "draggable",
  "for",
  "colspan",
  "rowspan",
  "data-target-id",
  "data-state",
  "data-slot",
  "aria-expanded",
  "aria-selected",
  "aria-checked",
  "aria-pressed",
  "aria-hidden",
  "aria-disabled",
  "aria-haspopup",
  "aria-live",
  // SVG geometry — keeps icons identifiable without leaking anything
  "d",
  "viewBox",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "width",
  "height",
  "transform",
  "xmlns",
]);

/** Same-length mask: every non-whitespace char becomes `x`. */
const mask = (text: string): string => text.replace(/\S/g, "x");

/** Redact values of non-whitelisted attributes inside one tag's markup. */
const sanitizeTag = (tag: string): string =>
  tag
    .replace(
      /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g,
      (match, name: string, _quoted, dq?: string, sq?: string) => {
        if (KEEP_ATTRS.has(name)) return match;
        const value = dq ?? sq ?? "";
        const quote = dq !== undefined ? '"' : "'";
        return `${name}=${quote}${mask(value)}${quote}`;
      }
    )
    // Truncation can cut a Snippet mid-value; mask the dangling tail too.
    .replace(
      /([a-zA-Z_:][\w:.-]*)\s*=\s*(["'])([^"']*)$/,
      (match, name: string, quote: string, value: string) =>
        KEEP_ATTRS.has(name) ? match : `${name}=${quote}${mask(value)}`
    );

/**
 * Sanitize one Snippet: mask all text nodes and all non-whitelisted
 * attribute values, preserving length and whitespace. Tolerates
 * truncated markup (an unterminated final tag is treated as tag markup).
 */
export const sanitizeSnippet = (snippet: string): string => {
  let out = "";
  let rest = snippet;
  while (rest.length > 0) {
    const open = rest.indexOf("<");
    if (open === -1) {
      out += mask(rest); // trailing text node
      break;
    }
    out += mask(rest.slice(0, open)); // text before the tag
    const close = rest.indexOf(">", open);
    if (close === -1) {
      out += sanitizeTag(rest.slice(open)); // truncated mid-tag
      break;
    }
    out += sanitizeTag(rest.slice(open, close + 1));
    rest = rest.slice(close + 1);
  }
  return out;
};
