// Shopping tab: needs / wants / done columns.

import { type ShoppingItem } from "../stores/hooks";
import { Icon } from "../components/ui";
import {
  ShoppingListItem,
  ShoppingDoneItem,
  type ShoppingItemActions,
} from "../components/shopping-items";

export const ShoppingTab = ({
  items,
  actions,
}: {
  items: ShoppingItem[];
  actions: ShoppingItemActions;
}) => {
  const active = items.filter((i) => !i.archived && !i.done);
  const done = items.filter((i) => !i.archived && i.done);
  const needs = active.filter((i) => i.category === "need");
  const wants = active.filter((i) => i.category === "want");

  return (
    <div className="shopping-board">
      <div className="shopping-columns">
        <div className="shopping-column">
          <div className="shopping-column-header needs-header">
            <Icon name="priority_high" className="column-icon" />
            <h3>Needs</h3>
            <span className="column-count">{needs.length}</span>
          </div>
          {needs.length === 0 ? (
            <div className="column-empty">No items needed right now</div>
          ) : (
            needs.map((item) => (
              <ShoppingListItem key={item.id} item={item} actions={actions} />
            ))
          )}
        </div>
        <div className="shopping-column">
          <div className="shopping-column-header wants-header">
            <Icon name="favorite" className="column-icon" />
            <h3>Wants</h3>
            <span className="column-count">{wants.length}</span>
          </div>
          {wants.length === 0 ? (
            <div className="column-empty">No wishlist items</div>
          ) : (
            wants.map((item) => (
              <ShoppingListItem key={item.id} item={item} actions={actions} />
            ))
          )}
        </div>
        <div className="shopping-column">
          <div className="shopping-column-header done-header">
            <Icon name="check_circle" className="column-icon" />
            <h3>Done</h3>
            <span className="column-count">{done.length}</span>
          </div>
          {done.length === 0 ? (
            <div className="column-empty">Nothing bought yet</div>
          ) : (
            done.map((item) => (
              <ShoppingDoneItem
                key={item.id}
                item={item}
                onUndone={actions.toggle}
                onDelete={actions.remove}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
