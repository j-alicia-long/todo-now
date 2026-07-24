import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { type Task, type TaskStatus } from "../domain/task-rules";
import {
  boardWeeklyItems,
  deriveFirstDueDate,
  upcomingLongTermItems,
} from "../domain/recurrence";
import {
  useTasks,
  useShopping,
  useGroceries,
  useRecurring,
  useSettings,
  isWeeklyRecurring,
  type RecurringItem,
  type Settings,
} from "../stores/hooks";
import { Icon } from "../components/ui";
import { DatePickerDropdown } from "../components/DatePicker";
import { TaskCard, type TaskActions } from "../components/TaskCard";
import { FutureTaskCard } from "../components/FutureTaskCard";
import { TrashCard } from "../components/TrashCard";
import {
  BoardColumn,
  type RecurringCardActions,
} from "../components/BoardColumn";
import {
  ShoppingListItem,
  ShoppingDoneItem,
  GroceryListItem,
  type ShoppingItemActions,
  type GroceryItemActions,
} from "../components/ShoppingItems";
import {
  RecurringListItem,
  type RecurringItemActions,
} from "../components/RecurringListItem";
import { SettingsView } from "../components/SettingsView";
import {
  AREA_OPTIONS,
  DAY_LETTERS,
  REPEAT_UNITS,
  formatDueDate,
  formatHeadingDate,
  sortTasks,
} from "../lib/presentation";
import "./TodoPage.scss";

type ViewTab = "board" | "shopping" | "groceries" | "recurring";
type SidebarPanel =
  "todo-archive" | "todo-trash" | "shopping-archive" | "settings" | null;

const BOARD_COLUMNS: {
  id: TaskStatus;
  title: string;
  icon: string;
  colorClass: string;
}[] = [
  {
    id: "this-week",
    title: "This Week",
    icon: "bolt",
    colorClass: "col-purple",
  },
  {
    id: "this-month",
    title: "This Month",
    icon: "date_range",
    colorClass: "col-purple",
  },
  { id: "done", title: "Done", icon: "check_circle", colorClass: "col-green" },
];

// Date/label helpers live in src/lib/presentation.ts;
// toLocalDateKey lives in src/domain/recurrence.ts.

// ── Main Page ──

export default function TodoPage() {
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
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("board");
  const [recurringAddLink, setRecurringAddLink] = useState("");
  const [recurringAddNote, setRecurringAddNote] = useState("");
  const [recurringAddDay, setRecurringAddDay] = useState<number | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(
    null
  );
  const [recurringAddCategory, setRecurringAddCategory] = useState<
    "task" | "reference"
  >("task");
  const [recurringAddRepeatEvery, setRecurringAddRepeatEvery] = useState(1);
  const [recurringAddRepeatUnit, setRecurringAddRepeatUnit] = useState<
    "day" | "week" | "month" | "year"
  >("week");
  const [recurringAddRepeatDays, setRecurringAddRepeatDays] = useState<
    number[]
  >([]);
  const [recurringAddEndsType, setRecurringAddEndsType] = useState<
    "never" | "on" | "after"
  >("never");
  const [recurringAddEndsOn, setRecurringAddEndsOn] = useState("");
  const [recurringAddEndsAfter, setRecurringAddEndsAfter] = useState(13);
  const [recurringAddDueDate, setRecurringAddDueDate] = useState("");
  const [recurringAddShowEarly, setRecurringAddShowEarly] = useState("");
  const [showRecurringDatePicker, setShowRecurringDatePicker] = useState(false);
  const [recurringAddArea, setRecurringAddArea] = useState("");
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>(null);

  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  const isTouchDevice =
    typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
  const sensors = useSensors(
    ...(isTouchDevice
      ? []
      : [useSensor(PointerSensor, { activationConstraint: { distance: 8 } })])
  );

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

  const closeRecurringModal = () => {
    setShowRecurringModal(false);
    setEditingRecurringId(null);
    setNewTitle("");
    setRecurringAddCategory("task");
    setRecurringAddLink("");
    setRecurringAddNote("");
    setRecurringAddDay(null);
    setRecurringAddRepeatEvery(1);
    setRecurringAddRepeatUnit("week");
    setRecurringAddRepeatDays([]);
    setRecurringAddEndsType("never");
    setRecurringAddEndsOn("");
    setRecurringAddEndsAfter(13);
    setRecurringAddDueDate("");
    setRecurringAddShowEarly("");
    setShowRecurringDatePicker(false);
    setRecurringAddArea("");
  };

  const openRecurringEdit = (item: RecurringItem) => {
    setEditingRecurringId(item.id);
    setNewTitle(item.title);
    setRecurringAddCategory(item.category);
    setRecurringAddLink(item.link);
    setRecurringAddNote(item.note);
    setRecurringAddDay(item.dayOfWeek);
    setRecurringAddRepeatEvery(item.repeatEvery || 1);
    setRecurringAddRepeatUnit(item.repeatUnit || "week");
    setRecurringAddRepeatDays(item.repeatDays || []);
    setRecurringAddEndsType(item.endsType || "never");
    setRecurringAddEndsOn(item.endsOn || "");
    setRecurringAddEndsAfter(item.endsAfter || 13);
    setRecurringAddDueDate(item.dueDate || "");
    setRecurringAddShowEarly(
      item.showEarlyDays != null ? String(item.showEarlyDays) : ""
    );
    setRecurringAddArea(item.area || "");
    setShowRecurringModal(true);
  };

  const handleRecurringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const isEvent = recurringAddCategory === "reference";
    const effectiveDay = isEvent
      ? recurringAddDay
      : recurringAddRepeatDays.length > 0
        ? recurringAddRepeatDays[0]
        : recurringAddDay;
    let dueDate: string | null = recurringAddDueDate || null;
    if (!dueDate && effectiveDay != null && !isEvent) {
      dueDate = deriveFirstDueDate(effectiveDay, new Date());
    }
    const fields: Record<string, unknown> = {
      title,
      frequency: "weekly",
      category: recurringAddCategory,
      link: recurringAddLink.trim(),
      note: recurringAddNote.trim(),
      dayOfWeek: effectiveDay,
      dueDate,
      area: recurringAddArea || "",
    };
    if (!isEvent) {
      fields.repeatEvery = recurringAddRepeatEvery;
      fields.repeatUnit = recurringAddRepeatUnit;
      fields.repeatDays = recurringAddRepeatDays;
      fields.endsType = recurringAddEndsType;
      fields.endsOn = recurringAddEndsType === "on" ? recurringAddEndsOn : null;
      fields.endsAfter =
        recurringAddEndsType === "after" ? recurringAddEndsAfter : null;
      fields.showEarlyDays =
        recurringAddShowEarly.trim() === ""
          ? null
          : Math.max(0, parseInt(recurringAddShowEarly) || 0);
    }

    if (editingRecurringId) {
      updateRecurringItem(editingRecurringId, fields as Partial<RecurringItem>);
      closeRecurringModal();
    } else {
      const item = await recurring.add(fields);
      if (item) closeRecurringModal();
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

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const targetColumn = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetColumn) return;
    changeStatus(taskId, targetColumn);
  };

  const tasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);
  const futureTasks = tasksByStatus("future");
  const trashedTasks = tasksByStatus("trashed");
  const activeShoppingItems = shoppingItems.filter(
    (i) => !i.archived && !i.done
  );
  const doneShoppingItems = shoppingItems.filter((i) => !i.archived && i.done);
  const archivedShoppingItems = shoppingItems.filter((i) => i.archived);
  const shoppingNeeds = activeShoppingItems.filter(
    (i) => i.category === "need"
  );
  const shoppingWants = activeShoppingItems.filter(
    (i) => i.category === "want"
  );
  const boughtGroceries = groceryItems.filter((i) => i.done);
  const unboughtGroceries = groceryItems.filter((i) => !i.done);
  const isWeeklyItem = isWeeklyRecurring;
  const allTasks = recurringItems.filter((i) => i.category === "task");
  const allReferences = recurringItems.filter(
    (i) => i.category === "reference"
  );
  const weeklyTasks = allTasks.filter(isWeeklyItem);
  const boardWeeklyTasks = boardWeeklyItems(weeklyTasks, new Date());
  const unitOrder: Record<string, number> = {
    day: 0,
    week: 1,
    month: 2,
    year: 3,
  };
  const longTermTasks = allTasks
    .filter((i) => !isWeeklyItem(i))
    .sort(
      (a, b) => (unitOrder[a.repeatUnit] ?? 9) - (unitOrder[b.repeatUnit] ?? 9)
    );
  const weeklyDoneCount = weeklyTasks.filter((i) => i.completedThisWeek).length;
  const upcomingLongTerm = upcomingLongTermItems(longTermTasks, new Date());
  const allBoardRecurring = [...boardWeeklyTasks, ...upcomingLongTerm];
  const boardRecurringTasks = allBoardRecurring.filter(
    (i) => !i.completedThisWeek
  );
  const boardRecurringDone = allBoardRecurring.filter(
    (i) => i.completedThisWeek
  );

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
            <Icon
              name={resolvedTheme === "dark" ? "light_mode" : "dark_mode"}
            />
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

      <div className="view-tabs">
        <button
          className={`view-tab ${viewTab === "board" ? "active" : ""}`}
          onClick={() => setViewTab("board")}
        >
          <Icon name="dashboard" className="tab-icon" />
          <span className="tab-label"> Board</span>
        </button>
        <button
          className={`view-tab recurring-tab ${viewTab === "recurring" ? "active" : ""}`}
          onClick={() => setViewTab("recurring")}
        >
          <Icon name="repeat" className="tab-icon" />
          <span className="tab-label"> Recurring</span>{" "}
          {recurringItems.length > 0 && (
            <span className="tab-count recurring-count">
              {recurringItems.length}
            </span>
          )}
        </button>
        <button
          className={`view-tab shopping-tab ${viewTab === "shopping" ? "active" : ""}`}
          onClick={() => setViewTab("shopping")}
        >
          <Icon name="shopping_bag" className="tab-icon" />
          <span className="tab-label"> Shopping</span>{" "}
          {activeShoppingItems.length + doneShoppingItems.length > 0 && (
            <span className="tab-count shopping-count">
              {activeShoppingItems.length + doneShoppingItems.length}
            </span>
          )}
        </button>
        <button
          className={`view-tab grocery-tab ${viewTab === "groceries" ? "active" : ""}`}
          onClick={() => setViewTab("groceries")}
        >
          <Icon name="grocery" className="tab-icon" />
          <span className="tab-label"> Groceries</span>{" "}
          {groceryItems.length > 0 && (
            <span className="tab-count grocery-count">
              {groceryItems.length}
            </span>
          )}
        </button>
      </div>

      {viewTab !== "recurring" && (
        <form className="add-task-form" onSubmit={handleAddForm}>
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
                  onClick={() => setShowAddDatePicker(!showAddDatePicker)}
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
                    onChange={(d) => setNewTaskDueDate(d)}
                    onClose={() => setShowAddDatePicker(false)}
                  />
                )}
              </div>
            )}
            <button className="add-task-btn" type="submit">
              Add
            </button>
          </div>
        </form>
      )}

      {viewTab === "board" && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="board">
            {BOARD_COLUMNS.map((col) => (
              <BoardColumn
                key={col.id}
                id={col.id}
                title={col.title}
                icon={col.icon}
                colorClass={col.colorClass}
                tasks={tasksByStatus(col.id)}
                taskActions={taskActions}
                settings={settings}
                recurring={
                  col.id === "this-week"
                    ? { items: boardRecurringTasks, actions: recurringActions }
                    : col.id === "done"
                      ? { items: boardRecurringDone, actions: recurringActions }
                      : undefined
                }
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <TaskCard
                task={activeTask}
                actions={{
                  changeStatus: () => {},
                  update: () => {},
                  trash: () => {},
                }}
                settings={settings}
                isDragOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {viewTab === "shopping" && (
        <div className="shopping-board">
          <div className="shopping-columns">
            <div className="shopping-column">
              <div className="shopping-column-header needs-header">
                <Icon name="priority_high" className="column-icon" />
                <h3>Needs</h3>
                <span className="column-count">{shoppingNeeds.length}</span>
              </div>
              {shoppingNeeds.length === 0 ? (
                <div className="column-empty">No items needed right now</div>
              ) : (
                shoppingNeeds.map((item) => (
                  <ShoppingListItem
                    key={item.id}
                    item={item}
                    actions={shoppingItemActions}
                  />
                ))
              )}
            </div>
            <div className="shopping-column">
              <div className="shopping-column-header wants-header">
                <Icon name="favorite" className="column-icon" />
                <h3>Wants</h3>
                <span className="column-count">{shoppingWants.length}</span>
              </div>
              {shoppingWants.length === 0 ? (
                <div className="column-empty">No wishlist items</div>
              ) : (
                shoppingWants.map((item) => (
                  <ShoppingListItem
                    key={item.id}
                    item={item}
                    actions={shoppingItemActions}
                  />
                ))
              )}
            </div>
            <div className="shopping-column">
              <div className="shopping-column-header done-header">
                <Icon name="check_circle" className="column-icon" />
                <h3>Done</h3>
                <span className="column-count">{doneShoppingItems.length}</span>
              </div>
              {doneShoppingItems.length === 0 ? (
                <div className="column-empty">Nothing bought yet</div>
              ) : (
                doneShoppingItems.map((item) => (
                  <ShoppingDoneItem
                    key={item.id}
                    item={item}
                    onUndone={toggleShoppingItem}
                    onDelete={deleteShoppingItem}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {viewTab === "groceries" && (
        <div className="grocery-board">
          <div className="grocery-column">
            <div className="grocery-column-header">
              <Icon name="shopping_cart" className="column-icon" />
              <h3>Groceries</h3>
              <span className="column-count">{unboughtGroceries.length}</span>
              {boughtGroceries.length > 0 && (
                <button
                  className="clear-bought-btn"
                  onClick={clearBoughtGroceries}
                >
                  <Icon name="delete_sweep" /> Clear {boughtGroceries.length}{" "}
                  bought
                </button>
              )}
            </div>
            {groceryItems.length === 0 ? (
              <div className="column-empty">Grocery list is empty</div>
            ) : (
              <>
                {unboughtGroceries.map((item) => (
                  <GroceryListItem
                    key={item.id}
                    item={item}
                    actions={groceryItemActions}
                  />
                ))}
                {boughtGroceries.map((item) => (
                  <GroceryListItem
                    key={item.id}
                    item={item}
                    actions={groceryItemActions}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {viewTab === "recurring" && (
        <div className="recurring-board">
          <div className="recurring-left-col">
            <button
              className="recurring-col-add-btn"
              onClick={() => {
                setRecurringAddCategory("task");
                setShowRecurringModal(true);
              }}
            >
              <Icon name="add" /> Add Task
            </button>
            <div className="recurring-section">
              <div className="recurring-section-header">
                <Icon name="check_circle" className="column-icon" />
                <h3>Weekly Tasks</h3>
                {weeklyTasks.length > 0 && (
                  <span className="recurring-progress">
                    {weeklyDoneCount}/{weeklyTasks.length} done
                  </span>
                )}
              </div>
              {weeklyTasks.length === 0 ? (
                <div className="column-empty">No weekly tasks yet</div>
              ) : (
                weeklyTasks.map((item) => (
                  <RecurringListItem
                    key={item.id}
                    item={item}
                    actions={recurringItemActions}
                  />
                ))
              )}
            </div>
            {longTermTasks.length > 0 && (
              <div className="recurring-section long-term-section">
                <div className="recurring-section-header">
                  <Icon name="event_repeat" className="column-icon" />
                  <h3>Long-term</h3>
                  <span className="column-count">{longTermTasks.length}</span>
                </div>
                {longTermTasks.map((item) => (
                  <RecurringListItem
                    key={item.id}
                    item={item}
                    actions={recurringItemActions}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="recurring-right-col">
            <button
              className="recurring-col-add-btn events-add-btn"
              onClick={() => {
                setRecurringAddCategory("reference");
                setShowRecurringModal(true);
              }}
            >
              <Icon name="add" /> Add Event / Class
            </button>
            <div className="recurring-section events-section">
              <div className="recurring-section-header">
                <Icon name="event" className="column-icon" />
                <h3>Events & Classes</h3>
                <span className="column-count">{allReferences.length}</span>
              </div>
              {allReferences.length === 0 ? (
                <div className="column-empty">No events or classes yet</div>
              ) : (
                allReferences.map((item) => (
                  <RecurringListItem
                    key={item.id}
                    item={item}
                    actions={recurringItemActions}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showRecurringModal && (
        <div className="recurring-modal-overlay" onClick={closeRecurringModal}>
          <div
            className={`recurring-modal ${recurringAddCategory === "reference" ? "event-modal" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="recurring-modal-header">
              <h3>
                {editingRecurringId
                  ? recurringAddCategory === "reference"
                    ? "Edit Event / Class"
                    : "Edit Recurring Task"
                  : recurringAddCategory === "reference"
                    ? "Add Event / Class"
                    : "Add Recurring Task"}
              </h3>
              <button
                className="recurring-modal-close"
                onClick={closeRecurringModal}
              >
                <Icon name="close" />
              </button>
            </div>
            <form
              className="recurring-modal-form"
              onSubmit={handleRecurringSubmit}
            >
              <input
                className="recurring-modal-input"
                type="text"
                placeholder={
                  recurringAddCategory === "reference"
                    ? "Event or class name..."
                    : "What do you do regularly?"
                }
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />

              <div className="recurring-modal-row">
                <select
                  className="recurring-modal-select"
                  value={recurringAddArea}
                  onChange={(e) => setRecurringAddArea(e.target.value)}
                >
                  <option value="">Area (optional)</option>
                  {AREA_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="add-date-picker-wrapper">
                  <button
                    type="button"
                    className={`add-date-btn recurring-date-btn ${recurringAddDueDate ? "has-date" : ""}`}
                    onClick={() =>
                      setShowRecurringDatePicker(!showRecurringDatePicker)
                    }
                    title={
                      recurringAddDueDate
                        ? `Due: ${formatDueDate(recurringAddDueDate)}`
                        : "Set due date"
                    }
                  >
                    <Icon name="calendar_month" />
                    {recurringAddDueDate ? (
                      <span className="add-date-label">
                        {formatDueDate(recurringAddDueDate)}
                      </span>
                    ) : (
                      <span className="add-date-label">Date</span>
                    )}
                  </button>
                  {showRecurringDatePicker && (
                    <DatePickerDropdown
                      value={recurringAddDueDate || null}
                      onChange={(d) => setRecurringAddDueDate(d || "")}
                      onClose={() => setShowRecurringDatePicker(false)}
                    />
                  )}
                </div>
              </div>

              {recurringAddCategory === "task" && (
                <div className="recurrence-picker">
                  <div className="recurrence-section">
                    <label className="recurrence-label">Repeat every</label>
                    <div className="recurrence-repeat-row">
                      <input
                        className="recurrence-number-input"
                        type="number"
                        min={1}
                        max={99}
                        value={recurringAddRepeatEvery}
                        onChange={(e) =>
                          setRecurringAddRepeatEvery(
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                      />
                      <select
                        className="recurrence-unit-select"
                        value={recurringAddRepeatUnit}
                        onChange={(e) =>
                          setRecurringAddRepeatUnit(
                            e.target.value as "day" | "week" | "month" | "year"
                          )
                        }
                      >
                        {REPEAT_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {recurringAddRepeatEvery === 1 ? u : u + "s"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {recurringAddRepeatUnit === "week" && (
                    <div className="recurrence-section">
                      <label className="recurrence-label">Repeat on</label>
                      <div className="recurrence-days-row">
                        {DAY_LETTERS.map((letter, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={`recurrence-day-btn ${recurringAddRepeatDays.includes(idx) ? "active" : ""}`}
                            onClick={() => {
                              setRecurringAddRepeatDays((prev) =>
                                prev.includes(idx)
                                  ? prev.filter((d) => d !== idx)
                                  : [...prev, idx].sort()
                              );
                            }}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="recurrence-section">
                    <label className="recurrence-label">Ends</label>
                    <div className="recurrence-ends-options">
                      <label className="recurrence-radio-row">
                        <input
                          type="radio"
                          name="ends"
                          checked={recurringAddEndsType === "never"}
                          onChange={() => setRecurringAddEndsType("never")}
                        />
                        <span>Never</span>
                      </label>
                      <label className="recurrence-radio-row">
                        <input
                          type="radio"
                          name="ends"
                          checked={recurringAddEndsType === "on"}
                          onChange={() => setRecurringAddEndsType("on")}
                        />
                        <span>On</span>
                        <input
                          type="date"
                          className="recurrence-date-input"
                          value={recurringAddEndsOn}
                          onChange={(e) => {
                            setRecurringAddEndsOn(e.target.value);
                            setRecurringAddEndsType("on");
                          }}
                          disabled={recurringAddEndsType !== "on"}
                        />
                      </label>
                      <label className="recurrence-radio-row">
                        <input
                          type="radio"
                          name="ends"
                          checked={recurringAddEndsType === "after"}
                          onChange={() => setRecurringAddEndsType("after")}
                        />
                        <span>After</span>
                        <input
                          type="number"
                          className="recurrence-occurrence-input"
                          min={1}
                          value={recurringAddEndsAfter}
                          onChange={(e) => {
                            setRecurringAddEndsAfter(
                              Math.max(1, parseInt(e.target.value) || 1)
                            );
                            setRecurringAddEndsType("after");
                          }}
                          disabled={recurringAddEndsType !== "after"}
                        />
                        <span className="recurrence-occurrence-label">
                          occurrences
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="recurrence-section">
                    <label className="recurrence-label">Show on board</label>
                    <div className="recurrence-row">
                      <input
                        type="number"
                        className="recurrence-occurrence-input"
                        min={0}
                        placeholder={
                          recurringAddRepeatUnit === "week" &&
                          recurringAddRepeatEvery === 1
                            ? "0"
                            : "14"
                        }
                        value={recurringAddShowEarly}
                        onChange={(e) =>
                          setRecurringAddShowEarly(e.target.value)
                        }
                      />
                      <span className="recurrence-occurrence-label">
                        days early
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <input
                className="recurring-modal-input"
                type="url"
                placeholder="Link (optional) — e.g. schedule page, group chat"
                value={recurringAddLink}
                onChange={(e) => setRecurringAddLink(e.target.value)}
              />
              <input
                className="recurring-modal-input"
                type="text"
                placeholder="Note (optional)"
                value={recurringAddNote}
                onChange={(e) => setRecurringAddNote(e.target.value)}
              />
              <button className="recurring-modal-submit" type="submit">
                {editingRecurringId ? "Save" : "Add"}
              </button>
            </form>
          </div>
        </div>
      )}

      {sidebarPanel && (
        <div className="sidebar-overlay" onClick={() => setSidebarPanel(null)}>
          <div className="sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <h2>Settings</h2>
              <button
                className="sidebar-close"
                onClick={() => setSidebarPanel(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <nav className="sidebar-nav">
              <button
                className={`sidebar-nav-item ${sidebarPanel === "todo-archive" ? "active" : ""}`}
                onClick={() => setSidebarPanel("todo-archive")}
              >
                <Icon name="inventory_2" /> Todo Archive{" "}
                {futureTasks.length > 0 && (
                  <span className="sidebar-count">{futureTasks.length}</span>
                )}
              </button>
              <button
                className={`sidebar-nav-item ${sidebarPanel === "todo-trash" ? "active" : ""}`}
                onClick={() => setSidebarPanel("todo-trash")}
              >
                <Icon name="delete" /> Todo Trash{" "}
                {trashedTasks.length > 0 && (
                  <span className="sidebar-count">{trashedTasks.length}</span>
                )}
              </button>
              <button
                className={`sidebar-nav-item ${sidebarPanel === "shopping-archive" ? "active" : ""}`}
                onClick={() => setSidebarPanel("shopping-archive")}
              >
                <Icon name="archive" /> Shopping Archive{" "}
                {archivedShoppingItems.length > 0 && (
                  <span className="sidebar-count">
                    {archivedShoppingItems.length}
                  </span>
                )}
              </button>
              <button
                className={`sidebar-nav-item ${sidebarPanel === "settings" ? "active" : ""}`}
                onClick={() => setSidebarPanel("settings")}
              >
                <Icon name="tune" /> Display Settings
              </button>
            </nav>
            <div className="sidebar-content">
              {sidebarPanel === "todo-archive" && (
                <div className="future-list">
                  {futureTasks.length === 0 ? (
                    <div className="sidebar-empty">
                      No archived tasks. Use the archive button on cards to save
                      ideas for later.
                    </div>
                  ) : (
                    sortTasks(futureTasks).map((task) => (
                      <FutureTaskCard
                        key={task.id}
                        task={task}
                        actions={taskActions}
                        settings={settings}
                      />
                    ))
                  )}
                </div>
              )}
              {sidebarPanel === "todo-trash" && (
                <div className="trash-list">
                  {trashedTasks.length === 0 ? (
                    <div className="sidebar-empty">
                      Trash is empty. Deleted tasks appear here for 30 days.
                    </div>
                  ) : (
                    trashedTasks.map((task) => (
                      <TrashCard
                        key={task.id}
                        task={task}
                        onRestore={restoreTask}
                        onPermanentDelete={permanentDelete}
                      />
                    ))
                  )}
                </div>
              )}
              {sidebarPanel === "shopping-archive" && (
                <div className="simple-list shopping-list">
                  {archivedShoppingItems.length === 0 ? (
                    <div className="sidebar-empty">
                      No archived shopping items.
                    </div>
                  ) : (
                    archivedShoppingItems.map((item) => (
                      <div
                        key={item.id}
                        className={`list-item shopping-item archived ${item.done ? "checked" : ""}`}
                      >
                        <span
                          className={`list-title ${item.done ? "done" : ""}`}
                        >
                          {item.title}
                        </span>
                        <div className="list-actions">
                          <button
                            className="list-action-btn"
                            onClick={() => unarchiveShoppingItem(item.id)}
                            title="Restore"
                          >
                            <Icon name="undo" />
                          </button>
                          <button
                            className="list-action-btn delete"
                            onClick={() => deleteShoppingItem(item.id)}
                            title="Delete"
                          >
                            <Icon name="close" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {sidebarPanel === "settings" && (
                <SettingsView settings={settings} onToggle={toggleSetting} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
