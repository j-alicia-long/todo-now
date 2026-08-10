// A small dropdown for picking one value from a fixed set of tag options.
// Flips above the anchor when it would overflow the viewport bottom.

import { useEffect, useRef, useState } from "react";

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
      className={`tag-select ${above ? "tag-select-above" : ""} ${className ?? ""}`}
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
