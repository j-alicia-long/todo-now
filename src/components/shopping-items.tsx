// Shopping and grocery list rows.

import { useEffect, useRef, useState } from "react";
import { type GroceryItem, type ShoppingItem } from "../stores/hooks";
import { Icon } from "./kit/icon";
import { LinkPills } from "./kit/link-pills";
import { MoveActionButton } from "./kit/move-action-button";

export type ShoppingItemActions = {
  toggle: (id: string) => void;
  archive: (id: string) => void;
  remove: (id: string) => void;
  move: (id: string) => void;
  addToBoard: (title: string, source: string, sourceItemId: string) => void;
  updateLinks: (id: string, links: string[]) => void;
};

export const ShoppingListItem = ({
  item,
  actions,
  moveMode,
}: {
  item: ShoppingItem;
  actions: ShoppingItemActions;
  moveMode?: boolean;
}) => {
  const [addedToBoard, setAddedToBoard] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    },
    []
  );

  const handleAddToBoard = () => {
    actions.addToBoard(item.title, "shopping", item.id);
    setAddedToBoard(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedToBoard(false), 3000);
  };

  const links = item.links || [];
  const hasLinks = links.length > 0;

  return (
    <div
      className={`list-item shopping-item two-row ${item.done ? "checked" : ""}`}
    >
      <div className="list-item-main">
        <label className="list-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => actions.toggle(item.id)}
          />
          <span className="checkmark" />
        </label>
        <span className={`list-title ${item.done ? "done" : ""}`}>
          {item.title}
        </span>
        <div className="list-actions">
          {!hasLinks && (
            <LinkPills
              links={links}
              onChange={(next) => actions.updateLinks(item.id, next)}
            />
          )}
          <button
            className={`list-action-btn ${addedToBoard ? "added" : ""}`}
            onClick={handleAddToBoard}
            title={addedToBoard ? "Added to Board" : "Add to Board"}
          >
            <Icon name={addedToBoard ? "check" : "dashboard"} />
          </button>
          <button
            className="list-action-btn delete"
            onClick={() => actions.remove(item.id)}
            title="Delete"
          >
            <Icon name="close" />
          </button>
        </div>
      </div>
      {(hasLinks || moveMode) && (
        <div className="list-item-sub">
          {hasLinks && (
            <LinkPills
              links={links}
              onChange={(next) => actions.updateLinks(item.id, next)}
            />
          )}
          {moveMode && (
            <div className="list-actions">
              <MoveActionButton
                variant={item.category === "need" ? "move-right" : "move-left"}
                icon={
                  item.category === "need" ? "chevron_right" : "chevron_left"
                }
                title={
                  item.category === "need" ? "Move to Wants" : "Move to Needs"
                }
                onClick={() => actions.move(item.id)}
              />
              <MoveActionButton
                variant="archive"
                icon="archive"
                title="Archive"
                onClick={() => actions.archive(item.id)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ShoppingDoneItem = ({
  item,
  onUndone,
  onDelete,
}: {
  item: ShoppingItem;
  onUndone: (id: string) => void;
  onDelete: (id: string) => void;
}) => (
  <div className="list-item shopping-item checked">
    <label className="list-checkbox" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked onChange={() => onUndone(item.id)} />
      <span className="checkmark" />
    </label>
    <span className="list-title done">{item.title}</span>
    <div className="list-actions">
      <button
        className="list-action-btn delete"
        onClick={() => onDelete(item.id)}
        title="Delete"
      >
        <Icon name="close" />
      </button>
    </div>
  </div>
);

export type GroceryItemActions = {
  toggle: (id: string) => void;
  remove: (id: string) => void;
  addToBoard: (title: string, source: string, sourceItemId: string) => void;
};

export const GroceryListItem = ({
  item,
  actions,
}: {
  item: GroceryItem;
  actions: GroceryItemActions;
}) => (
  <div className={`list-item grocery-item ${item.done ? "checked" : ""}`}>
    <label className="list-checkbox" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => actions.toggle(item.id)}
      />
      <span className="checkmark" />
    </label>
    <span className={`list-title ${item.done ? "done" : ""}`}>
      {item.title}
    </span>
    <div className="list-actions">
      <button
        className="list-action-btn"
        onClick={() => actions.addToBoard(item.title, "grocery", item.id)}
        title="Add to Board"
      >
        <Icon name="dashboard" />
      </button>
      <button
        className="list-action-btn delete"
        onClick={() => actions.remove(item.id)}
        title="Delete"
      >
        <Icon name="close" />
      </button>
    </div>
  </div>
);
