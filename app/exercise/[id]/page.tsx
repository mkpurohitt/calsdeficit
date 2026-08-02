"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { getDateKey, saveWorkoutLog } from "../../../lib/user-data";
import { ArrowLeft, CheckCircle, Loader2, Plus, Video } from "lucide-react";
import ExerciseGif from "../../../components/ExerciseGif";
import { DifficultyChip, MetChip } from "../../../components/ExerciseMeta";

interface ExerciseDetail {
  id: string;
  name: string;
  muscle_group: string;
  equipment?: string | null;
  gif_url?: string | null;
  frames?: string[];
  body_part?: string | null;
  secondary_muscles?: string[];
  instructions?: string[];
  difficulty?: string | null;
  met_value?: number | null;
}

export default function ExerciseDetailPage() {
  const params = useParams() as { id?: string };
  const router = useRouter();
  const { user } = useAuth() as { user: { uid?: string } | null };

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [logForm, setLogForm] = useState({ sets: 3, reps: 10, weight_lbs: 0 });
  const [isLogging, setIsLogging] = useState(false);
  const [logMessage, setLogMessage] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    const exerciseId = params.id;

    const fetchExercise = async () => {
      setLoading(true);
      const res = await fetch(`/api/exercises?id=${encodeURIComponent(exerciseId)}`);
      const json = await res.json();
      if (json.success) setExercise(json.data);
      setLoading(false);
    };

    fetchExercise();
  }, [params.id]);

  const handleLogSet = async () => {
    if (!exercise || !user?.uid) return;
    setIsLogging(true);
    setLogMessage(null);
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
        date_key: getDateKey(),
        logged_at: new Date().toISOString(),
      });

      setLogMessage(`Logged ${exercise.name}`);
    } catch (err: unknown) {
      setLogError(err instanceof Error ? err.message : "Could not log this set.");
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-6" style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back
        </button>

        {loading && (
          <div className="flex items-center gap-3" style={{ color: "var(--text-secondary)" }}>
            <Loader2 size={18} className="animate-spin" /> Loading exercise...
          </div>
        )}

        {!loading && !exercise && (
          <div className="cl-card" style={{ borderRadius: 20 }}>
            <p style={{ color: "var(--text-secondary)" }}>Exercise not found.</p>
          </div>
        )}

        {exercise && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_420px] gap-6">
            <section className="space-y-4">
              <div style={{ width: "100%", aspectRatio: "16 / 10", borderRadius: 20, background: "var(--surface-card)", border: "1px solid var(--border-color)", overflow: "hidden" }}>
                <ExerciseGif frames={exercise.frames} src={exercise.gif_url} alt={exercise.name} radius={20} iconSize={56} />
              </div>

              <div className="cl-card" style={{ borderRadius: 20, padding: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>How to perform</h2>
                {exercise.instructions && exercise.instructions.length > 0 ? (
                  <ol style={{ paddingLeft: 18, display: "grid", gap: 10, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
                    {exercise.instructions.map((instruction, index) => (
                      <li key={`${exercise.id}-${index}`}>{instruction}</li>
                    ))}
                  </ol>
                ) : (
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
                    Detailed instructions are not stored for this move yet, but the GIF above shows the movement pattern and range of motion.
                  </p>
                )}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="cl-card" style={{ borderRadius: 20, padding: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", textTransform: "capitalize", lineHeight: 1.15 }}>
                  {exercise.name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: "var(--radius-full)", background: "rgba(170, 255, 0, 0.12)", color: "var(--lime-400)", fontWeight: 700, textTransform: "capitalize" }}>
                    {exercise.muscle_group}
                  </span>
                  <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: "var(--radius-full)", background: "var(--surface-elevated)", color: "var(--text-secondary)", fontWeight: 700, textTransform: "capitalize" }}>
                    {exercise.equipment || "Bodyweight"}
                  </span>
                  {exercise.body_part && (
                    <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: "var(--radius-full)", background: "var(--surface-elevated)", color: "var(--text-secondary)", fontWeight: 700, textTransform: "capitalize" }}>
                      {exercise.body_part}
                    </span>
                  )}
                  <DifficultyChip difficulty={exercise.difficulty} size="md" />
                  <MetChip met={exercise.met_value} size="md" />
                </div>
                {exercise.secondary_muscles && exercise.secondary_muscles.length > 0 && (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 18 }}>
                    Secondary muscles: {exercise.secondary_muscles.join(", ")}
                  </p>
                )}
                <button onClick={() => router.push("/?mode=gym")} className="btn-secondary w-full flex items-center justify-center gap-2 mt-5" style={{ fontSize: 13 }}>
                  <Video size={15} /> Check form with video
                </button>
              </div>

              <div className="cl-card-accent" style={{ borderRadius: 20, padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Log Set</h2>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { key: "sets", label: "Sets", min: 1 },
                    { key: "reps", label: "Reps", min: 1 },
                    { key: "weight_lbs", label: "Weight", min: 0 },
                  ].map((field) => (
                    <div key={field.key}>
                      <label style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, display: "block", marginBottom: 5 }}>
                        {field.label}
                      </label>
                      <input
                        type="number"
                        min={field.min}
                        value={logForm[field.key as keyof typeof logForm]}
                        onChange={(event) => setLogForm({ ...logForm, [field.key]: Number(event.target.value) })}
                        className="cl-input"
                        style={{ fontSize: 14, padding: "9px 10px", textAlign: "center", fontFamily: "var(--font-mono)" }}
                      />
                    </div>
                  ))}
                </div>
                <button onClick={handleLogSet} disabled={isLogging} className="btn-primary w-full flex items-center justify-center gap-2" style={{ height: 42, fontSize: 14, opacity: isLogging ? 0.7 : 1 }}>
                  {isLogging ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  {isLogging ? "Logging..." : "Log Set"}
                </button>
                {logMessage && (
                  <p className="flex items-center gap-2 mt-3" style={{ fontSize: 13, color: "var(--lime-400)", fontWeight: 700 }}>
                    <CheckCircle size={15} /> {logMessage}
                  </p>
                )}
                {logError && (
                  <p className="mt-3" style={{ fontSize: 13, color: "var(--error)", fontWeight: 600 }}>{logError}</p>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
