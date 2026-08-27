"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { isValidDatetimeLocalValue } from "../../lib/local-datetime-to-iso.ts";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseLocal(value: string): Date | null {
  if (!isValidDatetimeLocalValue(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDisplay(value: string): string {
  const date = parseLocal(value);
  if (!date) {
    return "Select date and time";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-first weekday index 0..6 */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface CrmDateTimeFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly required?: boolean;
  readonly clearable?: boolean;
  readonly defaultValue?: string;
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly hasError?: boolean;
  readonly describedBy?: string;
  readonly disabled?: boolean;
  readonly "data-testid"?: string;
}

export function CrmDateTimeField({
  id,
  name,
  label,
  required = false,
  clearable = false,
  defaultValue = "",
  value: controlledValue,
  onChange,
  hasError = false,
  describedBy,
  disabled = false,
  "data-testid": testId,
}: CrmDateTimeFieldProps) {
  const generatedId = useId();
  const popoverId = `${generatedId}-popover`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlledValue ?? uncontrolled;

  const selected = useMemo(() => parseLocal(value), [value]);
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(
    () => selected?.getFullYear() ?? now.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    () => selected?.getMonth() ?? now.getMonth()
  );
  const [draftHour, setDraftHour] = useState(() =>
    pad(selected?.getHours() ?? now.getHours())
  );
  const [draftMinute, setDraftMinute] = useState(() =>
    pad(selected?.getMinutes() ?? 0)
  );

  const setValue = (next: string) => {
    if (controlledValue === undefined) {
      setUncontrolled(next);
    }
    onChange?.(next);
  };

  const syncDraftFromValue = () => {
    const base = selected ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setDraftHour(pad(base.getHours()));
    setDraftMinute(pad(base.getMinutes()));
  };

  const setOpenState = (next: boolean) => {
    if (next) {
      syncDraftFromValue();
    }
    setOpen(next);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(startOfMonth(viewYear, viewMonth));

  const cells = useMemo(() => {
    const first = startOfMonth(viewYear, viewMonth);
    const offset = mondayIndex(first);
    const total = daysInMonth(viewYear, viewMonth);
    const prevTotal = daysInMonth(
      viewMonth === 0 ? viewYear - 1 : viewYear,
      viewMonth === 0 ? 11 : viewMonth - 1
    );
    const items: Array<{
      readonly date: Date;
      readonly outside: boolean;
    }> = [];

    for (let i = offset - 1; i >= 0; i -= 1) {
      items.push({
        date: new Date(
          viewMonth === 0 ? viewYear - 1 : viewYear,
          viewMonth === 0 ? 11 : viewMonth - 1,
          prevTotal - i
        ),
        outside: true,
      });
    }
    for (let day = 1; day <= total; day += 1) {
      items.push({
        date: new Date(viewYear, viewMonth, day),
        outside: false,
      });
    }
    while (items.length % 7 !== 0 || items.length < 42) {
      const last = items[items.length - 1]!.date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      items.push({ date: next, outside: true });
      if (items.length >= 42) {
        break;
      }
    }
    return items;
  }, [viewYear, viewMonth]);

  const applyDay = (day: Date) => {
    const hour = Number.parseInt(draftHour, 10);
    const minute = Number.parseInt(draftMinute, 10);
    const next = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      Number.isFinite(hour) ? hour : 0,
      Number.isFinite(minute) ? minute : 0,
      0,
      0
    );
    setValue(toLocalValue(next));
  };

  const applyNow = () => {
    const next = new Date();
    setDraftHour(pad(next.getHours()));
    setDraftMinute(pad(next.getMinutes()));
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    setValue(toLocalValue(next));
  };

  const applyDone = () => {
    if (!value && required) {
      applyNow();
    } else if (value) {
      const base = parseLocal(value) ?? now;
      const hour = Number.parseInt(draftHour, 10);
      const minute = Number.parseInt(draftMinute, 10);
      const next = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        Number.isFinite(hour) ? hour : base.getHours(),
        Number.isFinite(minute) ? minute : base.getMinutes(),
        0,
        0
      );
      setValue(toLocalValue(next));
    }
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpenState(true);
    }
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => pad(i));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => pad(i));

  return (
    <div className="relative">
      <label htmlFor={id} className="text-sm font-medium text-[var(--crm-text-secondary)]">
        {label}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      <input
        type="hidden"
        name={name}
        value={value}
        required={required}
        aria-invalid={hasError || undefined}
      />
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-describedby={describedBy}
        data-testid={testId}
        onClick={() => setOpenState(!open)}
        onKeyDown={onTriggerKeyDown}
        className={[
          "crm-input mt-1 flex min-h-11 w-full items-center justify-between gap-2 text-left text-base sm:text-sm",
          hasError ? "border-[var(--crm-danger)]" : "",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span
          className={
            value
              ? "text-[var(--crm-text)]"
              : "text-[var(--crm-muted)]"
          }
        >
          {formatDisplay(value)}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 shrink-0 text-[var(--crm-muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <rect x="3" y="4" width="14" height="13" rx="2" />
          <path d="M3 8h14M7 2.5v3M13 2.5v3" />
        </svg>
      </button>

      {open ? (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-label={label}
          className="absolute left-0 z-40 mt-2 w-[min(100vw-1.5rem,22rem)] rounded-[12px] border border-[var(--crm-border-strong)] bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.12)] motion-safe:transition-opacity motion-safe:duration-150"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="crm-btn crm-btn-ghost size-11 shrink-0 px-0"
              aria-label="Previous month"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-[var(--crm-text)]">
              {monthLabel}
            </p>
            <button
              type="button"
              className="crm-btn crm-btn-ghost size-11 shrink-0 px-0"
              aria-label="Next month"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[var(--crm-muted)]">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, outside }) => {
              const isSelected = selected ? sameDay(date, selected) : false;
              const isToday = sameDay(date, now);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  aria-label={date.toDateString()}
                  aria-pressed={isSelected}
                  onClick={() => applyDay(date)}
                  className={[
                    "flex size-10 items-center justify-center rounded-md text-sm motion-safe:transition-colors motion-safe:duration-150",
                    outside
                      ? "text-[var(--crm-muted)]/70"
                      : "text-[var(--crm-text)]",
                    isSelected
                      ? "bg-[var(--crm-primary)] font-semibold text-white"
                      : isToday
                        ? "border border-[var(--crm-primary)]/40 bg-[var(--crm-primary-soft)]"
                        : "hover:bg-[var(--crm-surface-subtle)]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-[12px] font-medium text-[var(--crm-text-secondary)]">
              Hour
              <select
                className="crm-input mt-1 w-full text-base sm:text-sm"
                value={draftHour}
                onChange={(event) => {
                  setDraftHour(event.target.value);
                  if (selected) {
                    const next = new Date(selected);
                    next.setHours(Number.parseInt(event.target.value, 10));
                    setValue(toLocalValue(next));
                  }
                }}
              >
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] font-medium text-[var(--crm-text-secondary)]">
              Minute
              <select
                className="crm-input mt-1 w-full text-base sm:text-sm"
                value={draftMinute}
                onChange={(event) => {
                  setDraftMinute(event.target.value);
                  if (selected) {
                    const next = new Date(selected);
                    next.setMinutes(Number.parseInt(event.target.value, 10));
                    setValue(toLocalValue(next));
                  }
                }}
              >
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="crm-btn crm-btn-secondary min-h-11 flex-1"
              onClick={applyNow}
            >
              Now
            </button>
            {clearable ? (
              <button
                type="button"
                className="crm-btn crm-btn-ghost min-h-11 flex-1"
                onClick={() => {
                  setValue("");
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              className="crm-btn crm-btn-primary min-h-11 flex-1"
              onClick={applyDone}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
