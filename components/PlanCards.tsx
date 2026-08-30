"use client";
/**
 * Card renderers for the AI-generated plans.
 *
 * Both endpoints emit the same shape — one markdown line per day/meal,
 * `**Label** · item · item · item` — which as raw markdown reads as a wall of
 * bold-and-middot text. Parsing it into cards lets the plan sit alongside the
 * calorie and macro tiles instead of looking like a different app.
 */
import React from "react";
import {
  BicepsFlexed, Coffee, Dumbbell, Flame, Footprints, Grip, Moon, Shield,
  Sun, Target, Utensils, Zap, type LucideIcon,
} from "lucide-react";

export interface PlanLine {
  /** Text inside the leading `**…**`. */
  label: string;
  /** Everything after it, split on "·". */
  items: string[];
  /** kcal parsed out of a "(~450 kcal)" suffix, when present. */
  kcal: number | null;
  /** The label with any "(~450 kcal)" and day prefix stripped. */
  focus: string;
}

/**
 * Parses `**Mon — Push** · Bench Press 4×8 · …` or
 * `**Breakfast (~450 kcal)** · Oats · fruit`. Lines that don't match are
 * skipped rather than rendered broken, and the caller falls back to markdown
 * when nothing parses.
 */
export function parsePlanLines(markdown: string): PlanLine[] {
  if (!markdown) return [];
  return markdown
    .split("\n")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((line): PlanLine | null => {
      const bold = line.match(/^\*\*(.+?)\*\*/);
      if (!bold) return null;
      const label = bold[1].trim();
      const rest = line.slice(bold[0].length).replace(/^\s*[·:\-–—]\s*/, "");
      const items = rest.split("·").map((s) => s.trim()).filter(Boolean);

      const kcalMatch = label.match(/\(?~?\s*([\d,]+)\s*kcal\)?/i);
      const kcal = kcalMatch ? Number(kcalMatch[1].replace(/,/g, "")) : null;

      // "Mon — Push" → focus "Push"; "Breakfast (~450 kcal)" → "Breakfast".
      const withoutKcal = label.replace(/\(?~?\s*[\d,]+\s*kcal\)?/i, "").trim();
      const dashSplit = withoutKcal.split(/\s[—–-]\s/);
      const focus = (dashSplit[1] || dashSplit[0] || "").trim();

      return { label: withoutKcal, items, kcal, focus };
    })
    .filter((l): l is PlanLine => l !== null && l.items.length > 0);
}

/** Muscle symbol guessed from an exercise name — mirrors the Exercise page. */
function exerciseIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/bench|push[- ]?up|chest|fly|dip/.test(n)) return Shield;
  if (/row|pull[- ]?up|pulldown|lat|deadlift|back/.test(n)) return Grip;
  if (/squat|lunge|leg|calf|glute|hip|hamstring|quad/.test(n)) return Footprints;
  if (/curl|tricep|bicep|pushdown|extension|arm/.test(n)) return BicepsFlexed;
  if (/press|raise|shoulder|delt|shrug/.test(n)) return Zap;
  if (/crunch|plank|sit[- ]?up|\bab\b|core|twist/.test(n)) return Target;
  if (/cardio|run|walk|cycle|row machine|steps/.test(n)) return Footprints;
  return Dumbbell;
}

const MEAL_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /breakfast|morning/i, icon: Sun },
  { match: /lunch|midday/i, icon: Flame },
  { match: /dinner|evening|night/i, icon: Moon },
  { match: /snack|shake/i, icon: Coffee },
];

function mealIcon(label: string): LucideIcon {
  return MEAL_ICONS.find((m) => m.match.test(label))?.icon ?? Utensils;
}

/** A day that is explicitly rest/recovery gets a quieter treatment. */
function isRestDay(line: PlanLine): boolean {
  return /\brest\b|recovery/i.test(line.label) || /\brest\b|recovery/i.test(line.items.join(" "));
}

/** Splits "Bench Press 4×8" into its name and its sets×reps. */
function splitSetsReps(item: string): { name: string; sets: string | null } {
  const m = item.match(/^(.*?)\s+(\d+\s*[x×]\s*(?:AMRAP|\d+(?:\s*[-–]\s*\d+)?))\b(.*)$/i);
  if (!m) return { name: item, sets: null };
  return { name: (m[1] + (m[3] || "")).trim(), sets: m[2].replace(/\s+/g, "").replace(/x/i, "×") };
}

/* ── Weekly training split ───────────────────────────────────────────────── */

export function WeeklySplitCards({ markdown }: { markdown: string }) {
  const lines = parsePlanLines(markdown);
  if (lines.length === 0) return null;

  return (
    <div className="pc-days">
      {lines.map((line, i) => {
        const rest = isRestDay(line);
        const day = line.label.split(/\s[—–-]\s/)[0].trim();
        return (
          <div key={`${line.label}-${i}`} className={`pc-day${rest ? " pc-day--rest" : ""}`}>
            <div className="pc-day__head">
              <span className="pc-day__name">{day}</span>
              {line.focus && line.focus !== day && <span className="pc-day__focus">{line.focus}</span>}
            </div>
            <div className="pc-day__items">
              {line.items.map((item, j) => {
                if (rest) {
                  return (
                    <span key={j} className="pc-restnote">
                      {item}
                    </span>
                  );
                }
                const { name, sets } = splitSetsReps(item);
                const Icon = exerciseIcon(name);
                return (
                  <span key={j} className="pc-move">
                    <Icon size={13} className="pc-move__icon" />
                    <span className="pc-move__name">{name}</span>
                    {sets && <span className="pc-move__sets">{sets}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .pc-days { display: flex; flex-direction: column; gap: 9px; }
        .pc-day {
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          padding: 12px 14px;
          background: var(--surface-elevated);
        }
        .pc-day--rest { background: transparent; border-style: dashed; }
        .pc-day__head { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; flex-wrap: wrap; }
        .pc-day__name {
          font-family: var(--font-mono);
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--text-tertiary);
        }
        .pc-day__focus {
          font-size: 12.5px;
          font-weight: 700;
          padding: 2px 9px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--accent) 13%, transparent);
          color: var(--accent-text);
        }
        .pc-day--rest .pc-day__focus { background: var(--surface-elevated); color: var(--text-tertiary); }
        .pc-day__items { display: flex; flex-wrap: wrap; gap: 6px; }
        .pc-move {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: 100%;
          min-width: 0;
          padding: 6px 10px;
          border-radius: 9px;
          background: var(--surface-card);
          border: 1px solid var(--border-subtle);
          font-size: 12.5px;
          color: var(--text-primary);
        }
        .pc-move__icon { flex: none; color: var(--accent-text); }
        .pc-move__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pc-move__sets {
          flex: none;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-text);
        }
        .pc-restnote { font-size: 12.5px; color: var(--text-tertiary); line-height: 1.5; }
      `}</style>
    </div>
  );
}

/* ── Day of eating ──────────────────────────────────────────────────────── */

export function DietPlanCards({ markdown }: { markdown: string }) {
  const lines = parsePlanLines(markdown);
  if (lines.length === 0) return null;
  const total = lines.reduce((sum, l) => sum + (l.kcal ?? 0), 0);

  return (
    <div className="pc-meals">
      {lines.map((line, i) => {
        const Icon = mealIcon(line.label);
        return (
          <div key={`${line.label}-${i}`} className="pc-meal">
            <span className="pc-meal__icon"><Icon size={16} /></span>
            <div className="pc-meal__body">
              <div className="pc-meal__head">
                <span className="pc-meal__name">{line.label}</span>
                {line.kcal !== null && <span className="pc-meal__kcal">{line.kcal.toLocaleString()} kcal</span>}
              </div>
              <div className="pc-meal__foods">
                {line.items.map((item, j) => (
                  <span key={j} className="pc-food">{item}</span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      {total > 0 && (
        <div className="pc-total">
          <span>Day total</span>
          <span className="pc-total__value">{total.toLocaleString()} kcal</span>
        </div>
      )}

      <style jsx>{`
        .pc-meals { display: flex; flex-direction: column; gap: 9px; }
        .pc-meal {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: var(--surface-elevated);
          border: 1px solid var(--border-subtle);
        }
        .pc-meal__icon {
          flex: none;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 11px;
          background: color-mix(in srgb, var(--accent) 13%, transparent);
          color: var(--accent-text);
        }
        .pc-meal__body { flex: 1; min-width: 0; }
        .pc-meal__head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
        .pc-meal__name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .pc-meal__kcal {
          flex: none;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          color: var(--accent-text);
        }
        .pc-meal__foods { display: flex; flex-wrap: wrap; gap: 6px; }
        .pc-food {
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--surface-card);
          border: 1px solid var(--border-subtle);
          font-size: 12.5px;
          color: var(--text-secondary);
        }
        .pc-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 14px;
          border-radius: 12px;
          border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
          background: color-mix(in srgb, var(--accent) 8%, transparent);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .pc-total__value { font-family: var(--font-mono); font-weight: 700; color: var(--accent-text); }
      `}</style>
    </div>
  );
}
