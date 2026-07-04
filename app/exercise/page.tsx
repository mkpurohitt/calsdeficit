"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "../../components/AppLayout";
import FormCheckPanel from "../../components/FormCheckPanel";
import { useAuth } from "../../lib/AuthContext";
import { getDateKey, getDateKeyDaysAgo, getDay, getFormAnalyses, getUserGoal, getWorkoutLogs } from "../../lib/user-data";
import { STEP_GOAL } from "../../lib/config/app";
import { ArrowRight, ChevronRight, Footprints, Plus, Upload, Video } from "lucide-react";

interface WorkoutDisplayItem {
  name: string;
  sets: string;
  weight: string;
  muscle: string;
}

interface LibraryCounts {
  total: number;
  groups: { muscle_group: string; count: number }[];
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function ExercisePage() {
  const { user } = useAuth() as { user: { uid?: string } | null };
  const formCheckRef = useRef<HTMLDivElement | null>(null);

  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [showFormCheck, setShowFormCheck] = useState(false);

  const [todayWorkout, setTodayWorkout] = useState<WorkoutDisplayItem[]>([]);
  const [formHistory, setFormHistory] = useState<{ exercise: string; date: string; score: number }[]>([]);
  const [workoutDaysThisWeek, setWorkoutDaysThisWeek] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(STEP_GOAL);
  const [libraryCounts, setLibraryCounts] = useState<LibraryCounts | null>(null);

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
        }))
      );

      setSteps(day?.steps || 0);
      setStepGoal(goal?.step_goal || STEP_GOAL);
    };

    loadUserData();
  }, [user, selectedDateKey, analysisVersion, today]);

  const handleUploadClick = () => {
    setShowFormCheck(true);
    setTimeout(() => {
      formCheckRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
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
        @media (max-width: 860px) { .ex-cols2 { grid-template-columns: 1fr; } }
      `}</style>
      <div style={{ padding: "30px 38px 48px", maxWidth: 1380, margin: "0 auto" }}>
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
            {/* Compact steps card */}
            <div className="cl-card" style={{ borderRadius: 18, padding: 20, display: "flex", alignItems: "center", gap: 18 }}>
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
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                  {steps.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>/ {stepGoal.toLocaleString()} steps</div>
                {steps > 0 ? (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>Google Health</div>
                ) : (
                  <Link href="/profile/google-fit" style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Footprints size={12} style={{ color: "var(--lime-400)" }} /> Connect Google Health
                  </Link>
                )}
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
                  {topGroups.map((group) => (
                    <div key={group.muscle_group} style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 11, padding: "10px 6px", textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {capitalize(group.muscle_group)}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{group.count}</div>
                    </div>
                  ))}
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
