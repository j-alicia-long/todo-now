// A move/archive action button shared by task cards and shopping rows.

import { Icon } from "./icon";

/** A move/archive action button shared by board task cards and shopping list
 *  rows — surfaced only in each surface's "move mode". Styled via
 *  `.card-action-btn`; `variant` picks the color treatment. */
export const MoveActionButton = ({
  icon,
  title,
  onClick,
  variant,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  variant?: "move-left" | "move-right" | "archive";
}) => (
  <button
    className={`card-action-btn ${variant ?? ""}`}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title={title}
  >
    <Icon name={icon} />
  </button>
);
