// Entity types for the list families that carry no lifecycle rules of
// their own. Shared by the server (persistence, constructs) and the
// client stores — one definition, two callers. Task and RecurringItem
// live with their rules in task-rules.ts and recurrence.ts.

export type ShoppingItem = {
  id: string;
  title: string;
  done: boolean;
  archived: boolean;
  category: "want" | "need";
  links: string[];
  createdAt: string;
  doneAt: string | null;
};

export type GroceryItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  category: "task" | "reference";
};
