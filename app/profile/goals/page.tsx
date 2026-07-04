"use client";

import { useEffect, useState } from "react";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { getUserGoal, saveUserGoal } from "../../../lib/user-data";
import { apiFetch } from "../../../lib/api-client";
import {
  ACTIVITY_LABELS,
  calculatePlan,
  type ActivityLevel,
  type Gender,
  type GoalType,
} from "../../../lib/plan";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";

const GOALS: GoalType[] = ["Lose Weight", "Maintain Weight", "Gain Muscle"];

interface GoalForm {
  gender: Gender;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal_weight_kg: number | "";
  goal: GoalType;
  activity_level: ActivityLevel;
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
        age: goal?.age ?? 25,
        height_cm: goal?.height_cm ?? 170,
        weight_kg: goal?.weight_kg ?? 70,
        goal_weight_kg: goal?.goal_weight_kg ?? "",
        goal: GOALS.includes(goal?.goal as GoalType) ? (goal?.goal as GoalType) : "Maintain Weight",
        activity_level: (goal?.activity_level as ActivityLevel) || "moderate",
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
      age: form.age,
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
          age: form.age,
          height_cm: form.height_cm,
          weight_kg: form.weight_kg,
          goal: form.goal,
          activity_level: form.activity_level,
          daily_calories: form.daily_calories,
          protein_g: form.protein_g,
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
        age: form.age,
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

          <div className="goals-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
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

          <div className="goals-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
            {numField("Age", "age")}
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
                    color: form.goal === g ? "#0A0C0F" : "var(--text-secondary)",
                    border: form.goal === g ? "1px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}
                >
                  {g}
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
          <div className="goals-grid3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
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
          <textarea
            value={form.weekly_plan}
            onChange={(e) => set("weekly_plan", e.target.value)}
            rows={7}
            className="cl-input"
            style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7 }}
            placeholder="**Mon** — Full-body strength…"
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
          @media (max-width: 720px) {
            .goals-wrap { padding: 20px 16px 40px !important; }
            .goals-grid4 { grid-template-columns: 1fr 1fr !important; }
            .goals-grid3 { grid-template-columns: 1fr 1fr !important; }
            .goals-grid2 { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </AppLayout>
  );
}
