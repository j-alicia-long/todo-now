// Sidebar drawer: todo archive, todo trash, shopping archive, and
// display settings panels.

import { type Task } from "../domain/task-rules";
import { type ShoppingItem, type Settings } from "../stores/hooks";
import { Icon } from "../components/ui";
import { FutureTaskCard } from "../components/FutureTaskCard";
import { TrashCard } from "../components/TrashCard";
import { SettingsView } from "../components/SettingsView";
import { type TaskActions } from "../components/TaskCard";
import { sortTasks } from "../lib/presentation";

export type SidebarPanel =
  "todo-archive" | "todo-trash" | "shopping-archive" | "settings";

export type SidebarDrawerActions = {
  navigate: (panel: SidebarPanel) => void;
  close: () => void;
  restoreTask: (id: string) => void;
  permanentDeleteTask: (id: string) => void;
  unarchiveShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;
  toggleSetting: (key: keyof Settings) => void;
};

export const SidebarDrawer = ({
  panel,
  tasks,
  shoppingItems,
  taskActions,
  settings,
  actions,
}: {
  panel: SidebarPanel;
  tasks: Task[];
  shoppingItems: ShoppingItem[];
  taskActions: TaskActions;
  settings: Settings;
  actions: SidebarDrawerActions;
}) => {
  const futureTasks = tasks.filter((t) => t.status === "future");
  const trashedTasks = tasks.filter((t) => t.status === "trashed");
  const archivedShoppingItems = shoppingItems.filter((i) => i.archived);

  return (
    <div className="sidebar-overlay" onClick={actions.close}>
      <div className="sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-header">
          <h2>Settings</h2>
          <button className="sidebar-close" onClick={actions.close}>
            <Icon name="close" />
          </button>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${panel === "todo-archive" ? "active" : ""}`}
            onClick={() => actions.navigate("todo-archive")}
          >
            <Icon name="inventory_2" /> Todo Archive{" "}
            {futureTasks.length > 0 && (
              <span className="sidebar-count">{futureTasks.length}</span>
            )}
          </button>
          <button
            className={`sidebar-nav-item ${panel === "todo-trash" ? "active" : ""}`}
            onClick={() => actions.navigate("todo-trash")}
          >
            <Icon name="delete" /> Todo Trash{" "}
            {trashedTasks.length > 0 && (
              <span className="sidebar-count">{trashedTasks.length}</span>
            )}
          </button>
          <button
            className={`sidebar-nav-item ${panel === "shopping-archive" ? "active" : ""}`}
            onClick={() => actions.navigate("shopping-archive")}
          >
            <Icon name="archive" /> Shopping Archive{" "}
            {archivedShoppingItems.length > 0 && (
              <span className="sidebar-count">
                {archivedShoppingItems.length}
              </span>
            )}
          </button>
          <button
            className={`sidebar-nav-item ${panel === "settings" ? "active" : ""}`}
            onClick={() => actions.navigate("settings")}
          >
            <Icon name="tune" /> Display Settings
          </button>
        </nav>
        <div className="sidebar-content">
          {panel === "todo-archive" && (
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
          {panel === "todo-trash" && (
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
                    onRestore={actions.restoreTask}
                    onPermanentDelete={actions.permanentDeleteTask}
                  />
                ))
              )}
            </div>
          )}
          {panel === "shopping-archive" && (
            <div className="simple-list shopping-list">
              {archivedShoppingItems.length === 0 ? (
                <div className="sidebar-empty">No archived shopping items.</div>
              ) : (
                archivedShoppingItems.map((item) => (
                  <div
                    key={item.id}
                    className={`list-item shopping-item archived ${item.done ? "checked" : ""}`}
                  >
                    <span className={`list-title ${item.done ? "done" : ""}`}>
                      {item.title}
                    </span>
                    <div className="list-actions">
                      <button
                        className="list-action-btn"
                        onClick={() => actions.unarchiveShoppingItem(item.id)}
                        title="Restore"
                      >
                        <Icon name="undo" />
                      </button>
                      <button
                        className="list-action-btn delete"
                        onClick={() => actions.deleteShoppingItem(item.id)}
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
          {panel === "settings" && (
            <SettingsView
              settings={settings}
              onToggle={actions.toggleSetting}
            />
          )}
        </div>
      </div>
    </div>
  );
};
