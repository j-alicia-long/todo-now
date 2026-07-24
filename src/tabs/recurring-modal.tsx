// Add/edit modal for recurring tasks and events. Owns its own draft
// state — it mounts fresh on each open and reports back via onSubmit.

import { useState } from "react";
import { deriveFirstDueDate, type RecurringItem } from "../domain/recurrence";
import { Icon } from "../components/ui";
import { DatePickerDropdown } from "../components/date-picker";
import {
  AREA_OPTIONS,
  DAY_LETTERS,
  REPEAT_UNITS,
  formatDueDate,
} from "../lib/presentation";

export const RecurringModal = ({
  item,
  category,
  onSubmit,
  onClose,
}: {
  /** Item being edited, or null when adding a new one. */
  item: RecurringItem | null;
  category: "task" | "reference";
  onSubmit: (fields: Partial<RecurringItem>) => void;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(item?.title ?? "");
  const [link, setLink] = useState(item?.link ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [area, setArea] = useState(item?.area || "");
  const [dueDate, setDueDate] = useState(item?.dueDate || "");
  const [repeatEvery, setRepeatEvery] = useState(item?.repeatEvery || 1);
  const [repeatUnit, setRepeatUnit] = useState<
    "day" | "week" | "month" | "year"
  >(item?.repeatUnit || "week");
  const [repeatDays, setRepeatDays] = useState<number[]>(
    item?.repeatDays || []
  );
  const [endsType, setEndsType] = useState<"never" | "on" | "after">(
    item?.endsType || "never"
  );
  const [endsOn, setEndsOn] = useState(item?.endsOn || "");
  const [endsAfter, setEndsAfter] = useState(item?.endsAfter || 13);
  const [showEarly, setShowEarly] = useState(
    item?.showEarlyDays != null ? String(item.showEarlyDays) : ""
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Only settable via edit — kept for items created before repeatDays existed.
  const dayOfWeek = item?.dayOfWeek ?? null;

  const isEvent = category === "reference";
  const editing = item != null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const effectiveDay = isEvent
      ? dayOfWeek
      : repeatDays.length > 0
        ? repeatDays[0]
        : dayOfWeek;
    let due: string | null = dueDate || null;
    if (!due && effectiveDay != null && !isEvent) {
      due = deriveFirstDueDate(effectiveDay, new Date());
    }
    const fields: Partial<RecurringItem> = {
      title: trimmed,
      frequency: "weekly",
      category,
      link: link.trim(),
      note: note.trim(),
      dayOfWeek: effectiveDay,
      dueDate: due,
      area: area || "",
    };
    if (!isEvent) {
      fields.repeatEvery = repeatEvery;
      fields.repeatUnit = repeatUnit;
      fields.repeatDays = repeatDays;
      fields.endsType = endsType;
      fields.endsOn = endsType === "on" ? endsOn : null;
      fields.endsAfter = endsType === "after" ? endsAfter : null;
      fields.showEarlyDays =
        showEarly.trim() === "" ? null : Math.max(0, parseInt(showEarly) || 0);
    }
    onSubmit(fields);
  };

  return (
    <div className="recurring-modal-overlay" onClick={onClose}>
      <div
        className={`recurring-modal ${isEvent ? "event-modal" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="recurring-modal-header">
          <h3>
            {editing
              ? isEvent
                ? "Edit Event / Class"
                : "Edit Recurring Task"
              : isEvent
                ? "Add Event / Class"
                : "Add Recurring Task"}
          </h3>
          <button className="recurring-modal-close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <form className="recurring-modal-form" onSubmit={handleSubmit}>
          <input
            className="recurring-modal-input"
            type="text"
            placeholder={
              isEvent ? "Event or class name..." : "What do you do regularly?"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          <div className="recurring-modal-row">
            <select
              className="recurring-modal-select"
              value={area}
              onChange={(e) => setArea(e.target.value)}
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
                className={`add-date-btn recurring-date-btn ${dueDate ? "has-date" : ""}`}
                onClick={() => setShowDatePicker(!showDatePicker)}
                title={
                  dueDate ? `Due: ${formatDueDate(dueDate)}` : "Set due date"
                }
              >
                <Icon name="calendar_month" />
                {dueDate ? (
                  <span className="add-date-label">
                    {formatDueDate(dueDate)}
                  </span>
                ) : (
                  <span className="add-date-label">Date</span>
                )}
              </button>
              {showDatePicker && (
                <DatePickerDropdown
                  value={dueDate || null}
                  onChange={(d) => setDueDate(d || "")}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>
          </div>

          {!isEvent && (
            <div className="recurrence-picker">
              <div className="recurrence-section">
                <label className="recurrence-label">Repeat every</label>
                <div className="recurrence-repeat-row">
                  <input
                    className="recurrence-number-input"
                    type="number"
                    min={1}
                    max={99}
                    value={repeatEvery}
                    onChange={(e) =>
                      setRepeatEvery(Math.max(1, parseInt(e.target.value) || 1))
                    }
                  />
                  <select
                    className="recurrence-unit-select"
                    value={repeatUnit}
                    onChange={(e) =>
                      setRepeatUnit(
                        e.target.value as "day" | "week" | "month" | "year"
                      )
                    }
                  >
                    {REPEAT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {repeatEvery === 1 ? u : u + "s"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {repeatUnit === "week" && (
                <div className="recurrence-section">
                  <label className="recurrence-label">Repeat on</label>
                  <div className="recurrence-days-row">
                    {DAY_LETTERS.map((letter, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`recurrence-day-btn ${repeatDays.includes(idx) ? "active" : ""}`}
                        onClick={() => {
                          setRepeatDays((prev) =>
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
                      checked={endsType === "never"}
                      onChange={() => setEndsType("never")}
                    />
                    <span>Never</span>
                  </label>
                  <label className="recurrence-radio-row">
                    <input
                      type="radio"
                      name="ends"
                      checked={endsType === "on"}
                      onChange={() => setEndsType("on")}
                    />
                    <span>On</span>
                    <input
                      type="date"
                      className="recurrence-date-input"
                      value={endsOn}
                      onChange={(e) => {
                        setEndsOn(e.target.value);
                        setEndsType("on");
                      }}
                      disabled={endsType !== "on"}
                    />
                  </label>
                  <label className="recurrence-radio-row">
                    <input
                      type="radio"
                      name="ends"
                      checked={endsType === "after"}
                      onChange={() => setEndsType("after")}
                    />
                    <span>After</span>
                    <input
                      type="number"
                      className="recurrence-occurrence-input"
                      min={1}
                      value={endsAfter}
                      onChange={(e) => {
                        setEndsAfter(
                          Math.max(1, parseInt(e.target.value) || 1)
                        );
                        setEndsType("after");
                      }}
                      disabled={endsType !== "after"}
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
                      repeatUnit === "week" && repeatEvery === 1 ? "0" : "14"
                    }
                    value={showEarly}
                    onChange={(e) => setShowEarly(e.target.value)}
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
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <input
            className="recurring-modal-input"
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="recurring-modal-submit" type="submit">
            {editing ? "Save" : "Add"}
          </button>
        </form>
      </div>
    </div>
  );
};
