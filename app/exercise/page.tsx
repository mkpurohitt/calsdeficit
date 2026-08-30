"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "../../components/AppLayout";
import WeekStrip from "../../components/WeekStrip";
import FormCheckPanel from "../../components/FormCheckPanel";
import { useAuth } from "../../lib/AuthContext";
import { getDateKey, getDay, getUserGoal, getWorkoutLogs, saveUserGoal, saveWorkoutLog } from "../../lib/user-data";
import { apiFetch } from "../../lib/api-client";
import { makeVideoThumb, MAX_VIDEO_BYTES, fileToBase64 } from "../../lib/image-compress";
import { STEP_GOAL } from "../../lib/config/app";
import { formatKm, stepsToKm } from "../../lib/plan";
import { ArrowRight, BicepsFlexed, Check, Dumbbell, Footprints, Grip, Loader2, Pencil, Plus, Send, Shield, Sparkles, Target, Upload, Video, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface WorkoutDisplayItem {
  name: string;
  sets: string;
  weight: string;
  muscle: string;
  thumb?: string;
}

interface PlanItem {
  raw: string;
  name: string;
  sets: number | null;
  reps: number | null;
}

interface DayPlan {
  focus: string;
  items: PlanItem[];
  isRest: boolean;
  /** The raw markdown line for this day (used by per-day editing). */
  line: string;
}

const PLAN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parses one "**Mon — Push** · Bench Press 4×8 · …" line of the weekly plan. */
function parsePlanForDay(weeklyPlan: string, jsDay: number): DayPlan | null {
  const dayKey = PLAN_DAYS[jsDay];
  const line = weeklyPlan
    .split("\n")
    .find((l) => new RegExp("^\\*\\*" + dayKey + "\\b", "i").test(l.trim()));
  if (!line) return null;

  const bold = line.match(/\*\*(.+?)\*\*/);
  const focus = bold ? (bold[1].split(/[—–-]/)[1] || bold[1]).trim() : "Training";
  const rest = line.replace(/\*\*(.+?)\*\*/, "").replace(/^\s*[·:]\s*/, "");
  const segments = rest.split("·").map((seg) => seg.trim()).filter(Boolean);

  const items: PlanItem[] = segments.map((seg) => {
    // Accepts "Bench Press 4×8", "Goblet Squat 3×12-15", "Push-ups 3×AMRAP",
    // "Row 3×10-12 per arm" — sets = first number, reps = first rep number.
    const m = seg.match(/^(.*?)\s+(\d+)\s*[x×]\s*(AMRAP|\d+(?:\s*[-–]\s*\d+)?)\b.*$/i);
    if (m) {
      const repsToken = m[3];
      const reps = /amrap/i.test(repsToken) ? 10 : parseInt(repsToken, 10);
      return { raw: seg, name: m[1].trim(), sets: parseInt(m[2], 10), reps: Number.isFinite(reps) ? reps : 10 };
    }
    return { raw: seg, name: seg, sets: null, reps: null };
  });

  const hasSets = items.some((item) => item.sets !== null);
  const isRest = !hasSets || /\b(rest|recovery)\b/i.test(focus);
  return { focus, items, isRest: isRest && !hasSets, line: line.trim() };
}

/** Muscle symbol for a plan/log tile, guessed from the exercise name. */
function exerciseIconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/bench|push[- ]?up|chest|fly|dip/.test(n)) return Shield;
  if (/row|pull[- ]?up|pulldown|lat|deadlift|back/.test(n)) return Grip;
  if (/squat|lunge|leg|calf|glute|hip|hamstring|quad/.test(n)) return Footprints;
  if (/curl|tricep|bicep|pushdown|extension|arm/.test(n)) return BicepsFlexed;
  if (/press|raise|shoulder|delt|shrug/.test(n)) return Zap;
  if (/crunch|plank|sit[- ]?up|ab|core|twist/.test(n)) return Target;
  return Dumbbell;
}

interface LibraryCounts {
  total: number;
  groups: { muscle_group: string; count: number }[];
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Symbol per muscle group for the library teaser tiles. */
function muscleIconFor(group: string): LucideIcon {
  const g = group.toLowerCase();
  if (g.includes("pector") || g.includes("chest")) return Shield;
  if (g.includes("lat") || g.includes("back") || g.includes("trap")) return Grip;
  if (g.includes("quad") || g.includes("hamstring") || g.includes("glute") || g.includes("calv") || g.includes("adductor") || g.includes("abductor") || g.includes("leg")) return Footprints;
  if (g.includes("bicep") || g.includes("tricep") || g.includes("forearm") || g.includes("arm")) return BicepsFlexed;
  if (g.includes("delt") || g.includes("shoulder")) return Zap;
  if (g.includes("ab") || g.includes("core") || g.includes("spine") || g.includes("waist")) return Target;
  return Dumbbell;
}

export default function ExercisePage() {
  const { user } = useAuth() as { user: { uid?: string } | null };
  const formCheckRef = useRef<HTMLDivElement | null>(null);

  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [showFormCheck, setShowFormCheck] = useState(false);

  const [todayWorkout, setTodayWorkout] = useState<WorkoutDisplayItem[]>([]);
  const [workoutDateKeys, setWorkoutDateKeys] = useState<string[]>([]);
  const [selectedDateObj, setSelectedDateObj] = useState(() => new Date());
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(STEP_GOAL);
  /** Height drives stride length, so the goal reads as a real distance. */
  const [heightCm, setHeightCm] = useState(170);
  const [libraryCounts, setLibraryCounts] = useState<LibraryCounts | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<string>("");
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [planEditing, setPlanEditing] = useState(false);
  const [planDraft, setPlanDraft] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
  // AI quick-log
  const [quickText, setQuickText] = useState("");
  const [quickVideo, setQuickVideo] = useState<File | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickSaved, setQuickSaved] = useState(false);

  // Stable per-mount "today" so effects depending on it don't re-run every render
  const today = useMemo(() => new Date(), []);
  const selectedDate = selectedDateObj;
  const selectedDateKey = getDateKey(selectedDate);
  // The weekly plan is keyed by day-of-week, so derive it from the selection.
  const selectedDay = selectedDate.getDay();
  const isSelectedToday = selectedDateKey === getDateKey(today);
  const selectedLogTitle = isSelectedToday
    ? "Today's Log"
    : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const stepPercent = Math.min(steps / stepGoal, 1);
  const stepRingSize = 86;
  const stepR = (stepRingSize / 2) - 7;
  const stepCirc = 2 * Math.PI * stepR;
  const stepDash = stepCirc * (1 - stepPercent);

  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      try {
        const res = await fetch("/api/exercises?counts=1");
        const json = await res.json();
        if (!cancelled && json.success && json.data) setLibraryCounts(json.data);
      } catch {
        // teaser card falls back to a neutral state
      }
    };
    loadCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const userId = user.uid;

    const loadUserData = async () => {
      // Range covers the week being viewed, so paging back loads its logs.
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const [logs, day, goal] = await Promise.all([
        getWorkoutLogs(userId, { from: getDateKey(weekStart), to: getDateKey(weekEnd) }),
        getDay(userId, getDateKey()),
        getUserGoal(userId),
      ]);

      const selectedLogs = logs.filter((log) => log.date_key === selectedDateKey);
      setTodayWorkout(selectedLogs.map((log) => ({
        name: log.exercise_name,
        sets: `${log.sets} x ${log.reps}`,
        weight: `${log.weight_lbs}lbs`,
        muscle: log.muscle_group || "",
        thumb: log.thumb,
      })));

      // Keyed by date rather than weekday so the dots stay correct on any week.
      setWorkoutDateKeys([...new Set(logs.map((log) => log.date_key))]);

      setSteps(day?.steps || 0);
      setStepGoal(goal?.step_goal || STEP_GOAL);
      setHeightCm(goal?.height_cm || 170);
      setWeeklyPlan(goal?.weekly_plan || "");
    };

    loadUserData();
  }, [user, selectedDateKey, selectedDate, analysisVersion, today]);

  const handleUploadClick = () => {
    setShowFormCheck(true);
    setTimeout(() => {
      formCheckRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const dayPlan = useMemo(
    () => (weeklyPlan ? parsePlanForDay(weeklyPlan, selectedDay) : null),
    [weeklyPlan, selectedDay]
  );

  const isPlanItemDone = (item: PlanItem) =>
    todayWorkout.some(
      (log) =>
        log.name.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(log.name.toLowerCase())
    );

  /** Tick a plan item → logs it as a completed workout for the selected day. */
  const handleTickPlanItem = async (item: PlanItem) => {
    if (!user?.uid || planBusy) return;
    setPlanBusy(item.raw);
    try {
      await saveWorkoutLog({
        user_id: user.uid,
        exercise_id: "plan-" + item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        exercise_name: item.name,
        sets: item.sets ?? 3,
        reps: item.reps ?? 10,
        weight_lbs: 0,
        date_key: selectedDateKey,
        logged_at: new Date().toISOString(),
      });
      setAnalysisVersion((v) => v + 1); // reloads logs
    } catch (error) {
      console.error("[exercise] plan tick failed", error);
    } finally {
      setPlanBusy(null);
    }
  };

  /** Saves an edited version of just this day's plan line back into the goal. */
  const handleSavePlanDay = async () => {
    if (!user?.uid || !dayPlan || planSaving) return;
    setPlanSaving(true);
    try {
      const goal = await getUserGoal(user.uid);
      if (!goal) return;
      const dayKey = PLAN_DAYS[selectedDay];
      const draft = planDraft.trim();
      // Keep the **Day** prefix so parsing keeps working even if the user removed it.
      const newLine = new RegExp("^\\*\\*" + dayKey + "\\b", "i").test(draft)
        ? draft
        : `**${dayKey} — ${dayPlan.focus}** · ${draft}`;
      const updated = (goal.weekly_plan || "")
        .split("\n")
        .map((l) => (l.trim() === dayPlan.line ? newLine : l))
        .join("\n");
      await saveUserGoal({ ...goal, weekly_plan: updated });
      setWeeklyPlan(updated);
      setPlanEditing(false);
    } catch (error) {
      console.error("[exercise] plan day save failed", error);
    } finally {
      setPlanSaving(false);
    }
  };

  /** AI quick-log: free text ("bench 4x8 60kg") and/or a short video. */
  const handleQuickLog = async () => {
    if (!user?.uid || quickBusy || (!quickText.trim() && !quickVideo)) return;
    setQuickBusy(true);
    setQuickError(null);
    setQuickSaved(false);
    try {
      let fileData: string | undefined;
      let mimeType: string | undefined;
      if (quickVideo) {
        fileData = await fileToBase64(quickVideo);
        mimeType = quickVideo.type;
      }
      const res = await apiFetch("/api/workout-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: quickText.trim() || undefined, fileData, mimeType }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Could not understand that workout.");
      const w = json.workout as { exercise_name: string; muscle_group: string; sets: number; reps: number; weight_kg: number };
      const thumb = quickVideo ? await makeVideoThumb(quickVideo) : null;
      await saveWorkoutLog({
        user_id: user.uid,
        exercise_id: "ai-" + Date.now(),
        exercise_name: w.exercise_name,
        muscle_group: w.muscle_group || undefined,
        sets: w.sets,
        reps: w.reps,
        weight_lbs: Math.round(w.weight_kg * 2.20462),
        ...(thumb ? { thumb } : {}),
        date_key: selectedDateKey,
        logged_at: new Date().toISOString(),
      });
      setQuickText("");
      setQuickVideo(null);
      setQuickSaved(true);
      setTimeout(() => setQuickSaved(false), 2200);
      setAnalysisVersion((v) => v + 1);
    } catch (error) {
      setQuickError(error instanceof Error ? error.message : "Could not log that. Try rephrasing.");
    } finally {
      setQuickBusy(false);
    }
  };

  const weekNumber = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 1);
    const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
    return Math.ceil((diffDays + start.getDay() + 1) / 7);
  }, [today]);

  const topGroups = libraryCounts?.groups.slice(0, 6) ?? [];

  return (
    <AppLayout>
      <style>{`
        .ex-cols2 { display: grid; grid-template-columns: minmax(0,1fr) 336px; gap: 20px; align-items: start; }
        @media (max-width: 860px) {
          .ex-cols2 { grid-template-columns: minmax(0, 1fr); }
          .ex-wrap { padding: 14px 14px 24px !important; }
          .ex-form-hero { flex-wrap: nowrap !important; padding: 14px 16px !important; gap: 12px !important; margin-bottom: 14px !important; }
          .ex-form-hero .ex-form-icon { width: 40px !important; height: 40px !important; border-radius: 12px !important; }
          .ex-form-hero .ex-form-icon svg { width: 20px !important; height: 20px !important; }
          .ex-form-hero .ex-form-text { min-width: 0 !important; flex: 1 !important; }
          .ex-form-hero .ex-form-text .cl-disp { font-size: 15px !important; }
          .ex-form-hero .ex-form-desc { display: none !important; }
          .ex-form-btn { padding: 9px 14px !important; font-size: 13px !important; border-radius: 10px !important; white-space: nowrap !important; }
          .ex-header { margin-bottom: 14px !important; }
          .ex-header h1 { font-size: 24px !important; }
        }
        @media (max-width: 640px) {
          .plan-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
      <div className="ex-wrap" style={{ padding: "30px 38px 48px", maxWidth: 1380, margin: "0 auto" }}>
        <div className="ex-header" style={{ marginBottom: 24 }}>
          <div className="cl-mono" style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 7 }}>
            TRAINING · WEEK {weekNumber}
          </div>
          <h1 className="cl-disp" style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Exercise
          </h1>
        </div>

        {/* Check Your Form hero */}
        <div
          className="cl-card ex-form-hero"
          style={{ position: "relative", overflow: "hidden", borderRadius: 20, padding: "26px 28px", marginBottom: 20, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}
        >
          <div style={{ position: "absolute", right: -60, top: -60, width: 300, height: 300, background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 14%, transparent), transparent 65%)", pointerEvents: "none" }} />
          <span className="ex-form-icon" style={{ position: "relative", flex: "none", width: 62, height: 62, borderRadius: 18, background: "var(--lime-400)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--on-accent)" }}>
            <Video size={30} />
          </span>
          <div className="ex-form-text" style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <div className="cl-disp" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
              Check Your Form
            </div>
            <div className="ex-form-desc" style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 3 }}>
              Upload a training clip — AI pose analysis scores every rep, fully on-device.
            </div>
          </div>
          <button
            onClick={handleUploadClick}
            className="ex-form-btn"
            style={{
              position: "relative",
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "14px 26px",
              background: "var(--lime-400)",
              color: "var(--on-accent)",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              borderRadius: 13,
              cursor: "pointer",
              boxShadow: "var(--shadow-lime-sm)",
            }}
          >
            <Upload size={18} /> Upload Video
          </button>
        </div>

        {showFormCheck && (
          <div ref={formCheckRef} className="animate-fade-in-up" style={{ marginBottom: 20, scrollMarginTop: 20 }}>
            <FormCheckPanel onResult={() => setAnalysisVersion((version) => version + 1)} />
          </div>
        )}

        <div className="ex-cols2">
          {/* MAIN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <WeekStrip
              value={selectedDateObj}
              onChange={setSelectedDateObj}
              marked={(date) => workoutDateKeys.includes(getDateKey(date))}
            />

            <div className="cl-card" style={{ borderRadius: 18, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text-primary)" }}>{selectedLogTitle}</div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lime-600)" }}>
                  {todayWorkout.length} {todayWorkout.length === 1 ? "exercise" : "exercises"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {todayWorkout.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: 20 }}>
                    No exercises logged for this day. Add an exercise from the Muscle Library to log sets.
                  </p>
                )}
                {todayWorkout.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {todayWorkout.map((exercise, index) => {
                      const LogIcon = exerciseIconFor(exercise.name);
                      return (
                        <div
                          key={`${exercise.name}-${index}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "11px 14px",
                            background: "var(--surface-elevated)",
                            borderRadius: 11,
                          }}
                        >
                          {/* Muscle-group accent, mirroring the Diet journal rows */}
                          <span style={{ flex: "none", width: 4, height: 34, borderRadius: 99, background: "var(--accent)" }} />
                          {exercise.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={exercise.thumb} alt="" style={{ flex: "none", width: 36, height: 36, borderRadius: 9, objectFit: "cover" }} />
                          ) : (
                            <span
                              style={{
                                flex: "none",
                                width: 36,
                                height: 36,
                                borderRadius: 9,
                                background: "var(--surface-card)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--lime-600)",
                              }}
                            >
                              <LogIcon size={18} />
                            </span>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {exercise.name}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 1, textTransform: "capitalize" }}>
                              {[exercise.sets, exercise.weight !== "0lbs" ? exercise.weight : "", exercise.muscle].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <span
                            className="cl-mono"
                            style={{
                              flex: "none",
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: "3px 9px",
                              borderRadius: "var(--radius-full)",
                              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                              color: "var(--lime-600)",
                            }}
                          >
                            DONE
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* AI quick-log: type it or attach a short video */}
                <div style={{ padding: "12px 13px", borderRadius: 12, background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <input
                      value={quickText}
                      onChange={(e) => setQuickText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleQuickLog()}
                      placeholder='Log with AI — e.g. "bench press 4x8 60kg"'
                      style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 13.5, fontFamily: "inherit" }}
                    />
                    <label
                      title="Attach a workout video"
                      style={{ flex: "none", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border-color)", background: quickVideo ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-card)", color: quickVideo ? "var(--lime-400)" : "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      <Video size={14} />
                      <input
                        type="file"
                        accept="video/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          e.target.value = "";
                          if (f && f.size > MAX_VIDEO_BYTES) {
                            setQuickError("Video too large — please keep it under 15 MB.");
                            return;
                          }
                          setQuickError(null);
                          setQuickVideo(f);
                        }}
                      />
                    </label>
                    <button
                      onClick={handleQuickLog}
                      disabled={quickBusy || (!quickText.trim() && !quickVideo)}
                      aria-label="Log workout with AI"
                      style={{ flex: "none", width: 30, height: 30, borderRadius: 8, border: "none", background: quickSaved ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--lime-400)", color: quickSaved ? "var(--lime-400)" : "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: quickBusy || (!quickText.trim() && !quickVideo) ? 0.5 : 1 }}
                    >
                      {quickBusy ? <Loader2 size={14} className="animate-spin" /> : quickSaved ? <Check size={14} /> : <Send size={14} />}
                    </button>
                  </div>
                  {quickVideo && (
                    <div style={{ fontSize: 11.5, color: "var(--lime-600)", marginTop: 6 }}>
                      🎥 {quickVideo.name} attached
                    </div>
                  )}
                  {quickError && (
                    <div style={{ fontSize: 11.5, color: "var(--error)", marginTop: 6 }}>{quickError}</div>
                  )}
                </div>
                <Link
                  href="/exercise/library"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 12,
                    border: "1.5px dashed var(--border-color)",
                    borderRadius: 12,
                    color: "var(--lime-600)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={16} /> Add Exercise
                </Link>
              </div>
            </div>
            {/* Today's Plan — from the user's AI weekly split */}
            <div className="cl-card" style={{ borderRadius: 18, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: dayPlan ? 14 : 6, flexWrap: "wrap" }}>
                <div className="flex items-center" style={{ gap: 9 }}>
                  <Sparkles size={16} style={{ color: "var(--lime-400)" }} />
                  <span style={{ fontWeight: 600, fontSize: 16, color: "var(--text-primary)" }}>
                    {isSelectedToday ? "Today's Plan" : "Plan"}
                    {dayPlan ? ` · ${dayPlan.focus}` : ""}
                  </span>
                </div>
                <div className="flex items-center" style={{ gap: 12 }}>
                  {weeklyPlan && dayPlan && !planEditing && (
                    <button
                      onClick={() => {
                        setPlanDraft(dayPlan.items.map((i) => i.raw).join(" · "));
                        setPlanEditing(true);
                      }}
                      className="flex items-center"
                      style={{ gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      <Pencil size={12} /> Edit day
                    </button>
                  )}
                  <Link href="/profile/goals" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lime-600)" }}>
                    Change plan →
                  </Link>
                </div>
              </div>

              {!weeklyPlan ? (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  No plan yet — build yours in <Link href="/profile/goals" style={{ color: "var(--lime-600)", fontWeight: 600 }}>Edit TDEE &amp; Macros</Link>.
                </p>
              ) : !dayPlan ? (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Nothing scheduled for this day.</p>
              ) : planEditing ? (
                <div>
                  <textarea
                    value={planDraft}
                    onChange={(e) => setPlanDraft(e.target.value)}
                    rows={3}
                    className="cl-input"
                    style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.7, marginBottom: 10 }}
                    placeholder="Bench Press 4×8 · Overhead Press 3×10 · Lateral Raise 3×15"
                  />
                  <div className="flex" style={{ gap: 8 }}>
                    <button
                      onClick={handleSavePlanDay}
                      disabled={planSaving}
                      className="btn-primary flex items-center"
                      style={{ gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, opacity: planSaving ? 0.7 : 1 }}
                    >
                      {planSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save day
                    </button>
                    <button
                      onClick={() => setPlanEditing(false)}
                      className="btn-ghost"
                      style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13 }}
                    >
                      Cancel
                    </button>
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 8 }}>
                    Separate exercises with &quot;·&quot; and use sets×reps like &quot;4×8&quot;.
                  </p>
                </div>
              ) : dayPlan.isRest ? (
                <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, padding: "10px 12px", background: "var(--surface-elevated)", borderRadius: 11 }}>
                  {dayPlan.items.map((item) => item.raw).join(" · ") || "Rest & recovery day."}
                </div>
              ) : (
                <div className="plan-tiles" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                  {dayPlan.items.map((item) => {
                    const done = isPlanItemDone(item);
                    const busy = planBusy === item.raw;
                    const tickable = item.sets !== null && !done;
                    const ItemIcon = exerciseIconFor(item.name);
                    return (
                      <button
                        key={item.raw}
                        onClick={() => tickable && handleTickPlanItem(item)}
                        disabled={!tickable || busy}
                        style={{
                          position: "relative",
                          aspectRatio: "1 / 0.92",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                          padding: "12px 8px",
                          borderRadius: 14,
                          textAlign: "center",
                          background: done ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--surface-elevated)",
                          border: done ? "1.5px solid color-mix(in srgb, var(--accent) 40%, transparent)" : "1px solid var(--border-subtle)",
                          cursor: tickable ? "pointer" : "default",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            border: done ? "none" : "2px solid var(--border-color)",
                            background: done ? "var(--lime-400)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--on-accent)",
                          }}
                        >
                          {busy ? <Loader2 size={11} className="animate-spin" style={{ color: "var(--text-tertiary)" }} /> : done ? <Check size={12} /> : null}
                        </span>
                        <ItemIcon size={22} style={{ color: done ? "var(--lime-400)" : "var(--lime-600)" }} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, color: done ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: done ? "line-through" : "none", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {item.name}
                        </span>
                        {item.sets !== null && (
                          <span className="cl-mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                            {item.sets}×{item.reps}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT RAIL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Steps card — greyed out until the mobile app ships step counting */}
            <div className="cl-card" style={{ borderRadius: 18, padding: 20, cursor: "default", userSelect: "none" }} aria-disabled="true">
              <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: 0.45, filter: "grayscale(1)", pointerEvents: "none" }}>
                <svg width={stepRingSize} height={stepRingSize} viewBox={`0 0 ${stepRingSize} ${stepRingSize}`} style={{ flex: "none" }}>
                  <circle cx={stepRingSize / 2} cy={stepRingSize / 2} r={stepR} fill="none" stroke="var(--ring-track)" strokeWidth="8" />
                  <circle
                    cx={stepRingSize / 2}
                    cy={stepRingSize / 2}
                    r={stepR}
                    fill="none"
                    stroke="var(--info)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={stepCirc}
                    strokeDashoffset={stepDash}
                    transform={`rotate(-90 ${stepRingSize / 2} ${stepRingSize / 2})`}
                  />
                </svg>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--text-tertiary)", lineHeight: 1 }}>
                    {steps.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>/ {stepGoal.toLocaleString()} steps</div>
                  <div className="cl-mono" style={{ fontSize: 11.5, color: "var(--info)", marginTop: 3, fontWeight: 600 }}>
                    {formatKm(stepsToKm(stepGoal, heightCm))}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 14, fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                <Footprints size={13} style={{ flex: "none", marginTop: 1 }} />
                To count your steps, download our app — coming soon.
              </div>
            </div>

            {/* Muscle Library teaser */}
            <div className="cl-card cl-card-hover" style={{ position: "relative", overflow: "hidden", borderRadius: 18, padding: 22 }}>
              <div style={{ position: "absolute", right: -40, bottom: -40, width: 200, height: 200, background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent), transparent 65%)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div className="cl-disp" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--text-primary)" }}>
                    Muscle Library
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lime-600)" }}>
                    {libraryCounts ? libraryCounts.total.toLocaleString() : "—"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  Every exercise, by muscle group &amp; equipment.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 8, marginBottom: 16 }}>
                  {topGroups.length === 0 &&
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 11, padding: "10px 6px", textAlign: "center", minHeight: 48 }} />
                    ))}
                  {topGroups.map((group) => {
                    const MuscleIcon = muscleIconFor(group.muscle_group);
                    return (
                      <div key={group.muscle_group} style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 11, padding: "10px 6px", textAlign: "center" }}>
                        <MuscleIcon size={16} style={{ color: "var(--lime-600)", margin: "0 auto 4px", display: "block" }} />
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {capitalize(group.muscle_group)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Link
                  href="/exercise/library"
                  style={{
                    width: "100%",
                    padding: 12,
                    background: "var(--lime-400)",
                    color: "var(--on-accent)",
                    fontWeight: 700,
                    fontSize: 14,
                    border: "none",
                    borderRadius: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "var(--shadow-lime-sm)",
                  }}
                >
                  Open Library <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
