// Calendar date pickers (react-aria) in two placements: a centered modal
// overlay and an inline dropdown.

import { useEffect, useRef } from "react";
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

type DatePickerProps = {
  value: string | null;
  onChange: (date: string | null) => void;
  onClose: () => void;
};

export const DatePickerModal = ({
  value,
  onChange,
  onClose,
}: DatePickerProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const tz = getLocalTimeZone();
  const todayDate = today(tz);
  const calendarValue = value ? parseDate(value) : undefined;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      className="date-picker-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="date-picker-modal"
        ref={overlayRef}
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          aria-label="Due date"
          value={calendarValue}
          onChange={(d) => {
            onChange(d.toString());
            onClose();
          }}
          minValue={todayDate}
        >
          <header className="date-picker-header">
            <AriaButton slot="previous" className="date-picker-nav">
              ‹
            </AriaButton>
            <Heading className="date-picker-heading" />
            <AriaButton slot="next" className="date-picker-nav">
              ›
            </AriaButton>
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
          <button
            className="date-picker-clear"
            onClick={() => {
              onChange(null);
              onClose();
            }}
          >
            Clear date
          </button>
        )}
      </div>
    </div>
  );
};

export const DatePickerDropdown = ({
  value,
  onChange,
  onClose,
}: DatePickerProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tz = getLocalTimeZone();
  const todayDate = today(tz);
  const calendarValue = value ? parseDate(value) : undefined;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      className="date-picker-dropdown"
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
    >
      <Calendar
        aria-label="Due date"
        value={calendarValue}
        onChange={(d) => {
          onChange(d.toString());
          onClose();
        }}
        minValue={todayDate}
      >
        <header className="date-picker-header">
          <AriaButton slot="previous" className="date-picker-nav">
            ‹
          </AriaButton>
          <Heading className="date-picker-heading" />
          <AriaButton slot="next" className="date-picker-nav">
            ›
          </AriaButton>
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
        <button
          className="date-picker-clear"
          onClick={() => {
            onChange(null);
            onClose();
          }}
        >
          Clear date
        </button>
      )}
    </div>
  );
};
