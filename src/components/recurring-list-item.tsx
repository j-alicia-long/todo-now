// A row on the Recurring tab: weekly hub item, event, or long-term chore.

import { useState } from "react";
import { type RecurringItem } from "../domain/recurrence";
import { Icon } from "./ui";
import {
  AREA_COLORS,
  AREA_LABELS,
  dueUrgencyClass,
  formatDueDate,
  formatRecurrence,
  getDomain,
  timeSince,
} from "../lib/presentation";

export type RecurringItemActions = {
  toggle: (id: string) => void;
  remove: (id: string) => void;
  update: (id: string, fields: Partial<RecurringItem>) => void;
  edit: (item: RecurringItem) => void;
};

export const RecurringListItem = ({
  item,
  actions,
}: {
  item: RecurringItem;
  actions: RecurringItemActions;
}) => {
  const [editingLink, setEditingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState(item.link);
  const isEvent = item.category === "reference";
  const isWeekly =
    !isEvent &&
    item.repeatUnit === "week" &&
    item.repeatEvery === 1 &&
    item.frequency !== "long-term";
  const isChecked = isWeekly ? item.completedThisWeek : false;
  const recurrenceLabel = isEvent ? "" : formatRecurrence(item);

  const saveLink = () => {
    const trimmed = linkDraft.trim();
    const normalized =
      trimmed && !trimmed.match(/^https?:\/\//)
        ? `https://${trimmed}`
        : trimmed;
    actions.update(item.id, { link: normalized });
    setEditingLink(false);
  };

  return (
    <div
      className={`list-item recurring-item ${isChecked ? "checked" : ""} ${isWeekly || isEvent ? "weekly-hub-item" : ""}`}
    >
      {isWeekly && (
        <label className="list-checkbox">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => actions.toggle(item.id)}
          />
          <span className="checkmark" />
        </label>
      )}
      <div className="recurring-info">
        <span className={`list-title ${isChecked ? "done" : ""}`}>
          {item.title}
        </span>
        <div className="recurring-meta">
          {recurrenceLabel && (
            <span className="recurring-schedule-label">{recurrenceLabel}</span>
          )}
          {item.area && (
            <span
              className={`recurring-area-tag ${AREA_COLORS[item.area] || ""}`}
            >
              {AREA_LABELS[item.area] || item.area}
            </span>
          )}
          {item.dueDate && (
            <span
              className={`recurring-due-tag ${dueUrgencyClass(item.dueDate)}`}
            >
              {formatDueDate(item.dueDate)}
            </span>
          )}
          {item.note && <span className="recurring-note">{item.note}</span>}
          {!isWeekly && !isEvent && item.lastCompletedAt && (
            <span className="recurring-last-done">
              Done {timeSince(item.lastCompletedAt)}
            </span>
          )}
          {!isWeekly && !isEvent && !item.lastCompletedAt && (
            <span className="recurring-last-done never">Not yet done</span>
          )}
        </div>
        {(isWeekly || isEvent) && (
          <div className="recurring-link-row">
            {item.link && !editingLink ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="recurring-link-btn"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name="open_in_new" className="link-btn-icon" />
                <span className="link-domain">{getDomain(item.link)}</span>
              </a>
            ) : null}
            {!item.link && !editingLink ? (
              <button
                className="recurring-add-link-btn"
                onClick={() => {
                  setEditingLink(true);
                  setLinkDraft("");
                }}
              >
                <Icon name="add_link" className="link-btn-icon" /> Add link
              </button>
            ) : null}
            {editingLink && (
              <div className="recurring-link-edit">
                <input
                  className="link-edit-input"
                  type="url"
                  placeholder="https://..."
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveLink();
                    }
                    if (e.key === "Escape") setEditingLink(false);
                  }}
                  autoFocus
                />
                <button className="link-edit-save" onClick={saveLink}>
                  <Icon name="check" />
                </button>
                <button
                  className="link-edit-cancel"
                  onClick={() => setEditingLink(false)}
                >
                  <Icon name="close" />
                </button>
              </div>
            )}
            {item.link && !editingLink && (
              <button
                className="recurring-edit-link-btn"
                onClick={() => {
                  setEditingLink(true);
                  setLinkDraft(item.link);
                }}
                title="Edit link"
              >
                <Icon name="edit" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="list-actions">
        {!isWeekly && !isEvent && (
          <button
            className="list-action-btn"
            onClick={() => actions.toggle(item.id)}
            title="Mark done"
          >
            <Icon name="check_circle" />
          </button>
        )}
        <button
          className="list-action-btn"
          onClick={() => actions.edit(item)}
          title="Edit"
        >
          <Icon name="edit" />
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
};
