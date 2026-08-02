"use client";
// Shared difficulty + MET chips. The catalogue only carries these for some
// sources (RepDB and anything backfilled from it), so both render conditionally
// and the row disappears entirely when neither is known.
import { Flame, Signal } from "lucide-react";

const DIFFICULTY_COLORS: Record<string, { fg: string; bg: string }> = {
  beginner: { fg: "var(--lime-600)", bg: "rgba(170,255,0,.12)" },
  intermediate: { fg: "var(--warning)", bg: "rgba(255,184,0,.12)" },
  advanced: { fg: "var(--error)", bg: "rgba(255,90,90,.12)" },
};

/** kcal/min for a 70 kg reference person: MET × 3.5 × kg / 200. */
export function caloriesPerMinute(met: number, weightKg = 70): number {
  return (met * 3.5 * weightKg) / 200;
}

export function DifficultyChip({ difficulty, size = "sm" }: { difficulty?: string | null; size?: "sm" | "md" }) {
  if (!difficulty) return null;
  const key = difficulty.toLowerCase();
  const c = DIFFICULTY_COLORS[key] || { fg: "var(--text-tertiary)", bg: "var(--surface-elevated)" };
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 4,
        fontSize: size === "md" ? 12 : 11,
        fontWeight: 600,
        padding: size === "md" ? "5px 11px" : "3px 10px",
        borderRadius: 7,
        background: c.bg,
        color: c.fg,
        textTransform: "capitalize",
      }}
    >
      <Signal size={size === "md" ? 13 : 11} />
      {difficulty}
    </span>
  );
}

export function MetChip({ met, size = "sm" }: { met?: number | null; size?: "sm" | "md" }) {
  if (met == null || !Number.isFinite(met) || met <= 0) return null;
  return (
    <span
      className="inline-flex items-center"
      title={`${met} MET · ≈${Math.round(caloriesPerMinute(met))} kcal/min for a 70 kg person`}
      style={{
        gap: 4,
        fontSize: size === "md" ? 12 : 11,
        fontWeight: 600,
        padding: size === "md" ? "5px 11px" : "3px 10px",
        borderRadius: 7,
        background: "var(--surface-elevated)",
        color: "var(--text-secondary)",
      }}
    >
      <Flame size={size === "md" ? 13 : 11} style={{ color: "var(--macro-fat)" }} />
      {Math.round(caloriesPerMinute(met))} kcal/min
    </span>
  );
}
