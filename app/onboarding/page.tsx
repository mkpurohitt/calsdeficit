"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";
import { getUserGoal, saveUserGoal } from "../../lib/user-data";
import { apiFetch } from "../../lib/api-client";
import {
  ACTIVITY_LABELS,
  calculatePlan,
  templateWeeklyPlan,
  type ActivityLevel,
  type Gender,
  type GoalType,
  type PlanResult,
} from "../../lib/plan";
import { BrandMark } from "../../components/AppLayout";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  Flame,
  Footprints,
  Loader2,
  Mars,
  Minus,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Venus,
  Droplet,
} from "lucide-react";

type StepKey = "welcome" | "gender" | "age" | "height" | "weight" | "goal" | "goalWeight" | "activity" | "building" | "results";

const QUESTION_STEPS: StepKey[] = ["gender", "age", "height", "weight", "goal", "goalWeight", "activity"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth() as {
    user: { uid: string; displayName?: string | null } | null;
    loading: boolean;
  };

  const [step, setStep] = useState<StepKey>("welcome");
  const [animKey, setAnimKey] = useState(0);

  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(70);
  const [goal, setGoal] = useState<GoalType | null>(null);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);

  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const goTo = (next: StepKey) => {
    setStep(next);
    setAnimKey((k) => k + 1);
  };

  const stepIndex = QUESTION_STEPS.indexOf(step as (typeof QUESTION_STEPS)[number]);
  const progress = step === "welcome" ? 0 : step === "building" || step === "results" ? 100 : ((stepIndex + 1) / (QUESTION_STEPS.length + 1)) * 100;

  const canContinue = useMemo(() => {
    switch (step) {
      case "gender": return gender !== null;
      case "age": return age >= 13 && age <= 100;
      case "height": return height >= 120 && height <= 230;
      case "weight": return weight >= 30 && weight <= 250;
      case "goal": return goal !== null;
      case "goalWeight": return goal === "Maintain Weight" || (goalWeight !== null && goalWeight >= 30 && goalWeight <= 250);
      case "activity": return activity !== null;
      default: return true;
    }
  }, [step, gender, age, height, weight, goal, goalWeight, activity]);

  const next = () => {
    if (!canContinue) return;
    if (step === "welcome") return goTo("gender");
    if (step === "goal" && goal === "Maintain Weight") {
      setGoalWeight(null);
      const i = QUESTION_STEPS.indexOf("goal");
      return goTo(QUESTION_STEPS[i + 2]); // skip goalWeight
    }
    if (step === "activity") return buildPlan();
    const i = QUESTION_STEPS.indexOf(step as (typeof QUESTION_STEPS)[number]);
    goTo(QUESTION_STEPS[i + 1]);
  };

  const back = () => {
    if (step === "gender") return goTo("welcome");
    if (step === "activity" && goal === "Maintain Weight") return goTo("goal");
    const i = QUESTION_STEPS.indexOf(step as (typeof QUESTION_STEPS)[number]);
    if (i > 0) goTo(QUESTION_STEPS[i - 1]);
  };

  const buildPlan = async () => {
    if (!gender || !goal || !activity) return;
    goTo("building");
    const computed = calculatePlan({
      gender, age, height_cm: height, weight_kg: weight,
      goal_weight_kg: goalWeight ?? undefined, goal, activity_level: activity,
    });
    setPlan(computed);

    // AI weekly plan (graceful template fallback — never blocks the flow)
    let weekly = templateWeeklyPlan(goal);
    try {
      const res = await apiFetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender, age, height_cm: height, weight_kg: weight, goal,
          activity_level: activity, daily_calories: computed.daily_calories, protein_g: computed.protein_g,
        }),
      });
      const data = await res.json();
      if (data.success && data.plan) weekly = data.plan;
    } catch { /* keep template */ }
    setWeeklyPlan(weekly);

    // small pause so the "building" moment lands, then reveal
    setTimeout(() => goTo("results"), 900);
  };

  const savePlan = async () => {
    if (!user?.uid || !plan || !gender || !goal || !activity) return;
    setSaving(true);
    setError(null);
    try {
      await saveUserGoal({
        user_id: user.uid,
        age, weight_kg: weight, height_cm: height, goal,
        daily_calories: plan.daily_calories,
        protein_g: plan.protein_g, carbs_g: plan.carbs_g, fat_g: plan.fat_g,
        gender, activity_level: activity,
        goal_weight_kg: goalWeight ?? undefined,
        step_goal: plan.step_goal, fiber_g: plan.fiber_g, water_ml: plan.water_ml,
        weekly_plan: weeklyPlan,
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
  }, [step, canContinue, gender, age, height, weight, goal, goalWeight, activity]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-app)" }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--lime-400)" }} />
      </div>
    );
  }

  const firstName = user.displayName?.split(" ")[0] || "athlete";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}>
      {/* Top bar: brand + progress */}
      <div style={{ padding: "22px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <span className="flex items-center" style={{ gap: 9 }}>
          <BrandMark size={26} id="lg-ob" />
          <span className="brand-wordmark" style={{ fontSize: 19 }}>
            calo<span style={{ color: "var(--lime-400)" }}>lean</span>
          </span>
        </span>
        <div style={{ flex: 1, height: 6, background: "var(--surface-elevated)", borderRadius: 99, overflow: "hidden", maxWidth: 420, margin: "0 auto" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "var(--lime-400)", borderRadius: 99, transition: "width .45s cubic-bezier(.34,1.2,.64,1)" }} />
        </div>
        <span style={{ width: 106 }} />
      </div>

      {/* Step body */}
      <div key={animKey} className="ob-body flex-1 flex flex-col items-center justify-center" style={{ padding: "20px 20px 40px", animation: "ob-in .45s cubic-bezier(.22,1,.36,1) both" }}>

        {step === "welcome" && (
          <div style={{ textAlign: "center", maxWidth: 560 }}>
            <div style={{ width: 84, height: 84, margin: "0 auto 26px", borderRadius: 26, background: "rgba(170,255,0,.12)", border: "1px solid rgba(170,255,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", animation: "ob-float 3.5s ease-in-out infinite" }}>
              <Flame size={38} style={{ color: "var(--lime-400)" }} />
            </div>
            <h1 className="cl-disp" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, margin: "0 0 14px" }}>
              Welcome, {firstName} 👋
            </h1>
            <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 34px" }}>
              Answer 6 quick questions and our AI builds your personal daily plan — calories, macros, steps and a weekly workout split. You can change everything later.
            </p>
            <button onClick={next} className="btn-primary" style={{ padding: "15px 36px", borderRadius: 13, fontSize: 16, display: "inline-flex", alignItems: "center", gap: 10 }}>
              Let&apos;s go <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === "gender" && (
          <StepShell title="What's your biological sex?" subtitle="It sets the calorie formula (Mifflin-St Jeor).">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%", maxWidth: 460 }}>
              {([["male", "Male", Mars], ["female", "Female", Venus]] as const).map(([val, label, Icon]) => (
                <button key={val} onClick={() => setGender(val)} className="cl-card-hover"
                  style={{
                    padding: "28px 16px", borderRadius: 18, cursor: "pointer", textAlign: "center",
                    background: gender === val ? "rgba(170,255,0,.12)" : "var(--surface-card)",
                    border: gender === val ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}>
                  <Icon size={34} style={{ color: gender === val ? "var(--lime-400)" : "var(--text-tertiary)", margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{label}</div>
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {step === "age" && (
          <StepShell title="How old are you?" subtitle="Age affects your metabolic rate.">
            <NumberDial value={age} setValue={setAge} min={13} max={100} step={1} unit="years" />
          </StepShell>
        )}

        {step === "height" && (
          <StepShell title="How tall are you?" subtitle="We use it to compute your baseline burn.">
            <NumberDial value={height} setValue={setHeight} min={120} max={230} step={1} unit="cm" />
          </StepShell>
        )}

        {step === "weight" && (
          <StepShell title="What's your current weight?" subtitle="Be honest — this stays private.">
            <NumberDial value={weight} setValue={setWeight} min={30} max={250} step={0.5} unit="kg" />
          </StepShell>
        )}

        {step === "goal" && (
          <StepShell title="What's your goal?" subtitle="This tunes your calories, protein and step target.">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 460 }}>
              {([
                ["Lose Weight", "Sustainable ~0.5 kg/week deficit", TrendingDown],
                ["Maintain Weight", "Hold steady, improve body composition", Minus],
                ["Gain Muscle", "Lean surplus + high protein", TrendingUp],
              ] as const).map(([val, desc, Icon]) => (
                <button key={val} onClick={() => setGoal(val)} className="cl-card-hover"
                  style={{
                    display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 16, cursor: "pointer", textAlign: "left",
                    background: goal === val ? "rgba(170,255,0,.12)" : "var(--surface-card)",
                    border: goal === val ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}>
                  <span style={{ flex: "none", width: 44, height: 44, borderRadius: 12, background: goal === val ? "var(--lime-400)" : "var(--surface-elevated)", color: goal === val ? "#0A0C0F" : "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
          <StepShell title="What's your target weight?" subtitle={goal === "Lose Weight" ? "A realistic pace is 2 kg/month." : "Lean gains: ~1 kg/month."}>
            <NumberDial value={goalWeight ?? weight} setValue={(v) => setGoalWeight(v)} min={30} max={250} step={0.5} unit="kg" />
          </StepShell>
        )}

        {step === "activity" && (
          <StepShell title="How active are you?" subtitle="Outside deliberate workouts count too.">
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 480 }}>
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((lvl) => (
                <button key={lvl} onClick={() => setActivity(lvl)} className="cl-card-hover"
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderRadius: 14, cursor: "pointer", textAlign: "left",
                    background: activity === lvl ? "rgba(170,255,0,.12)" : "var(--surface-card)",
                    border: activity === lvl ? "2px solid var(--lime-400)" : "1px solid var(--border-color)",
                  }}>
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
            <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Calories · macros · steps · weekly split</p>
          </div>
        )}

        {step === "results" && plan && goal && (
          <div style={{ width: "100%", maxWidth: 660 }}>
            <div style={{ textAlign: "center", marginBottom: 26 }}>
              <div className="cl-mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "var(--lime-600)", marginBottom: 8 }}>YOUR PERSONAL PLAN</div>
              <h2 className="cl-disp" style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Here&apos;s your daily target</h2>
            </div>

            {/* Hero calories */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--surface-card)", border: "1px solid rgba(170,255,0,.3)", borderRadius: 20, padding: "26px 24px", textAlign: "center", marginBottom: 14, boxShadow: "0 0 24px rgba(170,255,0,.06)" }}>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 4 }}>Daily calories to {goal === "Gain Muscle" ? "grow" : goal === "Lose Weight" ? "lean out" : "maintain"}</div>
              <div className="cl-mono" style={{ fontSize: 52, fontWeight: 700, color: "var(--lime-400)", lineHeight: 1 }}>{plan.daily_calories.toLocaleString()}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>kcal / day · TDEE {plan.tdee.toLocaleString()} kcal</div>
            </div>

            {/* Macro + lifestyle tiles */}
            <div className="ob-tiles" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
              <Tile color="var(--macro-protein)" label="Protein" value={`${plan.protein_g}g`} icon={<Dumbbell size={15} />} />
              <Tile color="var(--macro-carbs)" label="Carbs" value={`${plan.carbs_g}g`} icon={<Flame size={15} />} />
              <Tile color="var(--macro-fat)" label="Fat" value={`${plan.fat_g}g`} icon={<Scale size={15} />} />
              <Tile color="var(--macro-fiber)" label="Fiber" value={`${plan.fiber_g}g`} icon={<Target size={15} />} />
              <Tile color="var(--info)" label="Steps" value={plan.step_goal.toLocaleString()} icon={<Footprints size={15} />} />
              <Tile color="var(--info)" label="Water" value={`${(plan.water_ml / 1000).toFixed(1)}L`} icon={<Droplet size={15} />} />
            </div>

            {/* Weekly plan */}
            <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", borderRadius: 18, padding: "20px 22px", marginBottom: 22 }}>
              <div className="cl-disp" style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Your weekly training split</div>
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

            {error && (
              <div style={{ marginBottom: 14, padding: "11px 15px", borderRadius: 11, background: "rgba(255,77,77,.1)", border: "1px solid rgba(255,77,77,.35)", color: "var(--error)", fontSize: 13.5 }}>
                {error}
              </div>
            )}

            <button onClick={savePlan} disabled={saving} className="btn-primary" style={{ width: "100%", padding: 16, borderRadius: 13, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: saving ? 0.7 : 1 }}>
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
        <div style={{ padding: "0 20px 34px", display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={back} className="btn-icon" style={{ width: 52, height: 52, borderRadius: 14 }} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <button onClick={next} disabled={!canContinue} className="btn-primary"
            style={{ minWidth: 220, padding: "15px 30px", borderRadius: 14, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, opacity: canContinue ? 1 : 0.4, cursor: canContinue ? "pointer" : "not-allowed" }}>
            Continue <ArrowRight size={17} />
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes ob-in {
          from { opacity: 0; transform: translateY(18px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ob-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-9px); }
        }
        @media (max-width: 640px) {
          .ob-tiles { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ width: "100%", maxWidth: 560, textAlign: "center" }}>
      <h2 className="cl-disp" style={{ fontSize: 30, fontWeight: 700, margin: "0 0 8px" }}>{title}</h2>
      <p style={{ fontSize: 14.5, color: "var(--text-tertiary)", margin: "0 0 30px" }}>{subtitle}</p>
      {children}
    </div>
  );
}

function NumberDial({ value, setValue, min, max, step, unit }: {
  value: number; setValue: (v: number) => void; min: number; max: number; step: number; unit: string;
}) {
  const dec = () => setValue(Math.max(min, Math.round((value - step) * 10) / 10));
  const inc = () => setValue(Math.min(max, Math.round((value + step) * 10) / 10));
  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginBottom: 22 }}>
        <button onClick={dec} className="btn-icon" style={{ width: 54, height: 54, borderRadius: "50%", fontSize: 22 }} aria-label="Decrease">−</button>
        <div style={{ minWidth: 190, textAlign: "center" }}>
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
              width: "100%", textAlign: "center", fontSize: 58, fontWeight: 700, lineHeight: 1,
              background: "none", border: "none", outline: "none", color: "var(--lime-400)",
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
