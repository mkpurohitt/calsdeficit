"use client";
import { useState, useRef } from "react";
import AppLayout from "../../components/AppLayout";
import { PlayCircle, Footprints, Flame, Timer, Video, Camera, Plus, ChevronRight, CheckCircle, Clock, Upload, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";

export default function ExercisePage() {
  const router = useRouter();
  
  const { user } = useAuth() as { user: any };

  // Form check state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
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

      if (!res.ok) throw new Error("Analysis failed. Make sure the Python server is running!");
      
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const steps = 6430;
  const stepGoal = 8000;
  const stepPercent = Math.min(steps / stepGoal, 1);
  const stepRingSize = 120;
  const stepR = (stepRingSize / 2) - 10;
  const stepCirc = 2 * Math.PI * stepR;
  const stepDash = stepCirc * (1 - stepPercent);
  
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());

  const todayWorkout = [
    { name: "Barbell Squats", sets: "4 × 8-10", weight: "80kg", muscle: "Legs", completed: true },
    { name: "Leg Press", sets: "3 × 10-12", weight: "120kg", muscle: "Legs", completed: false },
    { name: "Romanian Deadlifts", sets: "3 × 10", weight: "60kg", muscle: "Hamstrings", completed: false },
    { name: "Calf Raises", sets: "4 × 15", weight: "40kg", muscle: "Calves", completed: false },
  ];

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const workoutDays = [1, 2, 3, 5, 6]; // Mon, Tue, Wed, Fri, Sat

  const formHistory = [
    { exercise: "Barbell Squat", date: "Apr 4", score: 8 },
    { exercise: "Deadlift", date: "Apr 2", score: 7 },
    { exercise: "Bench Press", date: "Mar 30", score: 9 },
  ];

  const muscleFilters = ["All", "Chest", "Back", "Legs", "Arms", "Shoulders", "Core"];
  const [activeFilter, setActiveFilter] = useState("All");

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
              Leg Day 🦵
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>
              45 mins · Hypertrophy
            </p>
          </div>
          <button
            onClick={() => router.push('/?mode=gym')}
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

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left Column: Steps + Form Check ── */}
          <div className="space-y-6">
            {/* Step Counter */}
            <div className="cl-card" style={{ borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ position: "relative", width: stepRingSize, height: stepRingSize, marginBottom: 12 }}>
                <svg width={stepRingSize} height={stepRingSize} viewBox={`0 0 ${stepRingSize} ${stepRingSize}`}>
                  <circle cx={stepRingSize/2} cy={stepRingSize/2} r={stepR} fill="none" stroke="var(--surface-elevated)" strokeWidth="8" />
                  <circle
                    cx={stepRingSize/2} cy={stepRingSize/2} r={stepR}
                    fill="none" stroke="var(--lime-400)" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={stepCirc}
                    strokeDashoffset={stepDash}
                    transform={`rotate(-90 ${stepRingSize/2} ${stepRingSize/2})`}
                    style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
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
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                synced from Google Fit
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="cl-card" style={{ borderRadius: 16, padding: 16 }}>
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ padding: 6, borderRadius: "var(--radius-sm)", background: "rgba(255, 184, 0, 0.15)" }}>
                    <Flame size={16} style={{ color: "var(--warning)" }} />
                  </div>
                </div>
                <p className="card-stat__label">Active Burn</p>
                <p className="card-stat__value" style={{ fontSize: 22 }}>420</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>kcal</p>
              </div>
              <div className="cl-card" style={{ borderRadius: 16, padding: 16 }}>
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ padding: 6, borderRadius: "var(--radius-sm)", background: "rgba(77, 158, 255, 0.15)" }}>
                    <Timer size={16} style={{ color: "var(--info)" }} />
                  </div>
                </div>
                <p className="card-stat__label">Active Time</p>
                <p className="card-stat__value" style={{ fontSize: 22 }}>52</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>min</p>
              </div>
            </div>

            {/* Form Check Card */}
            <div className="cl-card-accent flex flex-col" style={{ borderRadius: 20, padding: 24 }}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>Check Your Form</h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Upload a video for AI analysis</p>
                </div>
                {result && (
                  <div style={{ 
                    padding: "4px 10px", borderRadius: "100px", fontSize: 13, fontWeight: 700,
                    background: result.score >= 80 ? "rgba(34, 197, 94, 0.15)" : result.score >= 60 ? "rgba(234, 179, 8, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: result.score >= 80 ? "#22c55e" : result.score >= 60 ? "#eab308" : "#ef4444" 
                  }}>
                    {result.score}/100
                  </div>
                )}
              </div>
              
              {!result && !isAnalyzing && (
                <>
                  <input type="file" accept="video/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                  <div
                    className="flex flex-col items-center justify-center gap-2"
                    style={{
                      height: 140, borderRadius: "var(--radius-lg)", border: "2px dashed var(--border-color)",
                      background: "var(--surface-card)", cursor: "pointer", transition: "all 0.2s"
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={28} style={{ color: "var(--lime-400)" }} />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "0 10px" }}>
                      {file ? file.name : "Drop video or click to upload"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>MP4, MOV up to 50MB</span>
                  </div>
                  <button
                    onClick={handleAnalyze} disabled={!file} className="btn-primary w-full mt-4"
                    style={{ height: 44, fontSize: 14, opacity: !file ? 0.5 : 1 }}
                  >
                    Analyse Form
                  </button>
                  {error && <p style={{ color: "var(--error, #ef4444)", fontSize: 12, marginTop: 10, textAlign: "center" }}>{error}</p>}
                </>
              )}

              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center gap-4 py-8" style={{ border: "2px dashed var(--border-color)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)" }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: "var(--lime-400)" }} />
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5 }}>
                    Analyzing biomechanics...<br/>this takes about 10-15 seconds.
                  </p>
                </div>
              )}

              {result && !isAnalyzing && (
                <div style={{ background: "var(--surface-elevated)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-center gap-2 mb-3">
                     <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>{result.exercise_name || "Squat"} Analysis</span>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-start gap-2">
                       <CheckCircle size={16} color="#22c55e" className="mt-0.5 shrink-0" />
                       <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{result.feedback?.positive}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-start gap-2">
                       <Flame size={16} color="#eab308" className="mt-0.5 shrink-0" />
                       <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{result.feedback?.improvement}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setResult(null); setFile(null); }}
                    className="w-full mt-5"
                    style={{ fontSize: 13, color: "var(--lime-400)", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontWeight: 600 }}
                  >
                    Upload Another Video
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Center Column: Calendar + Workout Log ── */}
          <div className="space-y-6">
            {/* Week Calendar */}
            <div className="cl-card" style={{ borderRadius: 20, padding: 20 }}>
              <div className="flex justify-between gap-1">
                {weekDays.map((day, i) => {
                  const date = new Date(today);
                  date.setDate(today.getDate() - today.getDay() + i);
                  const isToday = i === today.getDay();
                  const hasWorkout = workoutDays.includes(i);

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(i)}
                      className="flex flex-col items-center gap-1 flex-1 py-2"
                      style={{
                        borderRadius: "var(--radius-md)",
                        background: selectedDay === i ? (isToday ? "var(--lime-400)" : "var(--surface-elevated)") : "transparent",
                        color: selectedDay === i && isToday ? "#0A0C0F" : "var(--text-primary)",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: 11, color: selectedDay === i && isToday ? "#0A0C0F" : "var(--text-tertiary)", fontWeight: 500 }}>
                        {day}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                        {date.getDate()}
                      </span>
                      {hasWorkout && (
                        <span style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: selectedDay === i && isToday ? "#0A0C0F" : "var(--lime-400)",
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Workout Log */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Today&apos;s Plan</h3>
              <div className="space-y-2">
                {todayWorkout.map((exercise, idx) => (
                  <div
                    key={idx}
                    className="cl-card flex items-center justify-between card-hover"
                    style={{ borderRadius: "var(--radius-lg)", padding: "14px 16px" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "var(--radius-full)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: exercise.completed ? "var(--lime-400)" : "transparent",
                          border: exercise.completed ? "none" : "2px solid var(--border-color)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {exercise.completed && <CheckCircle size={16} color="#0A0C0F" />}
                      </div>
                      <div>
                        <p style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: exercise.completed ? "var(--text-tertiary)" : "var(--text-primary)",
                          textDecoration: exercise.completed ? "line-through" : "none",
                        }}>
                          {exercise.name}
                        </p>
                        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{exercise.sets}</span>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>·</span>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{exercise.weight}</span>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 8px",
                              borderRadius: "var(--radius-sm)",
                              background: "rgba(170, 255, 0, 0.1)",
                              color: "var(--lime-400)",
                              fontWeight: 500,
                            }}
                          >
                            {exercise.muscle}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: exercise.completed ? "var(--lime-400)" : "var(--warning)",
                        }}
                      >
                        {exercise.completed ? "Done" : "In progress"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="btn-secondary w-full flex items-center justify-center gap-2 mt-3"
                style={{ fontSize: 13, padding: "10px" }}
              >
                <Plus size={14} /> Add Exercise
              </button>
            </div>

            {/* Form Analysis History */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Past Form Checks</h3>
              <div className="space-y-2">
                {formHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="cl-card flex items-center justify-between card-hover"
                    style={{ borderRadius: "var(--radius-lg)", padding: "12px 16px", cursor: "pointer" }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.exercise}</p>
                      <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{item.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 14,
                          fontWeight: 700,
                          color: item.score >= 8 ? "var(--lime-400)" : "var(--warning)",
                          padding: "4px 10px",
                          borderRadius: "var(--radius-full)",
                          background: item.score >= 8 ? "rgba(170, 255, 0, 0.1)" : "rgba(255, 184, 0, 0.1)",
                        }}
                      >
                        {item.score}/10
                      </span>
                      <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Column: Muscle Library ── */}
          <div className="space-y-4">
            <div className="cl-card" style={{ borderRadius: 20, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Muscle Library</h3>
              
              {/* Search */}
              <input
                type="text"
                placeholder="Search exercises..."
                className="cl-input mb-3"
                style={{ fontSize: 13 }}
              />

              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                {muscleFilters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "var(--radius-full)",
                      fontSize: 12,
                      fontWeight: 600,
                      background: activeFilter === filter ? "var(--lime-400)" : "var(--surface-elevated)",
                      color: activeFilter === filter ? "#0A0C0F" : "var(--text-secondary)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Exercise Cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Barbell Squat", muscle: "Legs" },
                  { name: "Bench Press", muscle: "Chest" },
                  { name: "Deadlift", muscle: "Back" },
                  { name: "OHP", muscle: "Shoulders" },
                ].map((ex, i) => (
                  <div
                    key={i}
                    className="card-hover"
                    style={{
                      padding: 14,
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: 60,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--surface-card)",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Flame size={20} style={{ color: "var(--text-tertiary)" }} />
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{ex.name}</p>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(170, 255, 0, 0.1)",
                        color: "var(--lime-400)",
                        fontWeight: 500,
                      }}
                    >
                      {ex.muscle}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className="w-full mt-4 text-center"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--lime-400)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                View full library →
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}