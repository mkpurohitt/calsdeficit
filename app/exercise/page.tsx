"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "../../components/AppLayout";
import FormCheckPanel from "../../components/FormCheckPanel";
import { useAuth } from "../../lib/AuthContext";
import { getDateKey, getDateKeyDaysAgo, getDay, getFormAnalyses, getUserGoal, getWorkoutLogs, saveWorkoutLog } from "../../lib/user-data";
import { apiFetch } from "../../lib/api-client";
import { makeVideoThumb, MAX_VIDEO_BYTES, fileToBase64 } from "../../lib/image-compress";
import { STEP_GOAL } from "../../lib/config/app";
import { ArrowRight, BicepsFlexed, Check, ChevronRight, Dumbbell, Footprints, Grip, Loader2, Plus, Send, Shield, Sparkles, Target, Upload, Video, Zap } from "lucide-react";
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
    const m = seg.match(/^(.*?)\s+(\d+)\s*[x×]\s*(\d+)\s*(?:[a-z]*)?$/i);
    if (m) return { raw: seg, name: m[1].trim(), sets: parseInt(m[2], 10), reps: parseInt(m[3], 10) };
    return { raw: seg, name: seg, sets: null, reps: null };
  });

  const hasSets = items.some((item) => item.sets !== null);
  const isRest = !hasSets || /\b(rest|recovery|cardio|walk|stretch)\b/i.test(focus);
  return { focus, items, isRest: isRest && !hasSets };
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
  const [formHistory, setFormHistory] = useState<{ exercise: string; date: string; score: number; thumb?: string }[]>([]);
  const [workoutDaysThisWeek, setWorkoutDaysThisWeek] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(STEP_GOAL);
  const [libraryCounts, setLibraryCounts] = useState<LibraryCounts | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<string>("");
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  // AI quick-log
  const [quickText, setQuickText] = useState("");
  const [quickVideo, setQuickVideo] = useState<File | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickSaved, setQuickSaved] = useState(false);

  // Stable per-mount "today" so effects depending on it don't re-run every render
  const today = useMemo(() => new Date(), []);
  const selectedDate = new Date(today);
  selectedDate.setDate(today.getDate() - today.getDay() + selectedDay);
  const selectedDateKey = getDateKey(selectedDate);
  const isSelectedToday = selectedDay === today.getDay();
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
      const [logs, analyses, day, goal] = await Promise.all([
        getWorkoutLogs(userId, { from: getDateKeyDaysAgo(7), to: getDateKey() }),
        getFormAnalyses(userId),
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

      const weekKeys = Array.from({ length: 7 }).map((_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - today.getDay() + index);
        return getDateKey(date);
      });

      setWorkoutDaysThisWeek([
        ...new Set(
          logs
            .filter((log) => weekKeys.includes(log.date_key))
            .map((log) => new Date(log.logged_at).getDay())
        ),
      ]);

      setFormHistory(
        analyses.slice(0, 5).map((record) => ({
          exercise: record.exercise_name,
          date: new Date(record.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          score: Math.round(record.score / 10),
          thumb: record.thumb,
        }))
      );

      setSteps(day?.steps || 0);
      setStepGoal(goal?.step_goal || STEP_GOAL);
      setWeeklyPlan(goal?.weekly_plan || "");
    };

    loadUserData();
  }, [user, selectedDateKey, analysisVersion, today]);

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
          .ex-cols2 { grid-template-columns: 1fr; }
          .ex-wrap { padding: 20px 16px 40px !important; }
        }
      `}</style>
      <div className="ex-wrap" style={{ padding: "30px 38px 48px", maxWidth: 1380, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div className="cl-mono" style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 7 }}>
            TRAINING · WEEK {weekNumber}
          </div>
          <h1 className="cl-disp" style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Exercise
          </h1>
        </div>

        {/* Check Your Form hero */}
        <div
          className="cl-card"
          style={{ position: "relative", overflow: "hidden", borderRadius: 20, padding: "26px 28px", marginBottom: 20, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}
        >
          <div style={{ position: "absolute", right: -60, top: -60, width: 300, height: 300, background: "radial-gradient(circle, rgba(170, 255, 0, 0.14), transparent 65%)", pointerEvents: "none" }} />
          <span style={{ position: "relative", flex: "none", width: 62, height: 62, borderRadius: 18, background: "var(--lime-400)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0C0F" }}>
            <Video size={30} />
          </span>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <div className="cl-disp" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
              Check Your Form
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 3 }}>
              Upload a training clip — AI pose analysis scores every rep, fully on-device.
            </div>
          </div>
          <button
            onClick={handleUploadClick}
            style={{
              position: "relative",
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "14px 26px",
              background: "var(--lime-400)",
              color: "#0A0C0F",
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
            <div className="cl-card" style={{ borderRadius: 16, padding: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => {
                  const date = new Date(today);
                  date.setDate(today.getDate() - today.getDay() + index);
                  const isToday = index === today.getDay();
                  const isActive = selectedDay === index;
                  const hasWorkout = workoutDaysThisWeek.includes(index);

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(index)}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        padding: "11px 0",
                        borderRadius: 11,
                        cursor: "pointer",
                        border: "none",
                        background: isActive ? (isToday ? "var(--lime-400)" : "var(--surface-elevated)") : "transparent",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 500, color: isActive && isToday ? "#0A0C0F" : "var(--text-tertiary)" }}>{day}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, marginTop: 3, color: isActive && isToday ? "#0A0C0F" : "var(--text-primary)" }}>
                        {date.getDate()}
                      </div>
                      {hasWorkout && (
                        <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", marginTop: 3, background: isActive && isToday ? "#0A0C0F" : "var(--lime-400)" }} />
                      )}
                    </button>
                  );
                })}
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
                <Link href="/profile/goals" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lime-600)" }}>
                  Change plan →
                </Link>
              </div>

              {!weeklyPlan ? (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  No plan yet — build yours in <Link href="/profile/goals" style={{ color: "var(--lime-600)", fontWeight: 600 }}>Edit TDEE &amp; Macros</Link>.
                </p>
              ) : !dayPlan ? (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Nothing scheduled for this day.</p>
              ) : dayPlan.isRest ? (
                <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, padding: "10px 12px", background: "var(--surface-elevated)", borderRadius: 11 }}>
                  {dayPlan.items.map((item) => item.raw).join(" · ") || "Rest & recovery day."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dayPlan.items.map((item) => {
                    const done = isPlanItemDone(item);
                    const busy = planBusy === item.raw;
                    const tickable = item.sets !== null && !done;
                    return (
                      <button
                        key={item.raw}
                        onClick={() => tickable && handleTickPlanItem(item)}
                        disabled={!tickable || busy}
                        className="flex items-center"
                        style={{
                          gap: 12,
                          padding: "11px 13px",
                          borderRadius: 11,
                          textAlign: "left",
                          background: done ? "rgba(170,255,0,0.07)" : "var(--surface-elevated)",
                          border: done ? "1px solid rgba(170,255,0,0.3)" : "1px solid var(--border-subtle)",
                          cursor: tickable ? "pointer" : "default",
                        }}
                      >
                        <span
                          style={{
                            flex: "none",
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            border: done ? "none" : "2px solid var(--border-color)",
                            background: done ? "var(--lime-400)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#0A0C0F",
                          }}
                        >
                          {busy ? <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-tertiary)" }} /> : done ? <Check size={13} /> : null}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: done ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: done ? "line-through" : "none" }}>
                            {item.name}
                          </span>
                          {item.sets !== null && (
                            <span className="cl-mono" style={{ display: "block", fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1 }}>
                              {item.sets}×{item.reps}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

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
                {todayWorkout.map((exercise, index) => (
                  <div key={`${exercise.name}-${index}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "var(--surface-elevated)", borderRadius: 12 }}>
                    {exercise.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={exercise.thumb} alt="" style={{ flex: "none", width: 36, height: 36, borderRadius: 9, objectFit: "cover" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{exercise.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, textTransform: "capitalize" }}>
                        {[exercise.muscle, exercise.sets, exercise.weight].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: "var(--radius-full)", background: "rgba(170, 255, 0, 0.12)", color: "var(--lime-600)" }}>
                      Done
                    </span>
                  </div>
                ))}

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
                      style={{ flex: "none", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border-color)", background: quickVideo ? "rgba(170,255,0,0.12)" : "var(--surface-card)", color: quickVideo ? "var(--lime-400)" : "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
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
                      style={{ flex: "none", width: 30, height: 30, borderRadius: 8, border: "none", background: quickSaved ? "rgba(170,255,0,0.15)" : "var(--lime-400)", color: quickSaved ? "var(--lime-400)" : "#0A0C0F", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: quickBusy || (!quickText.trim() && !quickVideo) ? 0.5 : 1 }}
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

            <div className="cl-card" style={{ borderRadius: 18, padding: 22 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text-primary)", marginBottom: 14 }}>Past Form Checks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {formHistory.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: 20 }}>
                    No form analyses yet. Upload a video to get started.
                  </p>
                )}
                {formHistory.map((item, index) => (
                  <div key={`${item.exercise}-${index}`} className="cl-card-hover" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 14px", background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
                    <span style={{ flex: "none", width: 44, height: 44, borderRadius: 11, background: item.score >= 8 ? "rgba(170, 255, 0, 0.12)" : "rgba(255, 184, 0, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, color: item.score >= 8 ? "var(--lime-600)" : "var(--warning)" }}>{item.score}</span>
                    </span>
                    {item.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumb} alt="" style={{ flex: "none", width: 36, height: 36, borderRadius: 9, objectFit: "cover" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{item.exercise}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 1 }}>{item.date} · score {item.score}/10</div>
                    </div>
                    <ChevronRight size={18} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                  </div>
                ))}
              </div>
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
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 14, fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                <Footprints size={13} style={{ flex: "none", marginTop: 1 }} />
                To count your steps, download our app — coming soon.
              </div>
            </div>

            {/* Muscle Library teaser */}
            <div className="cl-card cl-card-hover" style={{ position: "relative", overflow: "hidden", borderRadius: 18, padding: 22 }}>
              <div style={{ position: "absolute", right: -40, bottom: -40, width: 200, height: 200, background: "radial-gradient(circle, rgba(170, 255, 0, 0.12), transparent 65%)", pointerEvents: "none" }} />
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
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
                    color: "#0A0C0F",
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
