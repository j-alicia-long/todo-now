// Recurring tab: weekly tasks, long-term chores, and events/classes.

import { isWeeklyRecurring, type RecurringItem } from "../domain/recurrence";
import { Icon } from "../components/ui";
import {
  RecurringListItem,
  type RecurringItemActions,
} from "../components/recurring-list-item";

const UNIT_ORDER: Record<string, number> = {
  day: 0,
  week: 1,
  month: 2,
  year: 3,
};

export const RecurringTab = ({
  items,
  actions,
  onAdd,
}: {
  items: RecurringItem[];
  actions: RecurringItemActions;
  onAdd: (category: "task" | "reference") => void;
}) => {
  const allTasks = items.filter((i) => i.category === "task");
  const allReferences = items.filter((i) => i.category === "reference");
  const weeklyTasks = allTasks.filter(isWeeklyRecurring);
  const longTermTasks = allTasks
    .filter((i) => !isWeeklyRecurring(i))
    .sort(
      (a, b) =>
        (UNIT_ORDER[a.repeatUnit] ?? 9) - (UNIT_ORDER[b.repeatUnit] ?? 9)
    );
  const weeklyDoneCount = weeklyTasks.filter((i) => i.completedThisWeek).length;

  return (
    <div className="recurring-board">
      <div className="recurring-left-col">
        <button className="recurring-col-add-btn" onClick={() => onAdd("task")}>
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
              <RecurringListItem key={item.id} item={item} actions={actions} />
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
              <RecurringListItem key={item.id} item={item} actions={actions} />
            ))}
          </div>
        )}
      </div>
      <div className="recurring-right-col">
        <button
          className="recurring-col-add-btn events-add-btn"
          onClick={() => onAdd("reference")}
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
              <RecurringListItem key={item.id} item={item} actions={actions} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
