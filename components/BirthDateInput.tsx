"use client";
/**
 * Day / month / year selects for a date of birth.
 *
 * A native `<input type="date">` renders in the *browser's* locale, so an
 * Indian user on a US-locale Chrome sees mm/dd/yyyy with no way to change it —
 * ambiguous exactly where a wrong reading changes the answer (02/04 is either
 * 2 April or 4 February, a two-month age difference). Three explicit fields
 * are unambiguous in every locale, and easier to fill on a phone than a
 * spinner.
 *
 * Value in/out stays the ISO `yyyy-mm-dd` the rest of the app stores.
 */
import React from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Days in a month, honouring leap years, so 31 April can't be chosen. */
function daysInMonth(month: number, year: number): number {
  if (!month) return 31;
  if (!year) return month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return new Date(year, month, 0).getDate();
}

export default function BirthDateInput({
  value,
  onChange,
  minAge = 13,
  maxAge = 100,
}: {
  /** ISO yyyy-mm-dd, or "" when unset. */
  value: string;
  onChange: (iso: string) => void;
  minAge?: number;
  maxAge?: number;
}) {
  /**
   * The three parts live here rather than being derived from `value`, because
   * a date isn't valid until all three are chosen: deriving them would mean
   * the first pick emits "" and immediately resets the select the user just
   * touched, making the control impossible to complete.
   */
  const [parts, setParts] = React.useState(() => {
    const [yy, mm, dd] = value ? value.split("-").map(Number) : [0, 0, 0];
    return { d: dd || 0, m: mm || 0, y: yy || 0 };
  });

  // Follow an externally restored value (e.g. a resumed onboarding draft).
  React.useEffect(() => {
    if (!value) return;
    const [yy, mm, dd] = value.split("-").map(Number);
    setParts((prev) =>
      prev.d === dd && prev.m === mm && prev.y === yy ? prev : { d: dd || 0, m: mm || 0, y: yy || 0 }
    );
  }, [value]);

  const { d, m, y } = parts;

  const thisYear = new Date().getFullYear();
  const years = React.useMemo(() => {
    const out: number[] = [];
    for (let year = thisYear - minAge; year >= thisYear - maxAge; year--) out.push(year);
    return out;
  }, [thisYear, minAge, maxAge]);

  const emit = (day: number, month: number, year: number) => {
    // Clamp the day when switching to a shorter month (31 Jan → Feb).
    const day2 = day && month ? Math.min(day, daysInMonth(month, year)) : day;
    setParts({ d: day2, m: month, y: year });
    // A partial date isn't a date — report "" until all three are in, so
    // callers never see 0000-04-02.
    onChange(
      day2 && month && year
        ? `${year}-${String(month).padStart(2, "0")}-${String(day2).padStart(2, "0")}`
        : ""
    );
  };

  const dayCount = daysInMonth(m, y);

  return (
    <div className="bd-row">
      <label className="bd-field">
        <span className="bd-label">Day</span>
        <select value={d || ""} onChange={(e) => emit(Number(e.target.value), m, y)} aria-label="Day of birth">
          <option value="">DD</option>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{String(n).padStart(2, "0")}</option>
          ))}
        </select>
      </label>

      <label className="bd-field bd-field--wide">
        <span className="bd-label">Month</span>
        <select value={m || ""} onChange={(e) => emit(d, Number(e.target.value), y)} aria-label="Month of birth">
          <option value="">MM</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>{String(i + 1).padStart(2, "0")} — {name}</option>
          ))}
        </select>
      </label>

      <label className="bd-field">
        <span className="bd-label">Year</span>
        <select value={y || ""} onChange={(e) => emit(d, m, Number(e.target.value))} aria-label="Year of birth">
          <option value="">YYYY</option>
          {years.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <style jsx>{`
        .bd-row {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr) minmax(0, 1fr);
          gap: 10px;
          width: 100%;
        }
        .bd-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .bd-label {
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-tertiary);
          padding-left: 2px;
        }
        .bd-field :global(select) {
          width: 100%;
          min-width: 0;
          appearance: none;
          background: var(--surface-card);
          border: 1.5px solid var(--border-color);
          border-radius: 14px;
          padding: 15px 12px;
          font-family: var(--font-mono);
          font-size: 16px;
          color: var(--text-primary);
          cursor: pointer;
          outline: none;
        }
        .bd-field :global(select:focus) {
          border-color: var(--accent);
        }
        @media (max-width: 420px) {
          .bd-field :global(select) { padding: 13px 9px; font-size: 15px; }
        }
      `}</style>
    </div>
  );
}
