"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/AppLayout";
import { useAuth } from "../../lib/AuthContext";
import { getDateKey, getFormAnalyses, getStepSync, getWorkoutLogs, saveFormAnalysis, saveWorkoutLog } from "../../lib/user-data";
import { Camera, CheckCircle, ChevronRight, Dumbbell, Flame, Footprints, Loader2, Plus, Search, Timer, Video } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{ exercise_name?: string; score?: number; feedback?: { positive?: string; improvement?: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const today = new Date();
  const selectedDate = new Date(today);
  selectedDate.setDate(today.getDate() - today.getDay() + selectedDay);
  const selectedDateKey = getDateKey(selectedDate);
  const isSelectedToday = selectedDay === today.getDay();
  const selectedLogTitle = isSelectedToday
    ? "Today's Log"
    : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const stepGoal = 8000;
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
      const [logs, analyses, stepSync] = await Promise.all([
        getWorkoutLogs(userId),
        getFormAnalyses(userId),
        getStepSync(userId, getDateKey()),
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

      setSteps(stepSync?.steps || 0);
    };

    loadUserData();
  }, [user, selectedDateKey, logSuccess, result, today]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchExercises(value, activeFilter), 300);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", user?.uid || "guest");

    try {
      const res = await fetch("http://localhost:8000/analyze-form", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Analysis failed. Make sure the Python server is running.");

      const data = await res.json();
      setResult(data);

      if (user?.uid) {
        await saveFormAnalysis({
          user_id: user.uid,
          exercise_name: data.exercise_name || "Exercise",
          score: Number(data.score) || 0,
          created_at: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
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

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
              Exercise
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>
              {todayWorkout.length > 0
                ? `${todayWorkout.length} exercises logged ${isSelectedToday ? "today" : "on selected day"}`
                : isSelectedToday ? "No exercises logged yet today" : "No exercises logged for this day"}
            </p>
          </div>
          <button
            onClick={() => router.push("/?mode=gym")}
            className="flex items-center gap-2"
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius-full)",
              background: "var(--lime-400)",
              color: "#0A0C0F",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              boxShadow: "var(--shadow-lime-sm)",
            }}
          >
            <Video size={16} /> Check Form
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="cl-card" style={{ borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ position: "relative", width: stepRingSize, height: stepRingSize, marginBottom: 12 }}>
                <svg width={stepRingSize} height={stepRingSize} viewBox={`0 0 ${stepRingSize} ${stepRingSize}`}>
                  <circle cx={stepRingSize / 2} cy={stepRingSize / 2} r={stepR} fill="none" stroke="var(--surface-elevated)" strokeWidth="8" />
                  <circle
                    cx={stepRingSize / 2}
                    cy={stepRingSize / 2}
                    r={stepR}
                    fill="none"
                    stroke="var(--lime-400)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={stepCirc}
                    strokeDashoffset={stepDash}
                    transform={`rotate(-90 ${stepRingSize / 2} ${stepRingSize / 2})`}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <Footprints size={16} style={{ color: "var(--lime-400)", marginBottom: 2 }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--lime-400)" }}>
                    {steps.toLocaleString()}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {steps.toLocaleString()} / {stepGoal.toLocaleString()} steps
              </p>
              <Link href="/profile/google-fit" style={{ fontSize: 11, color: "var(--lime-400)", marginTop: 4 }}>
                Connect Google Fit or enter steps
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="cl-card" style={{ borderRadius: 16, padding: 16 }}>
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ padding: 6, borderRadius: "var(--radius-sm)", background: "rgba(255, 184, 0, 0.15)" }}>
                    <Flame size={16} style={{ color: "var(--warning)" }} />
                  </div>
                </div>
                <p className="card-stat__label">Exercises</p>
                <p className="card-stat__value" style={{ fontSize: 22 }}>{todayWorkout.length}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>selected day</p>
              </div>
              <div className="cl-card" style={{ borderRadius: 16, padding: 16 }}>
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ padding: 6, borderRadius: "var(--radius-sm)", background: "rgba(77, 158, 255, 0.15)" }}>
                    <Timer size={16} style={{ color: "var(--info)" }} />
                  </div>
                </div>
                <p className="card-stat__label">Form Checks</p>
                <p className="card-stat__value" style={{ fontSize: 22 }}>{formHistory.length}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>recent</p>
              </div>
            </div>

            <div className="cl-card-accent flex flex-col" style={{ borderRadius: 20, padding: 24 }}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>Check Your Form</h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Upload a video for AI analysis</p>
                </div>
                {result && (
                  <div style={{
                    padding: "4px 10px",
                    borderRadius: "100px",
                    fontSize: 13,
                    fontWeight: 700,
                    background: "rgba(170, 255, 0, 0.12)",
                    color: "var(--lime-400)",
                  }}>
                    {result.score}/100
                  </div>
                )}
              </div>

              {!result && !isAnalyzing && (
                <>
                  <input type="file" accept="video/*" className="hidden" ref={fileInputRef} onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  <div
                    className="flex flex-col items-center justify-center gap-2"
                    style={{
                      height: 140,
                      borderRadius: "var(--radius-lg)",
                      border: "2px dashed var(--border-color)",
                      background: "var(--surface-card)",
                      cursor: "pointer",
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={28} style={{ color: "var(--lime-400)" }} />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "0 10px" }}>
                      {file ? file.name : "Drop video or click to upload"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>MP4, MOV up to 50MB</span>
                  </div>
                  <button onClick={handleAnalyze} disabled={!file} className="btn-primary w-full mt-4" style={{ height: 44, fontSize: 14, opacity: !file ? 0.5 : 1 }}>
                    Analyse Form
                  </button>
                  {error && <p style={{ color: "var(--error)", fontSize: 12, marginTop: 10, textAlign: "center" }}>{error}</p>}
                </>
              )}

              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center gap-4 py-8" style={{ border: "2px dashed var(--border-color)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)" }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: "var(--lime-400)" }} />
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5 }}>
                    Analyzing biomechanics...
                  </p>
                </div>
              )}

              {result && !isAnalyzing && (
                <div style={{ background: "var(--surface-elevated)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
                    {result.exercise_name || "Exercise"} Analysis
                  </span>
                  <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, marginTop: 12 }}>
                    {result.feedback?.positive}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 10 }}>
                    {result.feedback?.improvement}
                  </p>
                  <button
                    onClick={() => {
                      setResult(null);
                      setFile(null);
                    }}
                    className="w-full mt-5"
                    style={{ fontSize: 13, color: "var(--lime-400)", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontWeight: 600 }}
                  >
                    Upload Another Video
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="cl-card" style={{ borderRadius: 20, padding: 20 }}>
              <div className="flex justify-between gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => {
                  const date = new Date(today);
                  date.setDate(today.getDate() - today.getDay() + index);
                  const isToday = index === today.getDay();
                  const hasWorkout = workoutDaysThisWeek.includes(index);

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(index)}
                      className="flex flex-col items-center gap-1 flex-1 py-2"
                      style={{
                        borderRadius: "var(--radius-md)",
                        background: selectedDay === index ? (isToday ? "var(--lime-400)" : "var(--surface-elevated)") : "transparent",
                        color: selectedDay === index && isToday ? "#0A0C0F" : "var(--text-primary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 11, color: selectedDay === index && isToday ? "#0A0C0F" : "var(--text-tertiary)", fontWeight: 500 }}>{day}</span>
                      <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{date.getDate()}</span>
                      {hasWorkout && (
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: selectedDay === index && isToday ? "#0A0C0F" : "var(--lime-400)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>{selectedLogTitle}</h3>
              <div className="space-y-2">
                {todayWorkout.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: 20 }}>
                    No exercises logged for this day. Use the Muscle Library to log sets.
                  </p>
                )}
                {todayWorkout.map((exercise, index) => (
                  <div key={`${exercise.name}-${index}`} className="cl-card flex items-center justify-between card-hover" style={{ borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
                    <div className="flex items-center gap-3">
                      <div style={{ width: 28, height: 28, borderRadius: "var(--radius-full)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--lime-400)" }}>
                        <CheckCircle size={16} color="#0A0C0F" />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{exercise.name}</p>
                        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{exercise.sets}</span>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>-</span>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{exercise.weight}</span>
                          {exercise.muscle && (
                            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "var(--radius-sm)", background: "rgba(170, 255, 0, 0.1)", color: "var(--lime-400)", fontWeight: 500, textTransform: "capitalize" }}>
                              {exercise.muscle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--lime-400)" }}>Done</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Past Form Checks</h3>
              <div className="space-y-2">
                {formHistory.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: 20 }}>
                    No form analyses yet. Upload a video to get started.
                  </p>
                )}
                {formHistory.map((item, index) => (
                  <div key={`${item.exercise}-${index}`} className="cl-card flex items-center justify-between card-hover" style={{ borderRadius: "var(--radius-lg)", padding: "12px 16px" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.exercise}</p>
                      <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{item.date}</p>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: item.score >= 8 ? "var(--lime-400)" : "var(--warning)" }}>
                      {item.score}/10
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
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

            <div className="cl-card" style={{ borderRadius: 20, padding: 24 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Muscle Library</h3>
                <Dumbbell size={18} style={{ color: "var(--lime-400)" }} />
              </div>

              <div style={{ position: "relative", marginBottom: 12 }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <input
                  type="text"
                  placeholder="Search 1,300+ exercises..."
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
                      padding: "6px 14px",
                      borderRadius: "var(--radius-full)",
                      fontSize: 12,
                      fontWeight: 600,
                      background: activeFilter === filter ? "var(--lime-400)" : "var(--surface-elevated)",
                      color: activeFilter === filter ? "#0A0C0F" : "var(--text-secondary)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="space-y-2" style={{ maxHeight: 480, overflowY: "auto" }}>
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
