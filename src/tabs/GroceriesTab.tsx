// Groceries tab: single checklist column with a clear-bought action.

import { type GroceryItem } from "../stores/hooks";
import { Icon } from "../components/ui";
import {
  GroceryListItem,
  type GroceryItemActions,
} from "../components/ShoppingItems";

export const GroceriesTab = ({
  items,
  actions,
  onClearBought,
}: {
  items: GroceryItem[];
  actions: GroceryItemActions;
  onClearBought: () => void;
}) => {
  const unbought = items.filter((i) => !i.done);
  const bought = items.filter((i) => i.done);

  return (
    <div className="grocery-board">
      <div className="grocery-column">
        <div className="grocery-column-header">
          <Icon name="shopping_cart" className="column-icon" />
          <h3>Groceries</h3>
          <span className="column-count">{unbought.length}</span>
          {bought.length > 0 && (
            <button className="clear-bought-btn" onClick={onClearBought}>
              <Icon name="delete_sweep" /> Clear {bought.length} bought
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="column-empty">Grocery list is empty</div>
        ) : (
          <>
            {unbought.map((item) => (
              <GroceryListItem key={item.id} item={item} actions={actions} />
            ))}
            {bought.map((item) => (
              <GroceryListItem key={item.id} item={item} actions={actions} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};
