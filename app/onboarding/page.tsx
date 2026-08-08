"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";
import { getUserGoal, saveUserGoal } from "../../lib/user-data";
import { apiFetch } from "../../lib/api-client";
import {
  ACTIVITY_LABELS,
  ageFromBirthDate,
  calculatePlan,
  cmToFtIn,
  ftInToCm,
  kgToLbs,
  lbsToKg,
  templateWeeklyPlan,
  HEALTH_CONDITIONS,
  DIETARY_PREFERENCES,
  COMMON_ALLERGIES,
  type ActivityLevel,
  type Gender,
  type GoalType,
  type HeightUnit,
  type PlanResult,
  type WeightUnit,
} from "../../lib/plan";
import { BrandMark } from "../../components/AppLayout";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  Cake,
  CalendarDays,
  Check,
  Coffee,
  Dumbbell,
  Flame,
  Footprints,
  Loader2,
  Mars,
  Minus,
  Moon,
  Ruler,
  Scale,
  HeartPulse,
  Salad,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Venus,
  Droplet,
} from "lucide-react";

type StepKey =
  | "welcome"
  | "gender"
  | "birthdate"
  | "height"
  | "weight"
  | "goal"
  | "goalWeight"
  | "activity"
  | "days"
  | "health"
  | "diet"
  | "building"
  | "results";

const QUESTION_STEPS: StepKey[] = ["gender", "birthdate", "height", "weight", "goal", "goalWeight", "activity", "days", "health", "diet"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth() as {
    user: { uid: string; displayName?: string | null } | null;
    loading: boolean;
  };

  const [step, setStep] = useState<StepKey>("welcome");
  const [animKey, setAnimKey] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState<string>("");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [heightCm, setHeightCm] = useState(170);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [weightKg, setWeightKg] = useState(70);
  const [goal, setGoal] = useState<GoalType | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [workoutDays, setWorkoutDays] = useState<number | null>(null);
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [healthNotes, setHealthNotes] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState<string | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);

  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<string>("");
  const [dietPlan, setDietPlan] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const age = birthDate ? ageFromBirthDate(birthDate) : 0;

  // Auth + already-onboarded guards
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.uid) return;
    getUserGoal(user.uid).then((existing) => {
      if (existing?.daily_calories) router.replace("/");
    });
  }, [user, router]);

  const goTo = (next: StepKey, dir: 1 | -1 = 1) => {
    setDirection(dir);
    setStep(next);
    setAnimKey((k) => k + 1);
  };

  const stepIndex = QUESTION_STEPS.indexOf(step as (typeof QUESTION_STEPS)[number]);
  const progress =
    step === "welcome" ? 0 : step === "building" || step === "results" ? 100 : ((stepIndex + 1) / (QUESTION_STEPS.length + 1)) * 100;

  const canContinue = useMemo(() => {
    switch (step) {
      case "gender": return gender !== null;
      case "birthdate": return Boolean(birthDate) && age >= 13 && age <= 100;
      case "height": return heightCm >= 120 && heightCm <= 230;
      case "weight": return weightKg >= 30 && weightKg <= 250;
      case "goal": return goal !== null;
      case "goalWeight": return goal === "Maintain Weight" || (goalWeightKg !== null && goalWeightKg >= 30 && goalWeightKg <= 250);
      case "activity": return activity !== null;
      case "days": return workoutDays !== null;
      // Health is optional — "None" is a valid answer, so never block here.
      case "health": return true;
      case "diet": return dietaryPreference !== null;
      default: return true;
    }
  }, [step, gender, birthDate, age, heightCm, weightKg, goal, goalWeightKg, activity, workoutDays, dietaryPreference]);

  const next = () => {
    if (!canContinue) return;
    if (step === "welcome") return goTo("gender");
    if (step === "goal" && goal === "Maintain Weight") {
      setGoalWeightKg(null);
      return goTo("activity");
    }
    if (step === "diet") return buildPlan();
    const i = QUESTION_STEPS.indexOf(step as (typeof QUESTION_STEPS)[number]);
    goTo(QUESTION_STEPS[i + 1]);
  };

  const back = () => {
    if (step === "gender") return goTo("welcome", -1);
    if (step === "activity" && goal === "Maintain Weight") return goTo("goal", -1);
    const i = QUESTION_STEPS.indexOf(step as (typeof QUESTION_STEPS)[number]);
    if (i > 0) goTo(QUESTION_STEPS[i - 1], -1);
  };

  const buildPlan = async () => {
    if (!gender || !goal || !activity || !workoutDays) return;
    goTo("building");
    const computed = calculatePlan({
      gender,
      age,
      height_cm: heightCm,
      weight_kg: weightKg,
      goal_weight_kg: goalWeightKg ?? undefined,
      goal,
      activity_level: activity,
    });
    setPlan(computed);

    // AI weekly plan + diet plan (graceful template fallback — never blocks the flow)
    let weekly = templateWeeklyPlan(goal, workoutDays);
    try {
      const res = await apiFetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender,
          age,
          height_cm: heightCm,
          weight_kg: weightKg,
          goal,
          activity_level: activity,
          daily_calories: computed.daily_calories,
          protein_g: computed.protein_g,
          workout_days: workoutDays,
          // Health context so the plan avoids what it should and targets what it can
          health_conditions: healthConditions,
          dietary_preference: dietaryPreference,
          allergies,
          health_notes: healthNotes,
          meal_targets: computed.meal_targets,
        }),
      });
      const data = await res.json();
      if (data.success && data.plan) weekly = data.plan;
      if (data.success && data.diet_plan) setDietPlan(data.diet_plan);
    } catch {
      /* keep template */
    }
    setWeeklyPlan(weekly);

    // small pause so the "building" moment lands, then reveal
    setTimeout(() => goTo("results"), 1100);
  };

  const savePlan = async () => {
    if (!user?.uid || !plan || !gender || !goal || !activity) return;
    setSaving(true);
    setError(null);
    try {
      await saveUserGoal({
        user_id: user.uid,
        age,
        weight_kg: weightKg,
        height_cm: heightCm,
        goal,
        daily_calories: plan.daily_calories,
        protein_g: plan.protein_g,
        carbs_g: plan.carbs_g,
        fat_g: plan.fat_g,
        gender,
        activity_level: activity,
        goal_weight_kg: goalWeightKg ?? undefined,
        step_goal: plan.step_goal,
        fiber_g: plan.fiber_g,
        water_ml: plan.water_ml,
        birth_date: birthDate,
        workout_days: workoutDays ?? undefined,
        height_unit: heightUnit,
        weight_unit: weightUnit,
        meal_targets: plan.meal_targets,
        weekly_plan: weeklyPlan,
        diet_plan: dietPlan,
        health_conditions: healthConditions,
        dietary_preference: dietaryPreference ?? undefined,
        allergies,
        health_notes: healthNotes.trim() || undefined,
      });
      router.push("/");
    } catch (e) {
      console.error("[onboarding] save failed", e);
      setError("Could not save your plan — check your connection and try again.");
      setSaving(false);
    }
  };

  // Enter advances
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Enter" && step !== "building" && step !== "results") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, canContinue, gender, birthDate, heightCm, weightKg, goal, goalWeightKg, activity, workoutDays]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-app)" }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--lime-400)" }} />
      </div>
    );
  }

  const firstName = user.displayName?.split(" ")[0] || "athlete";
  const maxBirthDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}>
      {/* Top bar: brand + progress */}
      <div className="ob-top" style={{ padding: "22px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <span className="flex items-center" style={{ gap: 9 }}>
          <BrandMark size={26} id="lg-ob" />
          <span className="brand-wordmark ob-brandname" style={{ fontSize: 19 }}>
            calo<span style={{ color: "var(--lime-400)" }}>lean</span>
          </span>
        </span>
        <div style={{ flex: 1, height: 6, background: "var(--surface-elevated)", borderRadius: 99, overflow: "hidden", maxWidth: 420, margin: "0 auto" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "var(--lime-400)", borderRadius: 99, transition: "width .5s cubic-bezier(.34,1.2,.64,1)" }} />
        </div>
        <span className="ob-topspacer" style={{ width: 106 }} />
      </div>

      {/* Step body */}
      <div
        key={animKey}
        className="ob-body flex-1 flex flex-col items-center justify-center"
        style={{
          padding: "20px 20px 40px",
          animation: `${direction === 1 ? "ob-in" : "ob-in-back"} .5s cubic-bezier(.22,1,.36,1) both`,
        }}
      >
        {step === "welcome" && (
          <div style={{ textAlign: "center", maxWidth: 560 }}>
            <div
              style={{
                width: 84,
                height: 84,
                margin: "0 auto 26px",
                borderRadius: 26,
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "ob-float 3.5s ease-in-out infinite",
              }}
            >
              <Flame size={38} style={{ color: "var(--lime-400)" }} />
            </div>
            <h1 className="cl-disp ob-title-xl" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, margin: "0 0 14px" }}>
              Welcome, {firstName} 👋
            </h1>
            <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 34px" }}>
              A few quick questions and our AI builds your personal plan — calories, macros per meal, steps and a detailed weekly training split. You can change everything later.
            </p>
            <button onClick={next} className="btn-primary" style={{ padding: "15px 36px", borderRadius: 13, fontSize: 16, display: "inline-flex", alignItems: "center", gap: 10 }}>
              Let&apos;s go <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === "gender" && (
          <StepShell title="What's your biological sex?" subtitle="It sets the calorie formula (Mifflin-St Jeor).">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%", maxWidth: 460 }}>
              {([["male", "Male", Mars], ["female", "Female", Venus]] as const).map(([val, label, Icon], i) => (
                <button
                  key={val}
                  onClick={() => setGender(val)}
                  className="cl-card-hover ob-option"
                  style={{
                    animationDelay: `${i * 70}ms`,
                    padding: "28px 16px",
                    borderRadius: 18,
                    cursor: "pointer",
                    textAlign: "center",
                    background: gender === val ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-card)",
                    border: gender === val ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}
                >
                  <Icon size={34} style={{ color: gender === val ? "var(--lime-400)" : "var(--text-tertiary)", margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{label}</div>
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {step === "birthdate" && (
          <StepShell title="When were you born?" subtitle="Your age tunes your metabolic rate.">
            <div style={{ width: "100%", maxWidth: 400 }}>
              <div
                className="flex items-center"
                style={{
                  gap: 12,
                  background: "var(--surface-card)",
                  border: "1.5px solid var(--border-color)",
                  borderRadius: 16,
                  padding: "16px 18px",
                }}
              >
                <Cake size={22} style={{ color: "var(--lime-400)", flex: "none" }} />
                <input
                  type="date"
                  value={birthDate}
                  max={maxBirthDate}
                  min="1926-01-01"
                  onChange={(e) => setBirthDate(e.target.value)}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    fontSize: 18,
                    fontFamily: "var(--font-mono)",
                    colorScheme: "dark",
                  }}
                  aria-label="Birth date"
                />
              </div>
              {birthDate && age >= 13 && (
                <div className="ob-option" style={{ marginTop: 18, textAlign: "center", fontSize: 15, color: "var(--text-secondary)" }}>
                  You&apos;re <span className="cl-mono" style={{ color: "var(--lime-400)", fontWeight: 700, fontSize: 19 }}>{age}</span> years young 💪
                </div>
              )}
              {birthDate && age < 13 && (
                <div style={{ marginTop: 18, textAlign: "center", fontSize: 13.5, color: "var(--error)" }}>
                  You must be at least 13 to use Calolean.
                </div>
              )}
            </div>
          </StepShell>
        )}

        {step === "height" && (
          <StepShell title="How tall are you?" subtitle="We use it to compute your baseline burn.">
            <UnitToggle
              options={[["cm", "cm"], ["ft", "ft + in"]]}
              value={heightUnit}
              onChange={(u) => setHeightUnit(u as HeightUnit)}
            />
            {heightUnit === "cm" ? (
              <NumberDial value={heightCm} setValue={(v) => setHeightCm(Math.round(v))} min={120} max={230} step={1} unit="cm" />
            ) : (
              <FtInDial heightCm={heightCm} setHeightCm={setHeightCm} />
            )}
          </StepShell>
        )}

        {step === "weight" && (
          <StepShell title="What's your current weight?" subtitle="Be honest — this stays private.">
            <UnitToggle
              options={[["kg", "kg"], ["lbs", "lbs"]]}
              value={weightUnit}
              onChange={(u) => setWeightUnit(u as WeightUnit)}
            />
            {weightUnit === "kg" ? (
              <NumberDial value={weightKg} setValue={(v) => setWeightKg(Math.round(v * 10) / 10)} min={30} max={250} step={0.5} unit="kg" />
            ) : (
              <NumberDial
                value={kgToLbs(weightKg)}
                setValue={(v) => setWeightKg(lbsToKg(v))}
                min={66}
                max={550}
                step={1}
                unit="lbs"
              />
            )}
          </StepShell>
        )}

        {step === "goal" && (
          <StepShell title="What's your goal?" subtitle="This tunes your calories, protein and step target.">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 460 }}>
              {([
                ["Lose Weight", "Sustainable ~0.5 kg/week deficit", TrendingDown],
                ["Maintain Weight", "Hold steady, improve body composition", Minus],
                ["Gain Muscle", "Lean surplus + high protein", TrendingUp],
              ] as const).map(([val, desc, Icon], i) => (
                <button
                  key={val}
                  onClick={() => setGoal(val)}
                  className="cl-card-hover ob-option"
                  style={{
                    animationDelay: `${i * 70}ms`,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "18px 20px",
                    borderRadius: 16,
                    cursor: "pointer",
                    textAlign: "left",
                    background: goal === val ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-card)",
                    border: goal === val ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}
                >
                  <span
                    style={{
                      flex: "none",
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: goal === val ? "var(--lime-400)" : "var(--surface-elevated)",
                      color: goal === val ? "var(--on-accent)" : "var(--text-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={22} />
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{val}</span>
                    <span style={{ display: "block", fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {step === "goalWeight" && (
          <StepShell
            title="What's your target weight?"
            subtitle={goal === "Lose Weight" ? "A realistic pace is ~2 kg/month." : "Lean gains: ~1 kg/month."}
          >
            <UnitToggle
              options={[["kg", "kg"], ["lbs", "lbs"]]}
              value={weightUnit}
              onChange={(u) => setWeightUnit(u as WeightUnit)}
            />
            {weightUnit === "kg" ? (
              <NumberDial
                value={goalWeightKg ?? weightKg}
                setValue={(v) => setGoalWeightKg(Math.round(v * 10) / 10)}
                min={30}
                max={250}
                step={0.5}
                unit="kg"
              />
            ) : (
              <NumberDial
                value={kgToLbs(goalWeightKg ?? weightKg)}
                setValue={(v) => setGoalWeightKg(lbsToKg(v))}
                min={66}
                max={550}
                step={1}
                unit="lbs"
              />
            )}
          </StepShell>
        )}

        {step === "activity" && (
          <StepShell title="How active are you?" subtitle="Outside deliberate workouts count too.">
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 480 }}>
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((lvl, i) => (
                <button
                  key={lvl}
                  onClick={() => setActivity(lvl)}
                  className="cl-card-hover ob-option"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "15px 18px",
                    borderRadius: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    background: activity === lvl ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-card)",
                    border: activity === lvl ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}
                >
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{ACTIVITY_LABELS[lvl].label}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 1 }}>{ACTIVITY_LABELS[lvl].desc}</span>
                  </span>
                  {activity === lvl && <Check size={19} style={{ color: "var(--lime-400)" }} />}
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {step === "days" && (
          <StepShell title="How many days can you train?" subtitle="Your weekly split is built around this.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", maxWidth: 460 }}>
              {[2, 3, 4, 5, 6, 7].map((d, i) => (
                <button
                  key={d}
                  onClick={() => setWorkoutDays(d)}
                  className="cl-card-hover ob-option"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    padding: "20px 10px",
                    borderRadius: 16,
                    cursor: "pointer",
                    textAlign: "center",
                    background: workoutDays === d ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-card)",
                    border: workoutDays === d ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}
                >
                  <div className="cl-mono" style={{ fontSize: 26, fontWeight: 700, color: workoutDays === d ? "var(--lime-400)" : "var(--text-primary)" }}>
                    {d}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>days / week</div>
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {step === "health" && (
          <StepShell
            title="Anything we should plan around?"
            subtitle="Pick what applies. This keeps your plan safe — and stays private to your account."
          >
            <div style={{ width: "100%", maxWidth: 560 }}>
              <ChipGrid
                options={[...HEALTH_CONDITIONS]}
                selected={healthConditions}
                onToggle={(v) =>
                  setHealthConditions((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
                }
              />

              <button
                type="button"
                onClick={() => setHealthConditions([])}
                className="ob-option"
                style={{
                  marginTop: 12,
                  padding: "10px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 600,
                  width: "100%",
                  background: healthConditions.length === 0 ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-card)",
                  border: healthConditions.length === 0 ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
                  color: healthConditions.length === 0 ? "var(--lime-400)" : "var(--text-secondary)",
                }}
              >
                {healthConditions.length === 0 ? "✓ Nothing to report — I'm healthy" : "Clear all — nothing applies"}
              </button>

              <textarea
                value={healthNotes}
                onChange={(e) => setHealthNotes(e.target.value.slice(0, 400))}
                placeholder="Optional: medications, injuries, or anything else we should know…"
                rows={2}
                style={{
                  marginTop: 12,
                  width: "100%",
                  resize: "vertical",
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: "var(--text-primary)",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 8, textAlign: "left" }}>
                Calolean gives nutrition and training guidance — it isn&apos;t medical advice. Check with your doctor
                before big changes.
              </div>
            </div>
          </StepShell>
        )}

        {step === "diet" && (
          <StepShell title="How do you eat?" subtitle="So every suggestion is something you'd actually eat.">
            <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 10 }}>
              {DIETARY_PREFERENCES.map((pref, i) => (
                <button
                  key={pref}
                  onClick={() => setDietaryPreference(pref)}
                  className="cl-card-hover ob-option"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 18px",
                    borderRadius: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    background: dietaryPreference === pref ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-card)",
                    border: dietaryPreference === pref ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}
                >
                  <Salad size={17} style={{ flex: "none", color: dietaryPreference === pref ? "var(--lime-400)" : "var(--text-tertiary)" }} />
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{pref}</span>
                  {dietaryPreference === pref && <Check size={18} style={{ color: "var(--lime-400)" }} />}
                </button>
              ))}

              <div style={{ marginTop: 8, textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 9 }}>
                  Allergies or foods to avoid <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>(optional)</span>
                </div>
                <ChipGrid
                  options={[...COMMON_ALLERGIES]}
                  selected={allergies}
                  onToggle={(v) => setAllergies((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
                />
              </div>
            </div>
          </StepShell>
        )}

        {step === "building" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 26px" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid var(--surface-elevated)" }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "var(--lime-400)", animation: "lime-rotate 0.9s linear infinite" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Flame size={36} style={{ color: "var(--lime-400)" }} />
              </div>
            </div>
            <h2 className="cl-disp" style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>Building your plan…</h2>
            <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Calories · meal targets · macros · weekly split</p>
          </div>
        )}

        {step === "results" && plan && goal && (
          <div style={{ width: "100%", maxWidth: 660 }}>
            <div className="ob-option" style={{ textAlign: "center", marginBottom: 26 }}>
              <div className="cl-mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "var(--lime-600)", marginBottom: 8 }}>YOUR PERSONAL PLAN</div>
              <h2 className="cl-disp" style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Here&apos;s your daily target</h2>
            </div>

            {/* Hero calories */}
            <div
              className="ob-option"
              style={{
                animationDelay: "80ms",
                position: "relative",
                overflow: "hidden",
                background: "var(--surface-card)",
                border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                borderRadius: 20,
                padding: "26px 24px",
                textAlign: "center",
                marginBottom: 14,
                boxShadow: "0 0 24px color-mix(in srgb, var(--accent) 6%, transparent)",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 4 }}>
                Daily calories to {goal === "Gain Muscle" ? "grow" : goal === "Lose Weight" ? "lean out" : "maintain"}
              </div>
              <div className="cl-mono" style={{ fontSize: 52, fontWeight: 700, color: "var(--lime-400)", lineHeight: 1 }}>
                {plan.daily_calories.toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>kcal / day · TDEE {plan.tdee.toLocaleString()} kcal</div>
            </div>

            {/* Macro + lifestyle tiles */}
            <div className="ob-tiles ob-option" style={{ animationDelay: "150ms", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
              <Tile color="var(--macro-protein)" label="Protein" value={`${plan.protein_g}g`} icon={<Dumbbell size={15} />} />
              <Tile color="var(--macro-carbs)" label="Carbs" value={`${plan.carbs_g}g`} icon={<Flame size={15} />} />
              <Tile color="var(--macro-fat)" label="Fat" value={`${plan.fat_g}g`} icon={<Scale size={15} />} />
              <Tile color="var(--macro-fiber)" label="Fiber" value={`${plan.fiber_g}g`} icon={<Target size={15} />} />
              <Tile color="var(--info)" label="Steps" value={plan.step_goal.toLocaleString()} icon={<Footprints size={15} />} />
              <Tile color="var(--info)" label="Water" value={`${(plan.water_ml / 1000).toFixed(1)}L`} icon={<Droplet size={15} />} />
            </div>

            {/* Meal calorie split */}
            <div
              className="ob-option"
              style={{ animationDelay: "220ms", background: "var(--surface-card)", border: "1px solid var(--border-color)", borderRadius: 18, padding: "20px 22px", marginBottom: 14 }}
            >
              <div className="cl-disp" style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Calories by meal</div>
              <div className="ob-meals" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <MealTile icon={<Sun size={15} />} label="Breakfast" kcal={plan.meal_targets.breakfast} />
                <MealTile icon={<Flame size={15} />} label="Lunch" kcal={plan.meal_targets.lunch} />
                <MealTile icon={<Moon size={15} />} label="Dinner" kcal={plan.meal_targets.dinner} />
                <MealTile icon={<Coffee size={15} />} label="Snacks" kcal={plan.meal_targets.snacks} />
              </div>
            </div>

            {/* Weekly plan */}
            <div
              className="ob-option"
              style={{ animationDelay: "290ms", background: "var(--surface-card)", border: "1px solid var(--border-color)", borderRadius: 18, padding: "20px 22px", marginBottom: 22 }}
            >
              <div className="flex items-center" style={{ gap: 9, marginBottom: 12 }}>
                <CalendarDays size={17} style={{ color: "var(--lime-400)" }} />
                <div className="cl-disp" style={{ fontWeight: 700, fontSize: 16 }}>
                  Your weekly training split{workoutDays ? ` · ${workoutDays} days` : ""}
                </div>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.9, color: "var(--text-secondary)" }}>
                <ReactMarkdown
                  components={{
                    p: ({ ...props }) => <p style={{ margin: 0 }} {...props} />,
                    strong: ({ ...props }) => <strong style={{ color: "var(--lime-600)", fontWeight: 700 }} {...props} />,
                  }}
                >
                  {weeklyPlan}
                </ReactMarkdown>
              </div>
            </div>

            {/* Diet plan — built from the same goals + health answers */}
            {dietPlan && (
              <div
                className="ob-option"
                style={{ animationDelay: "340ms", background: "var(--surface-card)", border: "1px solid var(--border-color)", borderRadius: 18, padding: "20px 22px", marginBottom: 22 }}
              >
                <div className="flex items-center" style={{ gap: 9, marginBottom: 12 }}>
                  <Salad size={17} style={{ color: "var(--lime-400)" }} />
                  <div className="cl-disp" style={{ fontWeight: 700, fontSize: 16 }}>
                    Your day of eating{dietaryPreference ? ` · ${dietaryPreference}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.9, color: "var(--text-secondary)" }}>
                  <ReactMarkdown
                    components={{
                      p: ({ ...props }) => <p style={{ margin: 0 }} {...props} />,
                      strong: ({ ...props }) => <strong style={{ color: "var(--lime-600)", fontWeight: 700 }} {...props} />,
                    }}
                  >
                    {dietPlan}
                  </ReactMarkdown>
                </div>
                {(healthConditions.length > 0 || allergies.length > 0) && (
                  <div className="flex items-center" style={{ gap: 7, marginTop: 14, fontSize: 11.5, color: "var(--text-tertiary)" }}>
                    <HeartPulse size={13} style={{ color: "var(--lime-600)", flex: "none" }} />
                    Adjusted for what you told us about your health.
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{ marginBottom: 14, padding: "11px 15px", borderRadius: 11, background: "rgba(255,77,77,.1)", border: "1px solid rgba(255,77,77,.35)", color: "var(--error)", fontSize: 13.5 }}>
                {error}
              </div>
            )}

            <button
              onClick={savePlan}
              disabled={saving}
              className="btn-primary"
              style={{ width: "100%", padding: 16, borderRadius: 13, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {saving ? "Saving…" : "Start my journey"}
            </button>
            <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 12 }}>
              You can edit every number later in Profile → Edit TDEE &amp; Macros.
            </p>
          </div>
        )}
      </div>

      {/* Bottom controls for question steps */}
      {stepIndex >= 0 && (
        <div className="ob-controls" style={{ padding: "0 20px 34px", display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={back} className="btn-icon" style={{ width: 52, height: 52, borderRadius: 14 }} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={next}
            disabled={!canContinue}
            className="btn-primary"
            style={{
              minWidth: 220,
              padding: "15px 30px",
              borderRadius: 14,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              opacity: canContinue ? 1 : 0.4,
              cursor: canContinue ? "pointer" : "not-allowed",
            }}
          >
            Continue <ArrowRight size={17} />
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes ob-in {
          from { opacity: 0; transform: translateX(36px) scale(.985); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes ob-in-back {
          from { opacity: 0; transform: translateX(-36px) scale(.985); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes ob-option-in {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ob-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-9px); }
        }
        .ob-option { animation: ob-option-in .45s cubic-bezier(.22,1,.36,1) both; }
        @media (max-width: 640px) {
          .ob-top { padding: 16px 16px !important; }
          .ob-topspacer { display: none; }
          .ob-brandname { display: none; }
          .ob-body { padding: 12px 16px 24px !important; justify-content: flex-start !important; padding-top: 5vh !important; }
          .ob-title-xl { font-size: 30px !important; }
          .ob-tiles { grid-template-columns: repeat(2, 1fr) !important; }
          .ob-meals { grid-template-columns: repeat(2, 1fr) !important; }
          .ob-controls { padding: 0 16px calc(20px + env(safe-area-inset-bottom, 0px)) !important; position: sticky; bottom: 0; background: linear-gradient(transparent, var(--bg-app) 35%); padding-top: 14px !important; }
          .ob-controls .btn-primary { flex: 1; min-width: 0 !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ob-body, .ob-option { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ width: "100%", maxWidth: 560, textAlign: "center" }}>
      <h2 className="cl-disp" style={{ fontSize: 30, fontWeight: 700, margin: "0 0 8px" }}>{title}</h2>
      <p style={{ fontSize: 14.5, color: "var(--text-tertiary)", margin: "0 0 26px" }}>{subtitle}</p>
      {children}
    </div>
  );
}

function UnitToggle({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 4,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border-color)",
        borderRadius: 99,
        padding: 4,
        marginBottom: 24,
      }}
    >
      {options.map(([val, label]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          style={{
            padding: "7px 20px",
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            border: "none",
            background: value === val ? "var(--lime-400)" : "transparent",
            color: value === val ? "var(--on-accent)" : "var(--text-secondary)",
            transition: "all .18s ease",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function NumberDial({
  value,
  setValue,
  min,
  max,
  step,
  unit,
}: {
  value: number;
  setValue: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
}) {
  const dec = () => setValue(Math.max(min, Math.round((value - step) * 10) / 10));
  const inc = () => setValue(Math.min(max, Math.round((value + step) * 10) / 10));
  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginBottom: 22 }}>
        <button onClick={dec} className="btn-icon" style={{ width: 54, height: 54, borderRadius: "50%", fontSize: 22 }} aria-label="Decrease">−</button>
        <div style={{ minWidth: 170, textAlign: "center" }}>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isNaN(v)) setValue(v);
            }}
            className="cl-mono"
            style={{
              width: "100%",
              textAlign: "center",
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "var(--lime-400)",
              MozAppearance: "textfield",
            }}
          />
          <div style={{ fontSize: 14, color: "var(--text-tertiary)", marginTop: 4 }}>{unit}</div>
        </div>
        <button onClick={inc} className="btn-icon" style={{ width: 54, height: 54, borderRadius: "50%", fontSize: 22 }} aria-label="Increase">+</button>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "var(--lime-400)" }}
        aria-label={unit}
      />
    </div>
  );
}

/** Feet + inches selector that stores canonical centimetres. */
function FtInDial({ heightCm, setHeightCm }: { heightCm: number; setHeightCm: (cm: number) => void }) {
  const { feet, inches } = cmToFtIn(heightCm);
  const setFt = (f: number) => setHeightCm(ftInToCm(f, inches));
  const setIn = (i: number) => setHeightCm(ftInToCm(feet, i));
  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 18 }}>
        {[
          { label: "feet", value: feet, set: setFt, options: [4, 5, 6, 7] },
          { label: "inches", value: inches, set: setIn, options: Array.from({ length: 12 }, (_, i) => i) },
        ].map((dial) => (
          <div key={dial.label} style={{ flex: 1, maxWidth: 170 }}>
            <select
              value={dial.value}
              onChange={(e) => dial.set(parseInt(e.target.value, 10))}
              className="cl-mono"
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: 30,
                fontWeight: 700,
                padding: "14px 8px",
                borderRadius: 16,
                background: "var(--surface-card)",
                border: "1.5px solid var(--border-color)",
                color: "var(--lime-400)",
                outline: "none",
              }}
              aria-label={dial.label}
            >
              {dial.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-tertiary)", marginTop: 6 }}>{dial.label}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center" style={{ gap: 7, fontSize: 13.5, color: "var(--text-secondary)" }}>
        <Ruler size={14} style={{ color: "var(--text-tertiary)" }} />
        = <span className="cl-mono" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{heightCm} cm</span>
      </div>
    </div>
  );
}

/** Compact multi-select chips — used for health conditions and allergies. */
function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
      {options.map((option, i) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            aria-pressed={on}
            className="cl-card-hover ob-option"
            style={{
              animationDelay: `${Math.min(i, 10) * 28}ms`,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 600,
              background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-card)",
              border: on ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
              color: on ? "var(--lime-400)" : "var(--text-secondary)",
            }}
          >
            {on && <Check size={13} />}
            {option}
          </button>
        );
      })}
    </div>
  );
}

function Tile({ color, label, value, icon }: { color: string; label: string; value: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", borderRadius: 14, padding: "16px 12px", textAlign: "center" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: "var(--surface-elevated)", color, marginBottom: 8 }}>
        {icon}
      </span>
      <div className="cl-mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MealTile({ icon, label, kcal }: { icon: React.ReactNode; label: string; kcal: number }) {
  return (
    <div style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
      <span style={{ display: "inline-flex", color: "var(--lime-600)", marginBottom: 5 }}>{icon}</span>
      <div className="cl-mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{kcal.toLocaleString()}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{label} kcal</div>
    </div>
  );
}
