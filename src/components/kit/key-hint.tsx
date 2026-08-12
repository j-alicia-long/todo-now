import * as React from "react";

// Map the hard-to-recognize Mac modifier/key glyphs to plain words. `⌘` is
// intentionally kept as a glyph — it's widely recognized and compact. Word
// forms ("Ctrl", "Alt", "Tab") pass through unchanged.
const KEY_TOKEN_LABELS: Record<string, string> = {
  "⌥": "Option",
  "⌃": "Control",
  "⇧": "Shift",
  "⇥": "Tab",
  "⌫": "Delete",
  "⌦": "Delete",
  "⏎": "Enter",
  "↩": "Enter",
  "⎋": "Esc",
  Alt: "Option",
};

const tokenize = (display: string): string[] =>
  display
    // Isolate modifier glyphs that may be glued to the key (e.g. "⌥T", "⌘⇧K")
    // so each renders as its own chip.
    .replace(/([⌘⌥⌃⇧])/g, " $1 ")
    .split(/\s*\+\s*|\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

export interface KeyHintProps {
  /** Platform-aware display string, e.g. "⌘ ⇧ ." or "Ctrl + Shift + ." */
  display: string;
  className?: string;
  size?: "sm" | "xs";
}

/**
 * Renders a keyboard shortcut as a row of individual key chips joined by "+".
 * Uses the regular UI font (not mono — the symbol glyphs are hard to read in
 * mono) and spells out the modifier names that aren't broadly recognized.
 * Styled via `.key-hint*` classes in `todo-base.scss`.
 */
export const KeyHint = ({ display, className, size = "sm" }: KeyHintProps) => {
  const tokens = tokenize(display);
  if (tokens.length === 0) return null;

  return (
    <span className={`key-hint${className ? ` ${className}` : ""}`}>
      {tokens.map((token, index) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- tokens are bare strings (duplicates possible) derived statically from `display`; never reordered
        <React.Fragment key={`${token}-${index}`}>
          {index > 0 && (
            <span className="key-hint-plus" aria-hidden="true">
              +
            </span>
          )}
          <kbd
            className={`key-hint-key${size === "xs" ? " key-hint-key-xs" : ""}`}
          >
            {KEY_TOKEN_LABELS[token] ?? token}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
};
