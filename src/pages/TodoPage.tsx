import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Calendar,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarCell,
  Heading,
  Button as AriaButton,
} from "react-aria-components";
import { parseDate, today, getLocalTimeZone } from "@internationalized/date";
import "./TodoPage.scss";

type TaskStatus = "this-week" | "this-month" | "future" | "done" | "trashed";
type ViewTab = "board" | "shopping" | "groceries";
type SidebarPanel = "todo-archive" | "todo-trash" | "shopping-archive" | "settings" | null;

type Task = {
  id: string;
  title: string;
  done: boolean;
  status: TaskStatus;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  decisionLoad: "low" | "medium" | "high";
  area: string;
  dueDate: string | null;
  isSmallWin: boolean;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

type ShoppingItem = {
  id: string;
  title: string;
  done: boolean;
  archived: boolean;
  category: "want" | "need";
  createdAt: string;
};

type GroceryItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

type Settings = {
  showPriority: boolean;
  showArea: boolean;
  showEffort: boolean;
  showDecisionLoad: boolean;
  showSmallWinBadge: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  showPriority: true,
  showArea: true,
  showEffort: false,
  showDecisionLoad: false,
  showSmallWinBadge: true,
};

type SyncedSettings = Settings & { theme?: "light" | "dark" };

function loadSettingsLocal(): Settings {
  try {
    const raw = localStorage.getItem("todo-settings");
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettingsLocal(s: Settings) {
  localStorage.setItem("todo-settings", JSON.stringify(s));
}

async function fetchSettingsFromServer(): Promise<SyncedSettings | null> {
  try {
    const res = await fetch("/api/settings", { headers: { Accept: "application/json" } });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

function pushSettingsToServer(s: SyncedSettings) {
  fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(s),
  }).catch(() => {});
}

const AREA_LABELS: Record<string, string> = {
  "life-admin": "Life Admin",
  social: "Social",
  health: "Health",
  learning: "Learning",
  career: "Career",
  "personal-project": "Project",
};

const AREA_COLORS: Record<string, string> = {
  "life-admin": "area-blue",
  social: "area-purple",
  health: "area-orange",
  learning: "area-teal",
  career: "area-green",
  "personal-project": "area-pink",
};

const AREA_OPTIONS = Object.entries(AREA_LABELS);
const PRIORITY_OPTIONS: Task["priority"][] = ["high", "medium", "low"];
const EFFORT_OPTIONS: Task["effort"][] = ["low", "medium", "high"];
const DECISION_LOAD_OPTIONS: Task["decisionLoad"][] = ["low", "medium", "high"];

const BOARD_COLUMNS: { id: TaskStatus; title: string; icon: string; colorClass: string }[] = [
  { id: "this-week", title: "This Week", icon: "bolt", colorClass: "col-orange" },
  { id: "this-month", title: "This Month", icon: "date_range", colorClass: "col-purple" },
  { id: "done", title: "Done", icon: "check_circle", colorClass: "col-green" },
];

function getDaysLeft(date: string): number {
  const d = new Date(date + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function formatDueDate(date: string): string {
  const diff = getDaysLeft(date);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day";
  return `${diff} days`;
}

function dueUrgencyClass(date: string): string {
  const diff = getDaysLeft(date);
  if (diff <= 2) return "due-red";
  if (diff <= 4) return "due-orange";
  if (diff <= 7) return "due-yellow";
  return "due-green";
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    const prio = { high: 0, medium: 1, low: 2 };
    return prio[a.priority] - prio[b.priority];
  });
}

function daysAgo(isoDate: string): string {
  const d = Math.round((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

// ── Material Design Icon ──

function Icon({ name, className }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ""}`}>{name}</span>;
}

function formatHeadingDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// ── Lightweight List Items ──

function ShoppingListItem({
  item,
  onToggle,
  onArchive,
  onDelete,
  onMove,
}: {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string) => void;
}) {
  return (
    <div className={`list-item shopping-item ${item.done ? "checked" : ""}`}>
      <label className="list-checkbox" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={item.done} onChange={() => onToggle(item.id)} />
        <span className="checkmark" />
      </label>
      <span className={`list-title ${item.done ? "done" : ""}`}>{item.title}</span>
      <div className="list-actions">
        <button className="list-action-btn" onClick={() => onMove(item.id)} title={item.category === "need" ? "Move to Wants" : "Move to Needs"}>
          <Icon name={item.category === "need" ? "chevron_right" : "chevron_left"} />
        </button>
        <button className="list-action-btn" onClick={() => onArchive(item.id)} title="Archive">
          <Icon name="archive" />
        </button>
        <button className="list-action-btn delete" onClick={() => onDelete(item.id)} title="Delete"><Icon name="close" /></button>
      </div>
    </div>
  );
}

function ShoppingDoneItem({
  item,
  onUndone,
  onDelete,
}: {
  item: ShoppingItem;
  onUndone: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="list-item shopping-item checked">
      <label className="list-checkbox" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked onChange={() => onUndone(item.id)} />
        <span className="checkmark" />
      </label>
      <span className="list-title done">{item.title}</span>
      <div className="list-actions">
        <button className="list-action-btn delete" onClick={() => onDelete(item.id)} title="Delete"><Icon name="close" /></button>
      </div>
    </div>
  );
}

function GroceryListItem({
  item,
  onToggle,
  onDelete,
}: {
  item: GroceryItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`list-item grocery-item ${item.done ? "checked" : ""}`}>
      <label className="list-checkbox" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={item.done} onChange={() => onToggle(item.id)} />
        <span className="checkmark" />
      </label>
      <span className={`list-title ${item.done ? "done" : ""}`}>{item.title}</span>
      <div className="list-actions">
        <button className="list-action-btn delete" onClick={() => onDelete(item.id)} title="Delete"><Icon name="close" /></button>
      </div>
    </div>
  );
}

// ── Inline Tag Editor ──

function TagSelect<T extends string>({
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
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className={`tag-select ${className || ""}`}>
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
}

// ── Date Picker Modal ──

function DatePickerModal({
  value,
  onChange,
  onClose,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const tz = getLocalTimeZone();
  const todayDate = today(tz);
  const calendarValue = value ? parseDate(value) : undefined;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div className="date-picker-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="date-picker-modal" ref={overlayRef} onClick={(e) => e.stopPropagation()}>
        <Calendar
          aria-label="Due date"
          value={calendarValue}
          onChange={(d) => { onChange(d.toString()); onClose(); }}
          minValue={todayDate}
        >
          <header className="date-picker-header">
            <AriaButton slot="previous" className="date-picker-nav">‹</AriaButton>
            <Heading className="date-picker-heading" />
            <AriaButton slot="next" className="date-picker-nav">›</AriaButton>
          </header>
          <CalendarGrid>
            <CalendarGridHeader>
              {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
            </CalendarGridHeader>
            <CalendarGridBody>
              {(date) => <CalendarCell date={date} />}
            </CalendarGridBody>
          </CalendarGrid>
        </Calendar>
        {value && (
          <button className="date-picker-clear" onClick={() => { onChange(null); onClose(); }}>
            Clear date
          </button>
        )}
      </div>
    </div>
  );
}

// ── Task Card ──

function TaskCard({
  task,
  onStatusChange,
  onDelete,
  onUpdate,
  settings,
  isDragOverlay,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, fields: Partial<Task>) => void;
  settings: Settings;
  isDragOverlay?: boolean;
}) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: task.id, data: { task } });

  const style: React.CSSProperties = {};
  if (isDragOverlay) {
    style.cursor = "grabbing";
    style.boxShadow = "var(--shadow-lg)";
    style.transform = "rotate(2deg) scale(1.02)";
  } else if (transform) {
    style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0)`;
  }
  if (isDragging && !isDragOverlay) {
    style.opacity = 0.3;
  }

  const ref = isDragOverlay ? undefined : setNodeRef;
  const dragProps = isDragOverlay ? {} : { ...attributes, ...listeners };

  const hasTags = (settings.showPriority || settings.showArea || (task.dueDate) ||
    (settings.showSmallWinBadge && task.isSmallWin && task.status !== "done" && task.status !== "future") ||
    settings.showEffort || settings.showDecisionLoad);

  return (
    <div
      ref={ref}
      className={`task-card ${isDragging && !isDragOverlay ? "dragging" : ""}`}
      style={style}
      {...dragProps}
    >
      <button
        className="card-delete-btn"
        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        title="Delete"
        aria-label="Delete task"
      >
        <Icon name="close" />
      </button>
      <div className="card-header">
        <label className="card-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={task.done}
            onChange={(e) => {
              e.stopPropagation();
              if (!task.done) {
                onStatusChange(task.id, "done");
              } else {
                onStatusChange(task.id, "this-week");
              }
            }}
          />
          <span className="checkmark" />
        </label>
        <span className={`card-title ${task.done ? "done" : ""}`}>{task.title}</span>
      </div>

      <div className="card-row">
        <div className="card-tags">
          {task.dueDate && (
            <span
              className={`card-tag ${dueUrgencyClass(task.dueDate)} tappable`}
              onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "dueDate" ? null : "dueDate"); }}
            >
              {formatDueDate(task.dueDate)}
            </span>
          )}
          {!task.dueDate && (
            <span
              className="card-tag due-none tappable"
              onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "dueDate" ? null : "dueDate"); }}
            >
              + date
            </span>
          )}
          {editingTag === "dueDate" && (
            <DatePickerModal
              value={task.dueDate}
              onChange={(d) => onUpdate(task.id, { dueDate: d })}
              onClose={() => setEditingTag(null)}
            />
          )}
          {settings.showPriority && (
            <span
              className={`card-tag priority-${task.priority} tappable`}
              onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "priority" ? null : "priority"); }}
            >
              {task.priority}
            </span>
          )}
          {editingTag === "priority" && (
            <TagSelect
              value={task.priority}
              options={PRIORITY_OPTIONS}
              onChange={(v) => onUpdate(task.id, { priority: v })}
              onClose={() => setEditingTag(null)}
              className="priority-select"
            />
          )}
          {settings.showArea && task.area && (
            <span
              className={`card-tag area ${AREA_COLORS[task.area] || ""} tappable`}
              onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "area" ? null : "area"); }}
            >
              {AREA_LABELS[task.area] || task.area}
            </span>
          )}
          {editingTag === "area" && (
            <TagSelect
              value={task.area}
              options={AREA_OPTIONS.map(([k]) => k)}
              labels={AREA_LABELS}
              onChange={(v) => onUpdate(task.id, { area: v })}
              onClose={() => setEditingTag(null)}
              className="area-select"
            />
          )}
          {settings.showEffort && (
            <span
              className="card-tag effort tappable"
              onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "effort" ? null : "effort"); }}
            >
              effort: {task.effort}
            </span>
          )}
          {editingTag === "effort" && (
            <TagSelect
              value={task.effort}
              options={EFFORT_OPTIONS}
              onChange={(v) => onUpdate(task.id, { effort: v })}
              onClose={() => setEditingTag(null)}
            />
          )}
          {settings.showDecisionLoad && (
            <span
              className="card-tag decision-load tappable"
              onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "decisionLoad" ? null : "decisionLoad"); }}
            >
              decision: {task.decisionLoad}
            </span>
          )}
          {editingTag === "decisionLoad" && (
            <TagSelect
              value={task.decisionLoad}
              options={DECISION_LOAD_OPTIONS}
              onChange={(v) => onUpdate(task.id, { decisionLoad: v })}
              onClose={() => setEditingTag(null)}
            />
          )}
          {settings.showSmallWinBadge && task.isSmallWin && task.status !== "done" && task.status !== "future" && (
            <span className="card-tag small-win">small win</span>
          )}
        </div>
        <div className="card-actions">
          {task.status === "this-week" && (
            <>
              <button
                className="card-action-btn move-right"
                onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "this-month"); }}
                title="Move to This Month"
              >
                <Icon name="chevron_right" />
              </button>
              <button
                className="card-action-btn archive"
                onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "future"); }}
                title="File away to Future"
              >
                <Icon name="archive" />
              </button>
            </>
          )}
          {task.status === "this-month" && (
            <>
              <button
                className="card-action-btn move-left"
                onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "this-week"); }}
                title="Move to This Week"
              >
                <Icon name="chevron_left" />
              </button>
              <button
                className="card-action-btn archive"
                onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "future"); }}
                title="File away to Future"
              >
                <Icon name="archive" />
              </button>
            </>
          )}
          {task.status === "done" && (
            <button
              className="card-action-btn undo"
              onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "this-week"); }}
              title="Move back to This Week"
            >
              <Icon name="undo" /> Reopen
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

// ── Future Task Card ──

function FutureTaskCard({
  task,
  onStatusChange,
  onDelete,
  onUpdate,
  settings,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, fields: Partial<Task>) => void;
  settings: Settings;
}) {
  const [editingTag, setEditingTag] = useState<string | null>(null);

  return (
    <div className="task-card future-card">
      <button
        className="card-delete-btn"
        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        title="Delete"
        aria-label="Delete task"
      >
        <Icon name="close" />
      </button>
      <div className="card-header">
        <label className="card-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => { e.stopPropagation(); onStatusChange(task.id, "done"); }}
          />
          <span className="checkmark" />
        </label>
        <span className="card-title">{task.title}</span>
      </div>

      <div className="card-tags">
        {task.dueDate && (
          <span
            className={`card-tag ${dueUrgencyClass(task.dueDate)} tappable`}
            onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "dueDate" ? null : "dueDate"); }}
          >
            {formatDueDate(task.dueDate)}
          </span>
        )}
        {!task.dueDate && (
          <span
            className="card-tag due-none tappable"
            onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "dueDate" ? null : "dueDate"); }}
          >
            + date
          </span>
        )}
        {editingTag === "dueDate" && (
          <DatePickerModal
            value={task.dueDate}
            onChange={(d) => onUpdate(task.id, { dueDate: d })}
            onClose={() => setEditingTag(null)}
          />
        )}
        {settings.showPriority && (
          <span
            className={`card-tag priority-${task.priority} tappable`}
            onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "priority" ? null : "priority"); }}
          >
            {task.priority}
          </span>
        )}
        {editingTag === "priority" && (
          <TagSelect
            value={task.priority}
            options={PRIORITY_OPTIONS}
            onChange={(v) => onUpdate(task.id, { priority: v })}
            onClose={() => setEditingTag(null)}
          />
        )}
        {settings.showArea && task.area && (
          <span
            className={`card-tag area ${AREA_COLORS[task.area] || ""} tappable`}
            onClick={(e) => { e.stopPropagation(); setEditingTag(editingTag === "area" ? null : "area"); }}
          >
            {AREA_LABELS[task.area] || task.area}
          </span>
        )}
        {editingTag === "area" && (
          <TagSelect
            value={task.area}
            options={AREA_OPTIONS.map(([k]) => k)}
            labels={AREA_LABELS}
            onChange={(v) => onUpdate(task.id, { area: v })}
            onClose={() => setEditingTag(null)}
          />
        )}
      </div>

      <div className="card-actions">
        <button
          className="card-action-btn activate"
          onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "this-week"); }}
          title="Move to This Week"
        >
          <Icon name="play_arrow" /> This Week
        </button>
      </div>
    </div>
  );
}

// ── Trash Card ──

function TrashCard({
  task,
  onRestore,
  onPermanentDelete,
}: {
  task: Task;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}) {
  return (
    <div className="task-card trash-card">
      <div className="card-header">
        <span className="card-title trashed">{task.title}</span>
      </div>
      {task.deletedAt && (
        <div className="trash-meta">Deleted {daysAgo(task.deletedAt)}</div>
      )}
      <div className="card-actions">
        <button
          className="card-action-btn undo"
          onClick={(e) => { e.stopPropagation(); onRestore(task.id); }}
        >
          <Icon name="undo" /> Restore
        </button>
        <button
          className="card-action-btn delete-permanent"
          onClick={(e) => { e.stopPropagation(); onPermanentDelete(task.id); }}
        >
          <Icon name="delete_forever" /> Delete forever
        </button>
      </div>
    </div>
  );
}

// ── Board Column ──

function groupDoneByDate(tasks: Task[]): { label: string; tasks: Task[] }[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const dateKey = t.completedAt ? t.completedAt.slice(0, 10) : "unknown";
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(t);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return sorted.map(([dateKey, tasks]) => ({
    label: dateKey === todayStr ? "Today" : dateKey === "unknown" ? "Earlier" :
      new Date(dateKey + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    tasks,
  }));
}

function BoardColumn({
  id,
  title,
  icon,
  colorClass,
  tasks,
  onStatusChange,
  onDelete,
  onUpdate,
  showSmallWinsOnly,
  settings,
}: {
  id: TaskStatus;
  title: string;
  icon: string;
  colorClass: string;
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, fields: Partial<Task>) => void;
  showSmallWinsOnly: boolean;
  settings: Settings;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const displayTasks = id === "this-week" && showSmallWinsOnly
    ? tasks.filter((t) => t.isSmallWin)
    : tasks;

  const doneGroups = id === "done" ? groupDoneByDate(displayTasks) : null;

  return (
    <div className={`board-column ${isOver ? "drag-over" : ""}`} ref={setNodeRef}>
      <div className={`column-header ${colorClass}`}>
        <Icon name={icon} className="column-icon" />
        <h2 className="column-title">{title}</h2>
        <span className="column-count">{displayTasks.length}</span>
      </div>
      <div className="column-cards">
        {displayTasks.length === 0 ? (
          <div className="column-empty">
            {id === "done" ? "Nothing completed yet" :
             id === "this-month" ? "Drag tasks here or use the arrow" :
             showSmallWinsOnly ? "No small wins right now" : "All clear!"}
          </div>
        ) : doneGroups ? (
          doneGroups.map((group) => (
            <div key={group.label} className="done-group">
              <div className="done-group-label">{group.label}</div>
              {group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  settings={settings}
                />
              ))}
            </div>
          ))
        ) : (
          sortTasks(displayTasks).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onUpdate={onUpdate}
              settings={settings}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Settings View ──

function SettingsView({
  settings,
  onToggle,
}: {
  settings: Settings;
  onToggle: (key: keyof Settings) => void;
}) {
  const toggles: { key: keyof Settings; label: string; description: string }[] = [
    { key: "showPriority", label: "Priority", description: "Show priority label (high / medium / low)" },
    { key: "showArea", label: "Area", description: "Show category label (Life Admin, Social, etc.)" },
    { key: "showEffort", label: "Effort", description: "Show effort level on cards" },
    { key: "showDecisionLoad", label: "Decision Load", description: "Show decision load on cards" },
    { key: "showSmallWinBadge", label: "Small Win Badge", description: "Show 'small win' badge on qualifying tasks" },
  ];

  return (
    <div className="settings-view">
      <h2 className="settings-title">Card Labels</h2>
      <p className="settings-desc">Choose which labels appear on task cards.</p>
      <div className="settings-list">
        {toggles.map(({ key, label, description }) => (
          <label key={key} className="settings-toggle">
            <div className="toggle-info">
              <span className="toggle-label">{label}</span>
              <span className="toggle-desc">{description}</span>
            </div>
            <div className={`toggle-switch ${settings[key] ? "on" : ""}`} onClick={() => onToggle(key)}>
              <div className="toggle-knob" />
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function TodoPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showSmallWinsOnly, setShowSmallWinsOnly] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("board");
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>(null);
  const [settings, setSettings] = useState<Settings>(loadSettingsLocal);
  const { theme, setTheme } = useTheme();

  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : theme;

  const isTouchDevice = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
  const sensors = useSensors(
    ...isTouchDevice ? [] : [useSensor(PointerSensor, { activationConstraint: { distance: 8 } })],
  );

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks", { headers: { Accept: "application/json" } });
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShopping = useCallback(async () => {
    try {
      const res = await fetch("/api/shopping", { headers: { Accept: "application/json" } });
      setShoppingItems(await res.json());
    } catch (e) { console.error("Failed to fetch shopping:", e); }
  }, []);

  const fetchGroceries = useCallback(async () => {
    try {
      const res = await fetch("/api/groceries", { headers: { Accept: "application/json" } });
      setGroceryItems(await res.json());
    } catch (e) { console.error("Failed to fetch groceries:", e); }
  }, []);

  useEffect(() => { fetchTasks(); fetchShopping(); fetchGroceries(); }, [fetchTasks, fetchShopping, fetchGroceries]);

  useEffect(() => {
    fetchSettingsFromServer().then((serverSettings) => {
      if (!serverSettings) return;
      const { theme: serverTheme, ...labelSettings } = serverSettings;
      const merged = { ...DEFAULT_SETTINGS, ...labelSettings } as Settings;
      setSettings(merged);
      saveSettingsLocal(merged);
      if (serverTheme) setTheme(serverTheme);
    });
  }, []);

  function toggleSetting(key: keyof Settings) {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSettingsLocal(next);
      pushSettingsToServer({ ...next, theme: resolvedTheme as "light" | "dark" });
      return next;
    });
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const status = viewTab === "future" ? "future" : "this-week";
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ title, status }),
      });
      const task = await res.json();
      setTasks((prev) => [...prev, task]);
      setNewTitle("");
    } catch (e) {
      console.error("Failed to add task:", e);
    }
  }

  async function changeStatus(id: string, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status,
              done: status === "done",
              completedAt: status === "done" ? new Date().toISOString() : null,
              deletedAt: status === "trashed" ? new Date().toISOString() : (t.status === "trashed" ? null : t.deletedAt),
            }
          : t
      )
    );
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error("Failed to update task:", e);
      fetchTasks();
    }
  }

  async function updateTask(id: string, fields: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      console.error("Failed to update task:", e);
      fetchTasks();
    }
  }

  async function deleteTask(id: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: "trashed" as TaskStatus, deletedAt: new Date().toISOString(), done: false, completedAt: null } : t
      )
    );
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE", headers: { Accept: "application/json" } });
    } catch (e) {
      console.error("Failed to delete task:", e);
      fetchTasks();
    }
  }

  async function restoreTask(id: string) {
    changeStatus(id, "this-week");
  }

  async function permanentDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/tasks/${id}?permanent=true`, { method: "DELETE", headers: { Accept: "application/json" } });
    } catch (e) {
      console.error("Failed to permanently delete:", e);
      fetchTasks();
    }
  }

  // ── Shopping CRUD ──

  async function addShoppingItem(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    try {
      const res = await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ title, category: "need" }),
      });
      const item = await res.json();
      setShoppingItems((prev) => [...prev, item]);
      setNewTitle("");
    } catch (e) { console.error("Failed to add shopping item:", e); }
  }

  async function toggleShoppingItem(id: string) {
    setShoppingItems((prev) => prev.map((i) => i.id === id ? { ...i, done: !i.done } : i));
    const item = shoppingItems.find((i) => i.id === id);
    if (!item) return;
    try {
      await fetch(`/api/shopping/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ done: !item.done }),
      });
    } catch (e) { console.error("Failed to toggle shopping item:", e); fetchShopping(); }
  }

  async function archiveShoppingItem(id: string) {
    setShoppingItems((prev) => prev.map((i) => i.id === id ? { ...i, archived: true } : i));
    try {
      await fetch(`/api/shopping/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ archived: true }),
      });
    } catch (e) { console.error("Failed to archive shopping item:", e); fetchShopping(); }
  }

  async function unarchiveShoppingItem(id: string) {
    setShoppingItems((prev) => prev.map((i) => i.id === id ? { ...i, archived: false } : i));
    try {
      await fetch(`/api/shopping/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ archived: false }),
      });
    } catch (e) { console.error("Failed to unarchive shopping item:", e); fetchShopping(); }
  }

  async function deleteShoppingItem(id: string) {
    setShoppingItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/shopping/${id}`, { method: "DELETE", headers: { Accept: "application/json" } });
    } catch (e) { console.error("Failed to delete shopping item:", e); fetchShopping(); }
  }

  async function changeShoppingCategory(id: string) {
    const item = shoppingItems.find((i) => i.id === id);
    if (!item) return;
    const newCategory = item.category === "need" ? "want" : "need";
    setShoppingItems((prev) => prev.map((i) => i.id === id ? { ...i, category: newCategory } : i));
    try {
      await fetch(`/api/shopping/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });
    } catch (e) { console.error("Failed to change shopping category:", e); fetchShopping(); }
  }

  // ── Grocery CRUD ──

  async function addGroceryItem(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    try {
      const res = await fetch("/api/groceries", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ title }),
      });
      const item = await res.json();
      setGroceryItems((prev) => [...prev, item]);
      setNewTitle("");
    } catch (e) { console.error("Failed to add grocery item:", e); }
  }

  async function toggleGroceryItem(id: string) {
    setGroceryItems((prev) => prev.map((i) => i.id === id ? { ...i, done: !i.done } : i));
    const item = groceryItems.find((i) => i.id === id);
    if (!item) return;
    try {
      await fetch(`/api/groceries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ done: !item.done }),
      });
    } catch (e) { console.error("Failed to toggle grocery item:", e); fetchGroceries(); }
  }

  async function deleteGroceryItem(id: string) {
    setGroceryItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/groceries/${id}`, { method: "DELETE", headers: { Accept: "application/json" } });
    } catch (e) { console.error("Failed to delete grocery item:", e); fetchGroceries(); }
  }

  async function clearBoughtGroceries() {
    setGroceryItems((prev) => prev.filter((i) => !i.done));
    try {
      await fetch("/api/groceries/clear-bought", { method: "DELETE", headers: { Accept: "application/json" } });
    } catch (e) { console.error("Failed to clear bought groceries:", e); fetchGroceries(); }
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const targetColumn = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetColumn) return;
    changeStatus(taskId, targetColumn);
  }

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);
  const futureTasks = tasksByStatus("future");
  const trashedTasks = tasksByStatus("trashed");
  const activeShoppingItems = shoppingItems.filter((i) => !i.archived && !i.done);
  const doneShoppingItems = shoppingItems.filter((i) => !i.archived && i.done);
  const archivedShoppingItems = shoppingItems.filter((i) => i.archived);
  const shoppingNeeds = activeShoppingItems.filter((i) => i.category === "need");
  const shoppingWants = activeShoppingItems.filter((i) => i.category === "want");
  const boughtGroceries = groceryItems.filter((i) => i.done);
  const unboughtGroceries = groceryItems.filter((i) => !i.done);

  if (loading) {
    return (
      <div className="todo-page">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  const handleAddForm = viewTab === "shopping" ? addShoppingItem : viewTab === "groceries" ? addGroceryItem : addTask;
  const addPlaceholder = viewTab === "shopping" ? "Add a shopping item..." : viewTab === "groceries" ? "Add a grocery item..." : "Add a task...";

  return (
    <div className="todo-page">
      <header className="todo-header">
        <h1>{formatHeadingDate()}</h1>
        <div className="header-actions">
          {viewTab === "board" && (
            <button
              className={`small-wins-toggle ${showSmallWinsOnly ? "active" : ""}`}
              onClick={() => setShowSmallWinsOnly(!showSmallWinsOnly)}
            >
              <Icon name="auto_awesome" /> Small Wins
            </button>
          )}
          <button
            className="theme-toggle"
            onClick={() => {
              const next = resolvedTheme === "dark" ? "light" : "dark";
              setTheme(next);
              pushSettingsToServer({ ...settings, theme: next });
            }}
            aria-label="Toggle theme"
          >
            <Icon name={resolvedTheme === "dark" ? "light_mode" : "dark_mode"} />
          </button>
          <button className="sidebar-toggle" onClick={() => setSidebarPanel(sidebarPanel ? null : "settings")} aria-label="Settings">
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <div className="view-tabs">
        <button className={`view-tab ${viewTab === "board" ? "active" : ""}`} onClick={() => setViewTab("board")}>
          <Icon name="dashboard" className="tab-icon" /> Board
        </button>
        <button className={`view-tab shopping-tab ${viewTab === "shopping" ? "active" : ""}`} onClick={() => setViewTab("shopping")}>
          <Icon name="shopping_bag" className="tab-icon" /> Shopping {(activeShoppingItems.length + doneShoppingItems.length) > 0 && <span className="tab-count shopping-count">{activeShoppingItems.length + doneShoppingItems.length}</span>}
        </button>
        <button className={`view-tab grocery-tab ${viewTab === "groceries" ? "active" : ""}`} onClick={() => setViewTab("groceries")}>
          <Icon name="grocery" className="tab-icon" /> Groceries {groceryItems.length > 0 && <span className="tab-count grocery-count">{groceryItems.length}</span>}
        </button>
      </div>

      <form className="add-task-form" onSubmit={handleAddForm}>
        <input
          className="add-task-input"
          type="text"
          placeholder={addPlaceholder}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button className="add-task-btn" type="submit">Add</button>
      </form>

      {viewTab === "board" && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="board">
            {BOARD_COLUMNS.map((col) => (
              <BoardColumn
                key={col.id}
                id={col.id}
                title={col.title}
                icon={col.icon}
                colorClass={col.colorClass}
                tasks={tasksByStatus(col.id)}
                onStatusChange={changeStatus}
                onDelete={deleteTask}
                onUpdate={updateTask}
                showSmallWinsOnly={showSmallWinsOnly}
                settings={settings}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <TaskCard
                task={activeTask}
                onStatusChange={() => {}}
                onDelete={() => {}}
                onUpdate={() => {}}
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
                  <ShoppingListItem key={item.id} item={item} onToggle={toggleShoppingItem} onArchive={archiveShoppingItem} onDelete={deleteShoppingItem} onMove={changeShoppingCategory} />
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
                  <ShoppingListItem key={item.id} item={item} onToggle={toggleShoppingItem} onArchive={archiveShoppingItem} onDelete={deleteShoppingItem} onMove={changeShoppingCategory} />
                ))
              )}
            </div>
          </div>
          {doneShoppingItems.length > 0 && (
            <div className="shopping-done-section">
              <div className="shopping-column-header done-header">
                <Icon name="check_circle" className="column-icon" />
                <h3>Done</h3>
                <span className="column-count">{doneShoppingItems.length}</span>
              </div>
              <div className="shopping-done-list">
                {doneShoppingItems.map((item) => (
                  <ShoppingDoneItem key={item.id} item={item} onUndone={toggleShoppingItem} onDelete={deleteShoppingItem} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {viewTab === "groceries" && (
        <div className="grocery-wrapper">
          <div className="simple-list grocery-list">
            {boughtGroceries.length > 0 && (
              <button className="clear-bought-btn" onClick={clearBoughtGroceries}>
                <Icon name="delete_sweep" /> Clear {boughtGroceries.length} bought
              </button>
            )}
            {groceryItems.length === 0 ? (
              <div className="future-empty">
                <span className="future-empty-icon">🥬</span>
                <p>Grocery list is empty</p>
                <p className="future-empty-hint">Add groceries you need to pick up</p>
              </div>
            ) : (
              <>
                {unboughtGroceries.map((item) => (
                  <GroceryListItem key={item.id} item={item} onToggle={toggleGroceryItem} onDelete={deleteGroceryItem} />
                ))}
                {boughtGroceries.map((item) => (
                  <GroceryListItem key={item.id} item={item} onToggle={toggleGroceryItem} onDelete={deleteGroceryItem} />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {sidebarPanel && (
        <div className="sidebar-overlay" onClick={() => setSidebarPanel(null)}>
          <div className="sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <h2>Settings</h2>
              <button className="sidebar-close" onClick={() => setSidebarPanel(null)}><Icon name="close" /></button>
            </div>
            <nav className="sidebar-nav">
              <button
                className={`sidebar-nav-item ${sidebarPanel === "todo-archive" ? "active" : ""}`}
                onClick={() => setSidebarPanel("todo-archive")}
              >
                <Icon name="inventory_2" /> Todo Archive {futureTasks.length > 0 && <span className="sidebar-count">{futureTasks.length}</span>}
              </button>
              <button
                className={`sidebar-nav-item ${sidebarPanel === "todo-trash" ? "active" : ""}`}
                onClick={() => setSidebarPanel("todo-trash")}
              >
                <Icon name="delete" /> Todo Trash {trashedTasks.length > 0 && <span className="sidebar-count">{trashedTasks.length}</span>}
              </button>
              <button
                className={`sidebar-nav-item ${sidebarPanel === "shopping-archive" ? "active" : ""}`}
                onClick={() => setSidebarPanel("shopping-archive")}
              >
                <Icon name="archive" /> Shopping Archive {archivedShoppingItems.length > 0 && <span className="sidebar-count">{archivedShoppingItems.length}</span>}
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
                    <div className="sidebar-empty">No archived tasks. Use the archive button on cards to save ideas for later.</div>
                  ) : (
                    sortTasks(futureTasks).map((task) => (
                      <FutureTaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={changeStatus}
                        onDelete={deleteTask}
                        onUpdate={updateTask}
                        settings={settings}
                      />
                    ))
                  )}
                </div>
              )}
              {sidebarPanel === "todo-trash" && (
                <div className="trash-list">
                  {trashedTasks.length === 0 ? (
                    <div className="sidebar-empty">Trash is empty. Deleted tasks appear here for 30 days.</div>
                  ) : (
                    trashedTasks.map((task) => (
                      <TrashCard key={task.id} task={task} onRestore={restoreTask} onPermanentDelete={permanentDelete} />
                    ))
                  )}
                </div>
              )}
              {sidebarPanel === "shopping-archive" && (
                <div className="simple-list shopping-list">
                  {archivedShoppingItems.length === 0 ? (
                    <div className="sidebar-empty">No archived shopping items.</div>
                  ) : (
                    archivedShoppingItems.map((item) => (
                      <div key={item.id} className={`list-item shopping-item archived ${item.done ? "checked" : ""}`}>
                        <span className={`list-title ${item.done ? "done" : ""}`}>{item.title}</span>
                        <div className="list-actions">
                          <button className="list-action-btn" onClick={() => unarchiveShoppingItem(item.id)} title="Restore">
                            <Icon name="undo" />
                          </button>
                          <button className="list-action-btn delete" onClick={() => deleteShoppingItem(item.id)} title="Delete"><Icon name="close" /></button>
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
