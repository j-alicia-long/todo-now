// Editable list of link "pills": each link opens in a new tab; an inline
// input appends new ones.

import { linkLabel } from "@/lib/presentation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

export const LinkPills = ({
  links,
  onChange,
  canAdd = true,
}: {
  links: string[];
  onChange: (links: string[]) => void;
  canAdd?: boolean;
}) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const commit = () => {
    const raw = draft.trim();
    if (raw) {
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      onChange([...links, url]);
    }
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="link-pills">
      {links.map((url, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- links are bare strings (possible duplicates) removed by position; no stable id exists
        <span key={`${url}-${i}`} className="link-pill">
          <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
            {linkLabel(url)}
          </a>
          <button
            className="link-pill-remove"
            onClick={() => onChange(links.filter((_, j) => j !== i))}
            title="Remove link"
          >
            <Icon name="close" />
          </button>
        </span>
      ))}
      {canAdd &&
        (adding ? (
          <input
            ref={inputRef}
            className="link-pill-input"
            value={draft}
            placeholder="Paste a link…"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
          />
        ) : (
          <button
            className="link-pill add"
            onClick={() => setAdding(true)}
            title="Add link"
            aria-label="Add link"
          >
            <Icon name="attach_file" />
          </button>
        ))}
    </div>
  );
};
