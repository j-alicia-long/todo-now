// Shopping and grocery list rows.

import { useState, useEffect, useRef } from "react";
import { type ShoppingItem, type GroceryItem } from "../stores/hooks";
import { Icon, LinkPills } from "./ui";

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
}: {
  item: ShoppingItem;
  actions: ShoppingItemActions;
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
          <button
            className="list-action-btn"
            onClick={() => actions.archive(item.id)}
            title="Archive"
          >
            <Icon name="archive" />
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
      <div className="list-item-sub">
        <LinkPills
          links={item.links || []}
          onChange={(links) => actions.updateLinks(item.id, links)}
        />
        <div className="list-actions">
          <button
            className={`list-action-btn ${addedToBoard ? "added" : ""}`}
            onClick={handleAddToBoard}
            title={addedToBoard ? "Added to Board" : "Add to Board"}
          >
            <Icon name={addedToBoard ? "check" : "dashboard"} />
          </button>
          <button
            className="list-action-btn"
            onClick={() => actions.move(item.id)}
            title={item.category === "need" ? "Move to Wants" : "Move to Needs"}
          >
            <Icon
              name={item.category === "need" ? "chevron_right" : "chevron_left"}
            />
          </button>
        </div>
      </div>
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
