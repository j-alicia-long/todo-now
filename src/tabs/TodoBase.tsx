import { useTheme } from "@/components/theme-provider";
import { useState } from "react";
import { type RecurringCardActions } from "../components/BoardColumn";
import { DatePickerDropdown } from "../components/DatePicker";
import { type RecurringItemActions } from "../components/RecurringListItem";
import {
  type GroceryItemActions,
  type ShoppingItemActions,
} from "../components/ShoppingItems";
import { type TaskActions } from "../components/TaskCard";
import { Icon } from "../components/ui";
import { type Task, type TaskStatus } from "../domain/task-rules";
import { formatDueDate, formatHeadingDate } from "../lib/presentation";
import {
  useGroceries,
  useRecurring,
  useSettings,
  useShopping,
  useTasks,
  type RecurringItem,
  type Settings,
} from "../stores/hooks";
import { BoardTab } from "./BoardTab";
import { GroceriesTab } from "./GroceriesTab";
import { RecurringModal } from "./RecurringModal";
import { RecurringTab } from "./RecurringTab";
import { ShoppingTab } from "./ShoppingTab";
import {
  SidebarDrawer,
  type SidebarDrawerActions,
  type SidebarPanel,
} from "./SidebarDrawer";
import "./TodoBase.scss";

type ViewTab = "board" | "shopping" | "groceries" | "recurring";

type TodoHeaderProps = {
  resolvedTheme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  pushTheme: (theme: "light" | "dark") => void;
  sidebarPanel: SidebarPanel | null;
  setSidebarPanel: (panel: SidebarPanel | null) => void;
};

type ViewTabButtonProps = {
  tab: ViewTab;
  activeTab: ViewTab;
  icon: string;
  label: string;
  onSelect: (tab: ViewTab) => void;
  extraClassName?: string;
  count?: number;
  countClassName?: string;
};

type AddItemFormProps = {
  viewTab: ViewTab;
  newTitle: string;
  setNewTitle: (title: string) => void;
  addPlaceholder: string;
  onSubmit: (e: React.FormEvent) => void;
  newTaskDueDate: string | null;
  showAddDatePicker: boolean;
  onToggleDatePicker: () => void;
  onSetNewTaskDueDate: (value: string | null) => void;
  onCloseDatePicker: () => void;
};

const TodoHeader = ({
  resolvedTheme,
  setTheme,
  pushTheme,
  sidebarPanel,
  setSidebarPanel,
}: TodoHeaderProps) => (
  <header className="todo-header">
    <h1>
      <Icon name="eco" /> {formatHeadingDate()}
    </h1>
    <div className="header-actions">
      <button
        className="theme-toggle"
        onClick={() => {
          const next = resolvedTheme === "dark" ? "light" : "dark";
          setTheme(next);
          pushTheme(next);
        }}
        aria-label="Toggle theme"
      >
        <Icon name={resolvedTheme === "dark" ? "light_mode" : "dark_mode"} />
      </button>
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarPanel(sidebarPanel ? null : "settings")}
        aria-label="Settings"
      >
        <Icon name="settings" />
      </button>
    </div>
  </header>
);

const ViewTabButton = ({
  tab,
  activeTab,
  icon,
  label,
  onSelect,
  extraClassName,
  count,
  countClassName,
}: ViewTabButtonProps) => (
  <button
    className={`view-tab ${extraClassName ?? ""} ${activeTab === tab ? "active" : ""}`.trim()}
    onClick={() => onSelect(tab)}
  >
    <Icon name={icon} className="tab-icon" />
    <span className="tab-label"> {label}</span>
    {count && count > 0 ? (
      <span className={`tab-count ${countClassName ?? ""}`.trim()}>
        {count}
      </span>
    ) : null}
  </button>
);

const AddItemForm = ({
  viewTab,
  newTitle,
  setNewTitle,
  addPlaceholder,
  onSubmit,
  newTaskDueDate,
  showAddDatePicker,
  onToggleDatePicker,
  onSetNewTaskDueDate,
  onCloseDatePicker,
}: AddItemFormProps) => {
  if (viewTab === "recurring") return null;

  return (
    <form className="add-task-form" onSubmit={onSubmit}>
      <div className="add-form-main-row">
        <input
          className="add-task-input"
          type="text"
          placeholder={addPlaceholder}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        {viewTab === "board" && (
          <div className="add-date-picker-wrapper">
            <button
              type="button"
              className={`add-date-btn ${newTaskDueDate ? "has-date" : ""}`}
              onClick={onToggleDatePicker}
              title={
                newTaskDueDate
                  ? `Due: ${formatDueDate(newTaskDueDate)}`
                  : "Set due date"
              }
            >
              <Icon name="calendar_month" />
              {newTaskDueDate && (
                <span className="add-date-label">
                  {formatDueDate(newTaskDueDate)}
                </span>
              )}
            </button>
            {showAddDatePicker && (
              <DatePickerDropdown
                value={newTaskDueDate}
                onChange={onSetNewTaskDueDate}
                onClose={onCloseDatePicker}
              />
            )}
          </div>
        )}
        <button className="add-task-btn" type="submit">
          Add
        </button>
      </div>
    </form>
  );
};

// Date/label helpers live in src/lib/presentation.ts;
// toLocalDateKey lives in src/domain/recurrence.ts.

// ── Controller ──

export default function TodoBase() {
  const { theme, setTheme } = useTheme();
  const tasksStore = useTasks();
  const shopping = useShopping();
  const groceries = useGroceries();
  const recurring = useRecurring();
  const {
    settings,
    toggle: toggleSettingKey,
    pushTheme,
  } = useSettings({ onServerTheme: setTheme });
  const tasks = tasksStore.tasks;
  const shoppingItems = shopping.items;
  const groceryItems = groceries.items;
  const recurringItems = recurring.items;
  const loading = !tasksStore.loaded;
  const [newTitle, setNewTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<string | null>(null);
  const [showAddDatePicker, setShowAddDatePicker] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("board");
  // The modal mounts fresh on each open and owns its draft fields; the
  // controller only tracks whether it's open and which item is being edited.
  const [recurringModal, setRecurringModal] = useState<{
    item: RecurringItem | null;
    category: "task" | "reference";
  } | null>(null);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel | null>(null);

  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  const toggleSetting = (key: keyof Settings) => {
    toggleSettingKey(key, resolvedTheme as "light" | "dark");
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const task = await tasksStore.add({
      title,
      status: "this-week" satisfies TaskStatus,
      dueDate: newTaskDueDate,
    });
    if (!task) return;
    setNewTitle("");
    setNewTaskDueDate(null);
    setShowAddDatePicker(false);
  };

  const addTaskFromList = async (
    title: string,
    source: string,
    sourceItemId: string
  ) => {
    await tasksStore.add({ title, status: "this-week", source, sourceItemId });
  };

  const changeStatus = async (id: string, status: TaskStatus) => {
    const task = tasks.find((t) => t.id === id);
    const ok = await tasksStore.changeStatus(id, status);
    // Cross-family effect: completing a task spawned from a list item
    // marks the source item done too.
    if (ok && status === "done" && task?.sourceItemId) {
      if (task.source === "shopping") toggleShoppingItem(task.sourceItemId);
      else if (task.source === "grocery") toggleGroceryItem(task.sourceItemId);
    }
  };

  const updateTask = async (id: string, fields: Partial<Task>) => {
    await tasksStore.update(id, fields);
  };

  const deleteTask = async (id: string) => {
    await tasksStore.trash(id);
  };

  const restoreTask = async (id: string) => {
    tasksStore.restore(id);
  };

  const permanentDelete = async (id: string) => {
    await tasksStore.removePermanently(id);
  };

  // Narrow handles passed to card components. changeStatus carries the
  // cross-family coordination, so cards get these wrappers — not the raw
  // store actions.
  const taskActions: TaskActions = {
    changeStatus,
    update: updateTask,
    trash: deleteTask,
  };

  // ── Shopping CRUD ──

  const addShoppingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const item = await shopping.add(title);
    if (item) setNewTitle("");
  };

  const toggleShoppingItem = async (id: string) => {
    await shopping.toggle(id);
  };

  const archiveShoppingItem = async (id: string) => {
    await shopping.setArchived(id, true);
  };

  const unarchiveShoppingItem = async (id: string) => {
    await shopping.setArchived(id, false);
  };

  const deleteShoppingItem = async (id: string) => {
    await shopping.remove(id);
  };

  const updateShoppingLinks = async (id: string, links: string[]) => {
    await shopping.updateLinks(id, links);
  };

  const changeShoppingCategory = async (id: string) => {
    await shopping.toggleCategory(id);
  };

  const shoppingItemActions: ShoppingItemActions = {
    toggle: toggleShoppingItem,
    archive: archiveShoppingItem,
    remove: deleteShoppingItem,
    move: changeShoppingCategory,
    addToBoard: addTaskFromList,
    updateLinks: updateShoppingLinks,
  };

  // ── Grocery CRUD ──

  const addGroceryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const item = await groceries.add(title);
    if (item) setNewTitle("");
  };

  const toggleGroceryItem = async (id: string) => {
    await groceries.toggle(id);
  };

  const deleteGroceryItem = async (id: string) => {
    await groceries.remove(id);
  };

  const clearBoughtGroceries = async () => {
    await groceries.clearBought();
  };

  const groceryItemActions: GroceryItemActions = {
    toggle: toggleGroceryItem,
    remove: deleteGroceryItem,
    addToBoard: addTaskFromList,
  };

  // ── Recurring CRUD ──

  const openRecurringEdit = (item: RecurringItem) => {
    setRecurringModal({ item, category: item.category });
  };

  const submitRecurring = async (fields: Partial<RecurringItem>) => {
    if (recurringModal?.item) {
      updateRecurringItem(recurringModal.item.id, fields);
      setRecurringModal(null);
    } else {
      const item = await recurring.add(fields);
      if (item) setRecurringModal(null);
    }
  };

  const toggleRecurringItem = async (id: string) => {
    await recurring.toggle(id);
  };

  const deleteRecurringItem = async (id: string) => {
    await recurring.remove(id);
  };

  const updateRecurringItem = async (
    id: string,
    fields: Partial<RecurringItem>
  ) => {
    await recurring.update(id, fields);
  };

  const recurringActions: RecurringCardActions = {
    toggle: toggleRecurringItem,
    remove: deleteRecurringItem,
    update: updateRecurringItem,
  };

  const recurringItemActions: RecurringItemActions = {
    toggle: toggleRecurringItem,
    remove: deleteRecurringItem,
    update: updateRecurringItem,
    edit: openRecurringEdit,
  };

  const sidebarActions: SidebarDrawerActions = {
    navigate: setSidebarPanel,
    close: () => setSidebarPanel(null),
    restoreTask,
    permanentDeleteTask: permanentDelete,
    unarchiveShoppingItem,
    deleteShoppingItem,
    toggleSetting,
  };

  // Tab badge counts (each tab derives its own view slices internally).
  const shoppingCount = shoppingItems.filter((i) => !i.archived).length;

  if (loading) {
    return (
      <div className="todo-page">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  const handleAddForm =
    viewTab === "shopping"
      ? addShoppingItem
      : viewTab === "groceries"
        ? addGroceryItem
        : addTask;
  const addPlaceholder =
    viewTab === "shopping"
      ? "Add a shopping item..."
      : viewTab === "groceries"
        ? "Add a grocery item..."
        : viewTab === "recurring"
          ? "Add a recurring item..."
          : "Add a task...";

  return (
    <div className="todo-page">
      <TodoHeader
        resolvedTheme={resolvedTheme}
        setTheme={setTheme}
        pushTheme={pushTheme}
        sidebarPanel={sidebarPanel}
        setSidebarPanel={setSidebarPanel}
      />

      <div className="view-tabs">
        <ViewTabButton
          tab="board"
          activeTab={viewTab}
          icon="dashboard"
          label="Board"
          onSelect={setViewTab}
        />
        <ViewTabButton
          tab="recurring"
          activeTab={viewTab}
          icon="repeat"
          label="Recurring"
          onSelect={setViewTab}
          extraClassName="recurring-tab"
          count={recurringItems.length}
          countClassName="recurring-count"
        />
        <ViewTabButton
          tab="shopping"
          activeTab={viewTab}
          icon="shopping_bag"
          label="Shopping"
          onSelect={setViewTab}
          extraClassName="shopping-tab"
          count={shoppingCount}
          countClassName="shopping-count"
        />
        <ViewTabButton
          tab="groceries"
          activeTab={viewTab}
          icon="grocery"
          label="Groceries"
          onSelect={setViewTab}
          extraClassName="grocery-tab"
          count={groceryItems.length}
          countClassName="grocery-count"
        />
      </div>

      <AddItemForm
        viewTab={viewTab}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        addPlaceholder={addPlaceholder}
        onSubmit={handleAddForm}
        newTaskDueDate={newTaskDueDate}
        showAddDatePicker={showAddDatePicker}
        onToggleDatePicker={() => setShowAddDatePicker(!showAddDatePicker)}
        onSetNewTaskDueDate={setNewTaskDueDate}
        onCloseDatePicker={() => setShowAddDatePicker(false)}
      />

      {(() => {
        switch (viewTab) {
          case "board":
            return (
              <BoardTab
                tasks={tasks}
                taskActions={taskActions}
                recurringItems={recurringItems}
                recurringActions={recurringActions}
                settings={settings}
              />
            );
          case "shopping":
            return (
              <ShoppingTab
                items={shoppingItems}
                actions={shoppingItemActions}
              />
            );
          case "groceries":
            return (
              <GroceriesTab
                items={groceryItems}
                actions={groceryItemActions}
                onClearBought={clearBoughtGroceries}
              />
            );
          case "recurring":
            return (
              <RecurringTab
                items={recurringItems}
                actions={recurringItemActions}
                onAdd={(category) =>
                  setRecurringModal({ item: null, category })
                }
              />
            );
          default:
            return null;
        }
      })()}

      {recurringModal && (
        <RecurringModal
          item={recurringModal.item}
          category={recurringModal.category}
          onSubmit={submitRecurring}
          onClose={() => setRecurringModal(null)}
        />
      )}

      {sidebarPanel && (
        <SidebarDrawer
          panel={sidebarPanel}
          tasks={tasks}
          shoppingItems={shoppingItems}
          taskActions={taskActions}
          settings={settings}
          actions={sidebarActions}
        />
      )}
    </div>
  );
}
