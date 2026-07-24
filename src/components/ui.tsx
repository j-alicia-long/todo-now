// Small shared UI primitives: Material icon, link pills, tag dropdown.

import { useState, useEffect, useRef } from "react";
import { linkLabel } from "../lib/presentation";

export const Icon = ({
  name,
  className,
}: {
  name: string;
  className?: string;
}) => (
  <span className={`material-symbols-outlined ${className || ""}`}>{name}</span>
);

export const LinkPills = ({
  links,
  onChange,
}: {
  links: string[];
  onChange: (links: string[]) => void;
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
      {adding ? (
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
        <button className="link-pill add" onClick={() => setAdding(true)}>
          + link
        </button>
      )}
    </div>
  );
};

export const TagSelect = <T extends string>({
  value,
  options,
  labels,
  onChange,
  onClose,
  className,
}: {
  value: T;
  options: readonly T[];
  labels?: Record<string, string>;
  onChange: (v: T) => void;
  onClose: () => void;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        setAbove(true);
      }
    }
  }, []);

  return (
    <div
      ref={ref}
      className={`tag-select ${above ? "tag-select-above" : ""} ${className || ""}`}
    >
      {options.map((opt) => (
        <button
          key={opt}
          className={`tag-option ${opt === value ? "selected" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onChange(opt);
            onClose();
          }}
        >
          {labels ? labels[opt] || opt : opt}
        </button>
      ))}
    </div>
  );
};
