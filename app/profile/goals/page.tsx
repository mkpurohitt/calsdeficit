"use client";

import { useEffect, useState } from "react";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { getUserGoal, saveUserGoal } from "../../../lib/user-data";
import { apiFetch } from "../../../lib/api-client";
import {
  ACTIVITY_LABELS,
  ageFromBirthDate,
  calculatePlan,
  type ActivityLevel,
  type Gender,
  type GoalType,
} from "../../../lib/plan";
import { BicepsFlexed, Check, Dumbbell, Footprints, Grip, Loader2, RefreshCw, Shield, Sparkles, Target, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const GOALS: GoalType[] = ["Lose Weight", "Maintain Weight", "Gain Muscle"];

/** Muscle symbol for a plan item, guessed from the exercise name. */
function planIconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/bench|push[- ]?up|chest|fly|dip/.test(n)) return Shield;
  if (/row|pull[- ]?up|pulldown|lat|deadlift|back/.test(n)) return Grip;
  if (/squat|lunge|leg|calf|glute|hip|hamstring|quad/.test(n)) return Footprints;
  if (/curl|tricep|bicep|pushdown|extension|arm/.test(n)) return BicepsFlexed;
  if (/press|raise|shoulder|delt|shrug/.test(n)) return Zap;
  if (/crunch|plank|sit[- ]?up|ab|core|twist/.test(n)) return Target;
  return Dumbbell;
}

interface PlanPreviewDay {
  day: string;
  focus: string;
  items: string[];
  isRest: boolean;
}

/** Parses the "**Mon — Push** · Bench 4×8 · …" weekly-plan markdown into day cards. */
function parsePlanPreview(weeklyPlan: string): PlanPreviewDay[] {
  return weeklyPlan
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\*\*/.test(line))
    .map((line) => {
      const bold = line.match(/\*\*(.+?)\*\*/);
      const header = bold ? bold[1] : "";
      const [dayPart, ...focusParts] = header.split(/[—–-]/);
      const focus = focusParts.join("-").trim() || "Training";
      const rest = line.replace(/\*\*(.+?)\*\*/, "").replace(/^\s*[·:]\s*/, "");
      const items = rest.split("·").map((seg) => seg.trim()).filter(Boolean);
      const hasSets = items.some((seg) => /\d+\s*[x×]\s*(\d|AMRAP)/i.test(seg));
      return {
        day: dayPart.trim().slice(0, 3),
        focus,
        items,
        isRest: !hasSets,
      };
    });
}
const WORKOUT_DAY_OPTIONS = [2, 3, 4, 5, 6, 7];

interface GoalForm {
  gender: Gender;
  birth_date: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal_weight_kg: number | "";
  goal: GoalType;
  activity_level: ActivityLevel;
  workout_days: number;
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  step_goal: number;
  weekly_plan: string;
}

export default function GoalsPage() {
  const { user } = useAuth() as { user: { uid?: string } | null };
  const [form, setForm] = useState<GoalForm | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    getUserGoal(user.uid).then((goal) => {
      setForm({
        gender: (goal?.gender as Gender) || "male",
        birth_date: goal?.birth_date ?? "",
        age: goal?.age ?? 25,
        height_cm: goal?.height_cm ?? 170,
        weight_kg: goal?.weight_kg ?? 70,
        goal_weight_kg: goal?.goal_weight_kg ?? "",
        goal: GOALS.includes(goal?.goal as GoalType) ? (goal?.goal as GoalType) : "Maintain Weight",
        activity_level: (goal?.activity_level as ActivityLevel) || "moderate",
        workout_days: goal?.workout_days ?? 4,
        daily_calories: goal?.daily_calories ?? 2000,
        protein_g: goal?.protein_g ?? 120,
        carbs_g: goal?.carbs_g ?? 220,
        fat_g: goal?.fat_g ?? 60,
        fiber_g: goal?.fiber_g ?? 28,
        step_goal: goal?.step_goal ?? 8000,
        weekly_plan: goal?.weekly_plan ?? "",
      });
    });
  }, [user]);

  const set = <K extends keyof GoalForm>(key: K, value: GoalForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  /** Recompute all targets from the profile fields. */
  const recalculate = () => {
    if (!form) return;
    const computed = calculatePlan({
      gender: form.gender,
      age: form.birth_date ? ageFromBirthDate(form.birth_date) : form.age,
      height_cm: form.height_cm,
      weight_kg: form.weight_kg,
      goal_weight_kg: form.goal_weight_kg === "" ? undefined : form.goal_weight_kg,
      goal: form.goal,
      activity_level: form.activity_level,
    });
    setForm((f) =>
      f
        ? {
            ...f,
            daily_calories: computed.daily_calories,
            protein_g: computed.protein_g,
            carbs_g: computed.carbs_g,
            fat_g: computed.fat_g,
            fiber_g: computed.fiber_g,
            step_goal: computed.step_goal,
          }
        : f
    );
  };

  const regeneratePlan = async () => {
    if (!form) return;
    setRegenerating(true);
    try {
      const res = await apiFetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: form.gender,
          age: form.birth_date ? ageFromBirthDate(form.birth_date) : form.age,
          height_cm: form.height_cm,
          weight_kg: form.weight_kg,
          goal: form.goal,
          activity_level: form.activity_level,
          daily_calories: form.daily_calories,
          protein_g: form.protein_g,
          workout_days: form.workout_days,
        }),
      });
      const data = await res.json();
      if (data.success && data.plan) set("weekly_plan", data.plan);
    } catch (e) {
      console.error("[goals] plan regen failed", e);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid || !form) return;
    setSaving(true);
    try {
      await saveUserGoal({
        user_id: user.uid,
        age: form.birth_date ? ageFromBirthDate(form.birth_date) : form.age,
        weight_kg: form.weight_kg,
        height_cm: form.height_cm,
        goal: form.goal,
        daily_calories: form.daily_calories,
        protein_g: form.protein_g,
        carbs_g: form.carbs_g,
        fat_g: form.fat_g,
        gender: form.gender,
        activity_level: form.activity_level,
        goal_weight_kg: form.goal_weight_kg === "" ? undefined : form.goal_weight_kg,
        step_goal: form.step_goal,
        fiber_g: form.fiber_g,
        birth_date: form.birth_date || undefined,
        workout_days: form.workout_days,
        // meal split follows the (possibly manually edited) daily calories
        meal_targets: {
          breakfast: Math.round(form.daily_calories * 0.25),
          lunch: Math.round(form.daily_calories * 0.35),
          dinner: Math.round(form.daily_calories * 0.3),
          snacks: Math.round(form.daily_calories * 0.1),
        },
        weekly_plan: form.weekly_plan,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--lime-400)" }} />
        </div>
      </AppLayout>
    );
  }

  const numField = (label: string, key: keyof GoalForm, step = 1) => (
    <label key={key} style={{ display: "block" }}>
      <span className="cl-label">{label}</span>
      <input
        type="number"
        step={step}
        value={form[key] as number | ""}
        onChange={(e) => {
          const v = e.target.value === "" ? "" : parseFloat(e.target.value);
          set(key, (v === "" ? (key === "goal_weight_kg" ? "" : 0) : v) as GoalForm[typeof key]);
        }}
        className="cl-input"
      />
    </label>
  );

  return (
    <AppLayout>
      <div className="goals-wrap" style={{ padding: "30px 38px 48px", maxWidth: 860, margin: "0 auto" }}>
        <div className="cl-mono" style={{ fontSize: 12, letterSpacing: ".12em", color: "var(--text-tertiary)", marginBottom: 7 }}>
          SETTINGS
        </div>
        <h1 className="cl-disp" style={{ fontSize: 30, fontWeight: 700, margin: "0 0 24px", color: "var(--text-primary)" }}>
          Edit TDEE &amp; Macros
        </h1>

        {/* Profile section */}
        <section className="cl-card" style={{ borderRadius: 18, padding: 24, marginBottom: 18 }}>
          <div className="cl-disp" style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 16 }}>
            Your profile
          </div>

          <div className="goals-grid2" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 14, marginBottom: 14 }}>
            <label style={{ display: "block" }}>
              <span className="cl-label">Biological sex</span>
              <select value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)} className="cl-input">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label style={{ display: "block" }}>
              <span className="cl-label">Activity level</span>
              <select
                value={form.activity_level}
                onChange={(e) => set("activity_level", e.target.value as ActivityLevel)}
                className="cl-input"
              >
                {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {ACTIVITY_LABELS[lvl].label} — {ACTIVITY_LABELS[lvl].desc}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="goals-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 14 }}>
            <label style={{ display: "block" }}>
              <span className="cl-label">
                Birth date{form.birth_date ? ` (${ageFromBirthDate(form.birth_date)}y)` : ""}
              </span>
              <input
                type="date"
                value={form.birth_date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set("birth_date", e.target.value)}
                className="cl-input"
              />
            </label>
            {numField("Height (cm)", "height_cm")}
            {numField("Weight (kg)", "weight_kg", 0.5)}
            {numField("Target weight (kg)", "goal_weight_kg", 0.5)}
          </div>

          <div style={{ marginBottom: 18 }}>
            <span className="cl-label">Goal</span>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => set("goal", g)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 99,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: form.goal === g ? "var(--lime-400)" : "var(--surface-elevated)",
                    color: form.goal === g ? "var(--on-accent)" : "var(--text-secondary)",
                    border: form.goal === g ? "1px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <span className="cl-label">Workout days / week</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {WORKOUT_DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => set("workout_days", d)}
                  className="cl-mono"
                  style={{
                    width: 44,
                    height: 40,
                    borderRadius: 11,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: form.workout_days === d ? "var(--lime-400)" : "var(--surface-elevated)",
                    color: form.workout_days === d ? "var(--on-accent)" : "var(--text-secondary)",
                    border: form.workout_days === d ? "1px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={recalculate}
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 9, borderRadius: 11 }}
          >
            <RefreshCw size={16} /> Recalculate targets from profile
          </button>
        </section>

        {/* Targets section (manually editable) */}
        <section className="cl-card" style={{ borderRadius: 18, padding: 24, marginBottom: 18 }}>
          <div className="cl-disp" style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 4 }}>
            Daily targets
          </div>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 0 16px" }}>
            Fine-tune any number — your dashboard, diet rings and AI use these.
          </p>
          <div className="goals-grid3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            {numField("Calories (kcal)", "daily_calories")}
            {numField("Protein (g)", "protein_g")}
            {numField("Carbs (g)", "carbs_g")}
            {numField("Fat (g)", "fat_g")}
            {numField("Fiber (g)", "fiber_g")}
            {numField("Daily steps", "step_goal", 500)}
          </div>
        </section>

        {/* Weekly plan */}
        <section className="cl-card" style={{ borderRadius: 18, padding: 24, marginBottom: 24 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <div className="cl-disp" style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
              Weekly training split
            </div>
            <button
              onClick={regeneratePlan}
              disabled={regenerating}
              className="btn-ghost"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, borderRadius: 10, opacity: regenerating ? 0.6 : 1 }}
            >
              {regenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Regenerate with AI
            </button>
          </div>
          {/* Structured day-by-day view with muscle symbols */}
          {form.weekly_plan.trim() && (
            <div className="plan-preview" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
              {parsePlanPreview(form.weekly_plan).map((day) => (
                <div
                  key={day.day + day.focus}
                  style={{
                    background: day.isRest ? "var(--surface-elevated)" : "var(--surface-card)",
                    border: day.isRest ? "1px solid var(--border-subtle)" : "1px solid var(--border-color)",
                    borderRadius: 14,
                    padding: "12px 14px",
                  }}
                >
                  <div className="flex items-center" style={{ gap: 8, marginBottom: day.items.length ? 8 : 0 }}>
                    <span className="cl-mono" style={{ flex: "none", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: day.isRest ? "var(--surface-hover)" : "color-mix(in srgb, var(--accent) 12%, transparent)", color: day.isRest ? "var(--text-tertiary)" : "var(--lime-600)" }}>
                      {day.day.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {day.focus}
                    </span>
                  </div>
                  {day.items.map((item) => {
                    const ItemIcon = planIconFor(item);
                    return (
                      <div key={item} className="flex items-center" style={{ gap: 7, padding: "3px 0" }}>
                        <ItemIcon size={13} style={{ flex: "none", color: day.isRest ? "var(--text-tertiary)" : "var(--lime-600)" }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <label className="cl-label">Edit as text (separate exercises with &quot;·&quot;, sets×reps like 4×8)</label>
          <textarea
            value={form.weekly_plan}
            onChange={(e) => set("weekly_plan", e.target.value)}
            rows={7}
            className="cl-input"
            style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7 }}
            placeholder="**Mon — Push** · Bench Press 4×8 · Overhead Press 3×10…"
          />
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
          style={{ width: "100%", padding: 15, borderRadius: 13, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, opacity: saving ? 0.7 : 1 }}
        >
          {saved ? <Check size={18} /> : saving ? <Loader2 size={18} className="animate-spin" /> : null}
          {saved ? "Saved!" : saving ? "Saving…" : "Save changes"}
        </button>

        <style jsx>{`
          @media (max-width: 640px) {
            .plan-preview { grid-template-columns: minmax(0, 1fr) !important; }
          }
          @media (max-width: 720px) {
            .goals-wrap { padding: 20px 16px 40px !important; }
            .goals-grid4 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }
            .goals-grid3 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }
            .goals-grid2 { grid-template-columns: minmax(0, 1fr) !important; }
          }
        `}</style>
      </div>
    </AppLayout>
  );
}
