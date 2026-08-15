"use client";
/**
 * Week-at-a-time date picker used by Diet and Exercise.
 *
 * Both pages previously pinned you to the current week, so there was no way to
 * open an older log. This keeps the same compact strip but lets you page back
 * through weeks; future days stay disabled because there is nothing to show.
 */
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Sunday of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const copy = startOfDay(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function WeekStrip({
  value,
  onChange,
  marked,
}: {
  /** Currently selected date. */
  value: Date;
  onChange: (date: Date) => void;
  /** Optional dot under days that have activity (e.g. a logged workout). */
  marked?: (date: Date) => boolean;
}) {
  const today = startOfDay(new Date());
  // The visible week follows the selection, so paging and picking stay in sync.
  const weekStart = startOfWeek(value);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // Nothing to show past today, so forward paging stops at the current week.
  const canGoForward = addDays(weekStart, 7) <= today;
  const showingCurrentWeek = sameDay(weekStart, startOfWeek(today));

  const monthLabel = (() => {
    const first = days[0];
    const last = days[6];
    const opts: Intl.DateTimeFormatOptions = { month: "short" };
    return first.getMonth() === last.getMonth()
      ? `${first.toLocaleDateString("en-US", opts)} ${first.getFullYear()}`
      : `${first.toLocaleDateString("en-US", opts)} – ${last.toLocaleDateString("en-US", opts)} ${last.getFullYear()}`;
  })();

  const step = (weeks: number) => onChange(addDays(value, weeks * 7));

  return (
    <div className="cl-card" style={{ borderRadius: 16, padding: "10px 10px 8px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6, paddingInline: 2 }}>
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous week"
          className="cl-week-nav"
        >
          <ChevronLeft size={16} />
        </button>

        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.4, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
            {monthLabel}
          </span>
          {!showingCurrentWeek && (
            <button type="button" onClick={() => onChange(today)} className="cl-week-today">
              Today
            </button>
          )}
        </span>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canGoForward}
          aria-label="Next week"
          className="cl-week-nav"
          style={{ opacity: canGoForward ? 1 : 0.3, cursor: canGoForward ? "pointer" : "default" }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {days.map((date, i) => {
          const isFuture = date > today;
          const isActive = sameDay(date, value);
          const isToday = sameDay(date, today);
          return (
            <button
              key={date.toISOString()}
              onClick={() => !isFuture && onChange(date)}
              disabled={isFuture}
              aria-current={isActive ? "date" : undefined}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: "center",
                padding: "8px 0",
                borderRadius: 11,
                cursor: isFuture ? "default" : "pointer",
                border: "none",
                background: isActive ? "var(--accent)" : "transparent",
                opacity: isFuture ? 0.35 : 1,
                transition: "background .15s ease",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: isActive ? "var(--on-accent)" : "var(--text-tertiary)" }}>
                {DAY_LABELS[i]}
              </div>
              <div
                className="cl-mono"
                style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: isActive ? "var(--on-accent)" : "var(--text-primary)" }}
              >
                {date.getDate()}
              </div>
              {/* Activity dot, else a marker for today once you've moved off it. */}
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  margin: "3px auto 0",
                  background: marked?.(date)
                    ? isActive
                      ? "var(--on-accent)"
                      : "var(--accent)"
                    : isToday && !isActive
                    ? "color-mix(in srgb, var(--accent) 45%, transparent)"
                    : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .cl-week-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .cl-week-nav:hover:not(:disabled) {
          background: var(--surface-elevated);
        }
        .cl-week-today {
          border: none;
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          color: var(--accent-text);
          font-size: 11px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 999px;
          cursor: pointer;
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}
