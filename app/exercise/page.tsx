"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/AppLayout";
import FormCheckPanel from "../../components/FormCheckPanel";
import { useAuth } from "../../lib/AuthContext";
import { getDateKey, getDateKeyDaysAgo, getDay, getFormAnalyses, getWorkoutLogs, saveWorkoutLog } from "../../lib/user-data";
import { STEP_GOAL } from "../../lib/config/app";
import { CheckCircle, ChevronRight, Dumbbell, Footprints, Loader2, Plus, Search, Video } from "lucide-react";

interface ExerciseRecord {
  id: string;
  name: string;
  muscle_group: string;
  equipment?: string | null;
  gif_url?: string | null;
  body_part?: string | null;
  secondary_muscles?: string[];
  instructions?: string[];
}

interface WorkoutDisplayItem {
  name: string;
  sets: string;
  weight: string;
  muscle: string;
}

const muscleFilters = ["All", "Chest", "Back", "Legs", "Arms", "Shoulders", "Core"];
const muscleQueryMap: Record<string, string> = {
  Chest: "pectorals",
  Back: "lats",
  Legs: "quads",
  Arms: "biceps",
  Shoulders: "delts",
  Core: "abs",
};

export default function ExercisePage() {
  const router = useRouter();
  const { user } = useAuth() as { user: { uid?: string } | null };
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logForm, setLogForm] = useState({ sets: 3, reps: 10, weight_lbs: 0 });
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const [todayWorkout, setTodayWorkout] = useState<WorkoutDisplayItem[]>([]);
  const [formHistory, setFormHistory] = useState<{ exercise: string; date: string; score: number }[]>([]);
  const [workoutDaysThisWeek, setWorkoutDaysThisWeek] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [activeFilter, setActiveFilter] = useState("All");
  const [steps, setSteps] = useState(0);

  // Stable per-mount "today" so effects depending on it don't re-run every render
  const today = useMemo(() => new Date(), []);
  const selectedDate = new Date(today);
  selectedDate.setDate(today.getDate() - today.getDay() + selectedDay);
  const selectedDateKey = getDateKey(selectedDate);
  const isSelectedToday = selectedDay === today.getDay();
  const selectedLogTitle = isSelectedToday
    ? "Today's Log"
    : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const stepGoal = STEP_GOAL;
  const stepPercent = Math.min(steps / stepGoal, 1);
  const stepRingSize = 120;
  const stepR = (stepRingSize / 2) - 10;
  const stepCirc = 2 * Math.PI * stepR;
  const stepDash = stepCirc * (1 - stepPercent);

  const fetchExercises = async (queryValue: string, muscleFilter: string) => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (queryValue) params.append("query", queryValue);
      if (muscleFilter !== "All") params.append("muscle", muscleQueryMap[muscleFilter] || muscleFilter.toLowerCase());
      const res = await fetch(`/api/exercises?${params.toString()}`);
      const json = await res.json();
      if (json.success) setExercises(json.data || []);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchExercises("", activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    if (!user?.uid) return;
    const userId = user.uid;

    const loadUserData = async () => {
      const [logs, analyses, day] = await Promise.all([
        getWorkoutLogs(userId, { from: getDateKeyDaysAgo(7), to: getDateKey() }),
        getFormAnalyses(userId),
        getDay(userId, getDateKey()),
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
    };

    loadUserData();
  }, [user, selectedDateKey, logSuccess, analysisVersion, today]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchExercises(value, activeFilter), 300);
  };

  const handleLogSet = async (exercise: ExerciseRecord) => {
    if (!user?.uid) return;
    setIsLogging(true);
    setLogError(null);

    try {
      await saveWorkoutLog({
        user_id: user.uid,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        muscle_group: exercise.muscle_group,
        sets: Number(logForm.sets) || 0,
        reps: Number(logForm.reps) || 0,
        weight_lbs: Number(logForm.weight_lbs) || 0,
        date_key: selectedDateKey,
        logged_at: new Date().toISOString(),
      });

      setLogSuccess(exercise.name);
      setExpandedId(null);
      setTimeout(() => setLogSuccess(null), 2500);
      setSelectedDay(new Date().getDay());
    } catch (err: unknown) {
      setLogError(err instanceof Error ? err.message : "Could not log this set.");
    } finally {
      setIsLogging(false);
    }
  };

  const weekNumber = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 1);
    const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
    return Math.ceil((diffDays + start.getDay() + 1) / 7);
  }, [today]);

  return (
    <AppLayout>
      <style>{`
        .ex-cols3 { display: grid; grid-template-columns: 340px minmax(0,1fr) 336px; gap: 20px; align-items: start; }
        @media (max-width: 1180px) { .ex-cols3 { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 860px) { .ex-cols3 { grid-template-columns: 1fr; } }
      `}</style>
      <div style={{ padding: "30px 38px 48px", maxWidth: 1380, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <div className="cl-mono" style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 7 }}>
              TRAINING · WEEK {weekNumber}
            </div>
            <h1 className="cl-disp" style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Exercise
            </h1>
          </div>
          <button
            onClick={() => router.push("/?mode=gym")}
            className="flex items-center gap-2"
            style={{
              padding: "12px 20px",
              borderRadius: "var(--radius-md)",
              background: "var(--lime-400)",
              color: "#0A0C0F",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              boxShadow: "var(--shadow-lime-sm)",
            }}
          >
            <Video size={18} /> Check Form
          </button>
        </div>

        <div className="ex-cols3">
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="cl-card" style={{ borderRadius: 18, padding: 24, textAlign: "center" }}>
              <div style={{ position: "relative", width: stepRingSize, height: stepRingSize, margin: "0 auto 8px" }}>
                <svg width={stepRingSize} height={stepRingSize} viewBox={`0 0 ${stepRingSize} ${stepRingSize}`}>
                  <circle cx={stepRingSize / 2} cy={stepRingSize / 2} r={stepR} fill="none" stroke="var(--ring-track)" strokeWidth="11" />
                  <circle
                    cx={stepRingSize / 2}
                    cy={stepRingSize / 2}
                    r={stepR}
                    fill="none"
                    stroke="var(--info)"
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={stepCirc}
                    strokeDashoffset={stepDash}
                    transform={`rotate(-90 ${stepRingSize / 2} ${stepRingSize / 2})`}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, color: "var(--text-primary)" }}>
                    {steps.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>/ {stepGoal.toLocaleString()} steps</span>
                </div>
              </div>
              <Link href="/profile/google-fit" style={{ fontSize: 12, color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Footprints size={13} style={{ color: "var(--lime-400)" }} /> Connect Google Health to sync steps
              </Link>
            </div>

            <FormCheckPanel onResult={() => setAnalysisVersion((version) => version + 1)} />
          </div>

          {/* CENTER */}
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
                    No exercises logged for this day. Use the Muscle Library to log sets.
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

          {/* RIGHT: Muscle Library */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {logSuccess && (
              <div className="animate-fade-in-up" style={{ padding: "10px 16px", borderRadius: "var(--radius-md)", background: "rgba(170, 255, 0, 0.12)", border: "1px solid rgba(170, 255, 0, 0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={16} style={{ color: "var(--lime-400)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--lime-400)" }}>Logged {logSuccess}!</span>
              </div>
            )}

            {logError && (
              <div className="animate-fade-in-up" style={{ padding: "10px 16px", borderRadius: "var(--radius-md)", background: "rgba(255, 77, 77, 0.1)", border: "1px solid rgba(255, 77, 77, 0.3)", color: "var(--error)", fontSize: 13, fontWeight: 600 }}>
                {logError}
              </div>
            )}

            <div className="cl-card" style={{ borderRadius: 18, padding: 20 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Muscle Library</h3>
                {exercises.length > 0 && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{exercises.length} shown</span>
                )}
              </div>

              <div style={{ position: "relative", marginBottom: 12 }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="cl-input"
                  style={{ fontSize: 13, paddingLeft: 36 }}
                />
                {isSearching && (
                  <Loader2 size={16} className="animate-spin" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--lime-400)" }} />
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {muscleFilters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setActiveFilter(filter);
                      fetchExercises(searchQuery, filter);
                    }}
                    style={{
                      padding: "6px 13px",
                      borderRadius: "var(--radius-full)",
                      fontSize: 12,
                      fontWeight: 600,
                      background: activeFilter === filter ? "var(--lime-400)" : "var(--surface-elevated)",
                      color: activeFilter === filter ? "#0A0C0F" : "var(--text-secondary)",
                      border: activeFilter === filter ? "1px solid var(--lime-400)" : "1px solid var(--border-subtle)",
                      cursor: "pointer",
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="space-y-2" style={{ maxHeight: 540, overflowY: "auto" }}>
                {exercises.length === 0 && !isSearching && (
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: 20 }}>
                    No exercises found. Try a different search.
                  </p>
                )}

                {exercises.map((exercise) => (
                  <div key={exercise.id} className="animate-fade-in-up">
                    <div
                      className="card-hover flex items-center gap-3"
                      onClick={() => {
                        setExpandedId(expandedId === exercise.id ? null : exercise.id);
                        setLogForm({ sets: 3, reps: 10, weight_lbs: 0 });
                      }}
                      style={{
                        padding: 12,
                        borderRadius: "var(--radius-md)",
                        background: expandedId === exercise.id ? "var(--surface-hover)" : "var(--surface-elevated)",
                        border: expandedId === exercise.id ? "1px solid rgba(170, 255, 0, 0.3)" : "1px solid var(--border-subtle)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ width: 56, height: 56, borderRadius: "var(--radius-sm)", background: "var(--surface-card)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {exercise.gif_url && !imgErrors[exercise.id] ? (
                          <img
                            src={exercise.gif_url}
                            alt={exercise.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={() => setImgErrors((prev) => ({ ...prev, [exercise.id]: true }))}
                            loading="lazy"
                          />
                        ) : (
                          <Dumbbell size={20} style={{ color: "var(--text-tertiary)" }} />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {exercise.name}
                        </p>
                        <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "var(--radius-sm)", background: "rgba(170, 255, 0, 0.1)", color: "var(--lime-400)", fontWeight: 500, textTransform: "capitalize" }}>
                            {exercise.muscle_group}
                          </span>
                          {exercise.equipment && (
                            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "var(--radius-sm)", background: "var(--surface-card)", color: "var(--text-tertiary)", fontWeight: 500, textTransform: "capitalize" }}>
                              {exercise.equipment}
                            </span>
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/exercise/${exercise.id}`}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Open ${exercise.name}`}
                        className="btn-icon"
                        style={{ width: 30, height: 30, border: "none", background: "var(--surface-card)" }}
                      >
                        <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                      </Link>
                    </div>

                    {expandedId === exercise.id && (
                      <div className="animate-fade-in-up" style={{ padding: 14, marginTop: 4, borderRadius: "var(--radius-md)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)" }}>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div>
                            <label style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, display: "block", marginBottom: 4 }}>Sets</label>
                            <input type="number" value={logForm.sets} min={1} onChange={(event) => setLogForm({ ...logForm, sets: Number(event.target.value) })} className="cl-input" style={{ fontSize: 14, padding: "8px 10px", textAlign: "center", fontFamily: "var(--font-mono)" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, display: "block", marginBottom: 4 }}>Reps</label>
                            <input type="number" value={logForm.reps} min={1} onChange={(event) => setLogForm({ ...logForm, reps: Number(event.target.value) })} className="cl-input" style={{ fontSize: 14, padding: "8px 10px", textAlign: "center", fontFamily: "var(--font-mono)" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, display: "block", marginBottom: 4 }}>Weight (lbs)</label>
                            <input type="number" value={logForm.weight_lbs} min={0} onChange={(event) => setLogForm({ ...logForm, weight_lbs: Number(event.target.value) })} className="cl-input" style={{ fontSize: 14, padding: "8px 10px", textAlign: "center", fontFamily: "var(--font-mono)" }} />
                          </div>
                        </div>
                        <button onClick={(event) => { event.stopPropagation(); handleLogSet(exercise); }} disabled={isLogging} className="btn-primary w-full flex items-center justify-center gap-2" style={{ height: 38, fontSize: 13, opacity: isLogging ? 0.6 : 1 }}>
                          {isLogging ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          {isLogging ? "Logging..." : "Log Set"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
