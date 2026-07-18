"use client";
import { useState, useEffect, useCallback, useRef, ChangeEvent, KeyboardEvent } from "react";
import { useAuth } from "../lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Video, Paperclip, Plus, X, PlayCircle, Activity, Loader2, Check, Dumbbell } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import AppLayout from "../components/AppLayout";
import AdCard from "../components/ads/AdCard";
import FoodScanCard from "../components/FoodScanCard";
import { apiFetch } from "../lib/api-client";
import { compressImage, fileToBase64, makeImageThumb, MAX_VIDEO_BYTES } from "../lib/image-compress";
import type { FoodScanResult } from "../lib/schemas/food-scan";
import { getFoodLogs, getUserGoal, getDay, getDateKey, addFoodLog, saveWorkoutLog } from "../lib/user-data";
import { STEP_GOAL } from "../lib/config/app";

interface DailyStats {
  consumed: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  steps: number;
  stepGoal: number;
  hasGoal: boolean;
}

interface WorkoutParse {
  exercise_name: string;
  muscle_group: string;
  sets: number;
  reps: number;
  weight_kg: number;
  confidence: number;
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  /** Object-URL preview of an attached file (user messages). */
  file?: string | null;
  /** Original File object — kept so "Add to diary" can build a photo thumb. */
  fileObj?: File | null;
  exercises?: ExerciseResult[];
  scan?: FoodScanResult;
  workout?: WorkoutParse;
  adKeywords?: string[];
  adsEnabled?: boolean;
}

interface ExerciseResult {
  id: string;
  name: string;
  muscle_group: string;
  equipment?: string | null;
  gif_url?: string | null;
}

const INITIAL_MESSAGES: Message[] = [
  { role: "ai", text: "Hey! Upload a food photo to scan nutrients, or a workout video for form analysis. 📷🏋️" }
];

/** Meal slot inferred from the current time of day. */
function mealTypeByTime(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 18) return "Snacks";
  return "Dinner";
}

const markdownComponents: Components = {
  h1: ({...props}) => <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--lime-400)", marginBottom: 8, fontFamily: "var(--font-display)" }} {...props} />,
  h2: ({...props}) => <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--lime-400)", marginBottom: 8, fontFamily: "var(--font-display)" }} {...props} />,
  strong: ({...props}) => <span style={{ fontWeight: 700, color: "var(--lime-400)" }} {...props} />,
  ul: ({...props}) => <ul style={{ listStyleType: "disc", paddingLeft: 16, marginBottom: 8 }} {...props} />,
  li: ({...props}) => <li style={{ marginBottom: 4 }} {...props} />,
  p: ({...props}) => <p style={{ marginBottom: 8 }} {...props} />,
};

/** Parsed-workout summary with a one-tap "Log to Exercise" save. */
function WorkoutLogCard({ workout, onLog }: { workout: WorkoutParse; onLog: () => Promise<void> }) {
  const [logState, setLogState] = useState<"idle" | "saving" | "saved">("idle");
  const weightLbs = Math.round(workout.weight_kg * 2.20462);

  const handleLog = async () => {
    if (logState !== "idle") return;
    setLogState("saving");
    try {
      await onLog();
      setLogState("saved");
    } catch (error) {
      console.error("[home] workout log failed", error);
      setLogState("idle");
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="flex items-center" style={{ gap: 12 }}>
        <span
          style={{
            flex: "none",
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--surface-elevated)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--lime-400)",
          }}
        >
          <Dumbbell size={19} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cl-disp" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>
            {workout.exercise_name}
          </div>
          <div className="cl-mono" style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>
            {workout.sets}×{workout.reps}
            {workout.weight_kg > 0 ? ` · ${weightLbs} lbs` : ""}
            {workout.muscle_group ? ` · ${workout.muscle_group}` : ""}
          </div>
        </div>
      </div>

      <button
        onClick={handleLog}
        disabled={logState !== "idle"}
        className="flex items-center justify-center gap-2 w-full"
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "none",
          background: logState === "saved" ? "rgba(170, 255, 0, 0.12)" : "var(--lime-400)",
          color: logState === "saved" ? "var(--lime-400)" : "#0A0C0F",
          fontSize: 13.5,
          fontWeight: 700,
          cursor: logState === "idle" ? "pointer" : "default",
          transition: "background 0.15s ease, color 0.15s ease",
        }}
      >
        {logState === "saved" ? (
          <>
            <Check size={15} /> Logged
          </>
        ) : logState === "saving" ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Logging…
          </>
        ) : (
          "Log to Exercise"
        )}
      </button>

      <Link href="/exercise" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lime-600)" }}>
        Open Exercise page →
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { user, loading } = useAuth() as { user: { uid?: string } | null; loading: boolean };
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingLabel, setProcessingLabel] = useState("Thinking...");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<DailyStats | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Live "today" snapshot for the right rail — real logged data, no placeholders.
  const loadStats = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const todayKey = getDateKey();
      const [logs, goal, day] = await Promise.all([
        getFoodLogs(user.uid, { from: todayKey, to: todayKey }),
        getUserGoal(user.uid),
        getDay(user.uid, todayKey),
      ]);
      // New users (no plan yet) go through the onboarding wizard first
      if (!goal?.daily_calories) {
        router.push("/onboarding");
        return;
      }
      const consumed = logs.reduce((a, l) => a + (l.calories || 0), 0);
      const protein = logs.reduce((a, l) => a + (l.protein_g || 0), 0);
      setStats({
        consumed: Math.round(consumed),
        calorieGoal: goal?.daily_calories || 0,
        protein: Math.round(protein),
        proteinGoal: goal?.protein_g || 0,
        steps: day?.steps || 0,
        stepGoal: goal?.step_goal || STEP_GOAL,
        hasGoal: Boolean(goal?.daily_calories),
      });
    } catch (error) {
      console.error("[home] stats load failed", error);
      setStats({ consumed: 0, calorieGoal: 0, protein: 0, proteinGoal: 0, steps: 0, stepGoal: STEP_GOAL, hasGoal: false });
    }
  }, [user, router]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Attach popover: close on outside click / Escape
  useEffect(() => {
    if (!attachOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (attachRef.current && !attachRef.current.contains(event.target as Node)) {
        setAttachOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setAttachOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [attachOpen]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    e.target.value = ""; // allow re-selecting the same file
    setAttachOpen(false);
    if (!selected) return;
    if (selected.type.startsWith("video/") && selected.size > MAX_VIDEO_BYTES) {
      setFileError("Video too large — please keep it under 15 MB");
      return;
    }
    setFileError(null);
    setFile(selected);
  };

  const getProcessingLabel = (text: string, selectedFile: File | null) => {
    if (selectedFile?.type.startsWith('image/')) return "Calculating calories...";
    if (selectedFile?.type.startsWith('video/')) return "Analyzing form...";

    const lower = text.toLowerCase();
    const exerciseWords = ["exercise", "exercises", "workout", "chest", "back", "legs", "arms", "shoulders", "abs", "core"];
    if (exerciseWords.some((word) => lower.includes(word))) return "Searching exercise database...";

    return "Thinking through your health query...";
  };

  // "Add to diary" on food-scan cards → real FoodLogRecord (+ tiny photo thumb when available)
  const handleAddToDiary = useCallback(async (scan: FoodScanResult, sourceFile?: File | null) => {
    if (!user?.uid) throw new Error("Not signed in");
    const photoThumb = sourceFile ? await makeImageThumb(sourceFile) : null;
    await addFoodLog({
      user_id: user.uid,
      food_name: scan.food_name,
      portion: scan.portion,
      calories: scan.calories,
      protein_g: scan.protein_g,
      carbs_g: scan.carbs_g,
      fat_g: scan.fat_g,
      fiber_g: scan.fiber_g,
      meal_type: mealTypeByTime(),
      health_tip: scan.health_tip,
      source: scan.source,
      verified: scan.verified,
      confidence: scan.confidence,
      ...(photoThumb ? { photo_thumb: photoThumb } : {}),
      date_key: getDateKey(),
      date: new Date().toISOString(),
    });
    loadStats(); // refresh "calories remaining" in the right rail
  }, [user, loadStats]);

  // "Log to Exercise" on parsed workout messages → real WorkoutLogRecord
  const handleLogWorkout = useCallback(async (workout: WorkoutParse) => {
    if (!user?.uid) throw new Error("Not signed in");
    await saveWorkoutLog({
      user_id: user.uid,
      exercise_id: 'chat-' + Date.now(),
      exercise_name: workout.exercise_name,
      muscle_group: workout.muscle_group,
      sets: workout.sets,
      reps: workout.reps,
      weight_lbs: Math.round(workout.weight_kg * 2.20462),
      date_key: getDateKey(),
      logged_at: new Date().toISOString(),
    });
  }, [user]);

  const handleSend = async () => {
    if (!input.trim() && !file) return;

    const userMsg: Message = {
      role: "user",
      text: input,
      file: file ? URL.createObjectURL(file) : null,
      fileObj: file,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    const currentInput = input;
    const currentFile = file;
    setProcessingLabel(getProcessingLabel(currentInput, currentFile));
    setInput("");
    setFile(null);

    try {
      let fileData: string | null = null;
      let mimeType: string | null = null;

      if (currentFile) {
        // Images are standardized on-device (≤768px / 75% JPEG) so each scan
        // costs a flat 258 input tokens.
        const prepared = currentFile.type.startsWith("image/")
          ? await compressImage(currentFile)
          : currentFile;
        fileData = await fileToBase64(prepared);
        mimeType = prepared.type;
      }

      // The server auto-detects intent from the file type / message text — no mode flag.
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          fileData: fileData,
          mimeType: mimeType,
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.kind === 'food-scan' && data.scan) {
          setMessages((prev) => [...prev, {
            role: "ai",
            text: "",
            scan: data.scan as FoodScanResult,
            // keep the source image around so "Add to diary" can attach a thumb
            fileObj: currentFile?.type.startsWith("image/") ? currentFile : null,
            adKeywords: data.adKeywords || [],
            adsEnabled: data.adsEnabled ?? true,
          }]);
        } else if (data.kind === 'workout-log' && data.workout) {
          setMessages((prev) => [...prev, {
            role: "ai",
            text: typeof data.data === 'string' ? data.data : "",
            workout: data.workout as WorkoutParse,
            adKeywords: data.adKeywords || [],
            adsEnabled: data.adsEnabled ?? true,
          }]);
        } else {
          setMessages((prev) => [...prev, {
            role: "ai",
            text: data.data,
            exercises: data.exercises || [],
            adKeywords: data.adKeywords || [],
            adsEnabled: data.adsEnabled ?? true,
          }]);
        }
      } else {
        setMessages((prev) => [...prev, { role: "ai", text: "Error: " + (data.error || "Unknown error") }]);
      }

    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "ai", text: "Something went wrong connecting to the server." }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  // Right-rail suggestions. Each click wires to an EXISTING handler
  // (opening the attach menu or prefilling the input) — no new APIs introduced.
  const suggestions: { t: string; s: string; go: () => void }[] = [
    { t: "Scan a meal", s: "Snap a photo, get instant macros", go: () => setAttachOpen(true) },
    { t: "Check my form", s: "Upload a clip for AI analysis", go: () => setAttachOpen(true) },
    { t: "Plan my macros", s: "Hit your protein target today", go: () => setInput("Help me plan my macros to hit my protein target today.") },
    { t: "What should I eat?", s: "Ideas for a balanced day", go: () => setInput("What should I eat for a balanced, high-protein day?") },
  ];

  const attachOptions: { label: string; accept: string; capture?: "environment" }[] = [
    { label: "📷 Take photo", accept: "image/*", capture: "environment" },
    { label: "🖼️ Upload photo", accept: "image/*" },
    { label: "🎥 Upload video", accept: "video/*" },
  ];

  if (loading) return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full recording" style={{ background: "var(--lime-400)" }} />
        <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}>Loading...</span>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div
        className="cl-home"
        style={{ maxWidth: 1380, margin: "0 auto", padding: "30px 38px 48px" }}
      >
        <div className="cl-home-grid">

          {/* ════ Chat column (v2: transparent, no card chrome) ════ */}
          <div
            className="cl-chat-card"
            style={{
              display: "flex",
              flexDirection: "column",
              height: "calc(100vh - 108px)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: "8px 4px 24px", display: "flex", flexDirection: "column", gap: 16 }}
            >
              {/* Bottom-anchor spacer: pushes short conversations to the bottom
                  (ChatGPT/Claude style); collapses to 0 once content overflows. */}
              <div style={{ flexGrow: 1 }} aria-hidden="true" />

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
                  style={{ animationDelay: "0s" }}
                >
                  <div
                    className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}
                    style={msg.role === "user" ? undefined : { borderLeft: "2px solid var(--lime-400)" }}
                  >
                    {/* File preview */}
                    {msg.file && (
                      msg.fileObj?.type.startsWith("video/") ? (
                        <div className="flex items-center gap-2 mb-2" style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                          <Video size={14} style={{ flexShrink: 0 }} />
                          <span className="truncate">{msg.fileObj.name}</span>
                        </div>
                      ) : (
                        <img
                          src={msg.file}
                          alt="upload"
                          className="mb-2"
                          style={{ borderRadius: "var(--radius-md)", maxHeight: 160, objectFit: "cover" }}
                        />
                      )
                    )}

                    {/* 1. FOOD SCAN CARD (structured pipeline) */}
                    {msg.role === 'ai' && msg.scan ? (
                      <FoodScanCard
                        scan={msg.scan}
                        adKeywords={msg.adKeywords}
                        adsEnabled={msg.adsEnabled}
                        onAdd={() => handleAddToDiary(msg.scan as FoodScanResult, msg.fileObj)}
                      />

                    // 2. PARSED WORKOUT LOG
                    ) : msg.role === 'ai' && msg.workout ? (
                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                        {msg.text && (
                          <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                        )}
                        <WorkoutLogCard
                          workout={msg.workout}
                          onLog={() => handleLogWorkout(msg.workout as WorkoutParse)}
                        />
                        <AdCard keywords={msg.adKeywords} enabled={msg.adsEnabled} />
                      </div>

                    // 3. GYM VIDEO CARD (form analysis)
                    ) : msg.role === 'ai' && msg.text.includes('SEARCH_QUERY:') ? (
                      (() => {
                        const parts = msg.text.split('SEARCH_QUERY:');
                        const advice = parts[0].trim();
                        const query = parts[1] ? parts[1].trim() : "fitness";
                        const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2" style={{ color: "var(--lime-400)", fontWeight: 700, fontSize: 14 }}>
                              <Activity size={18} /> Form Analysis
                            </div>
                            <p className="whitespace-pre-wrap" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)" }}>{advice}</p>
                            <a
                              href={youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2.5 font-medium"
                              style={{
                                background: "#FF0000",
                                color: "#FFFFFF",
                                borderRadius: "var(--radius-md)",
                                fontSize: 14,
                                transition: "background 0.15s",
                              }}
                            >
                              <PlayCircle size={16} /> Watch Correct Form
                            </a>
                            <Link
                              href="/exercise"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--lime-600)" }}
                            >
                              Log it on the Exercise page →
                            </Link>
                            <AdCard keywords={msg.adKeywords} enabled={msg.adsEnabled} />
                          </div>
                        );
                      })()

                    // 4. NORMAL TEXT
                    ) : (
                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                        <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                        {msg.exercises && msg.exercises.length > 0 && (
                          <div className="grid gap-3 mt-3">
                            {msg.exercises.map((ex) => (
                              <div
                                key={ex.id}
                                className="flex items-center gap-3"
                                style={{
                                  padding: 10,
                                  borderRadius: "var(--radius-md)",
                                  background: "var(--surface-card)",
                                  border: "1px solid var(--border-subtle)",
                                }}
                              >
                                <div
                                  style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: "var(--radius-sm)",
                                    background: "var(--surface-elevated)",
                                    overflow: "hidden",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {ex.gif_url ? (
                                    <img src={ex.gif_url} alt={ex.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                                  ) : (
                                    <Activity size={22} style={{ color: "var(--text-tertiary)" }} />
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>{ex.name}</p>
                                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "capitalize", marginTop: 3 }}>
                                    {ex.muscle_group} {ex.equipment ? `- ${ex.equipment}` : ""}
                                  </p>
                                  <Link
                                    href={`/exercise/${ex.id}`}
                                    style={{
                                      display: "inline-flex",
                                      marginTop: 8,
                                      padding: "6px 10px",
                                      borderRadius: "var(--radius-sm)",
                                      background: "var(--lime-400)",
                                      color: "#0A0C0F",
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    Open exercise
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Contextual native ad after substantial AI answers */}
                        {msg.role === 'ai' && idx > 0 && (msg.exercises?.length || msg.text.length > 280) ? (
                          <AdCard keywords={msg.adKeywords} enabled={msg.adsEnabled} />
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="typing-indicator" style={{ alignItems: "center", gap: 10 }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: "var(--lime-400)" }} />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                      {processingLabel}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div style={{ padding: "16px 4px 0" }}>
              {/* Input row */}
              <div
                className="flex items-center"
                style={{
                  gap: 11,
                  background: "var(--input-bg)",
                  border: "1.5px solid var(--border-color)",
                  borderRadius: 14,
                  padding: "8px 8px 8px 14px",
                }}
              >
                {/* Attach button + popover menu */}
                <div ref={attachRef} style={{ position: "relative", flex: "none" }}>
                  <button
                    onClick={() => setAttachOpen((open) => !open)}
                    aria-label="Attach a photo or video"
                    aria-expanded={attachOpen}
                    title="Attach a photo or video"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      border: "1px solid var(--border-color)",
                      background: "var(--surface-card)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Plus size={18} style={{ transform: attachOpen ? "rotate(45deg)" : "none", transition: "transform 0.15s ease" }} />
                  </button>

                  {attachOpen && (
                    <div
                      role="menu"
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 10px)",
                        left: 0,
                        zIndex: 40,
                        minWidth: 190,
                        padding: 6,
                        background: "var(--surface-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 12,
                        boxShadow: "var(--shadow-card)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      {attachOptions.map((opt) => (
                        <label
                          key={opt.label}
                          className="cl-attach-item"
                          role="menuitem"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "9px 10px",
                            borderRadius: 8,
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {opt.label}
                          <input
                            type="file"
                            className="hidden"
                            accept={opt.accept}
                            capture={opt.capture}
                            onChange={handleFileChange}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    file
                      ? `Attached: ${file.name}`
                      : "Ask anything about your nutrition or training…"
                  }
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    fontSize: 15,
                    fontFamily: "inherit",
                    minWidth: 0,
                  }}
                />

                <button
                  onClick={handleSend}
                  disabled={!input && !file}
                  style={{
                    flex: "none",
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    border: "none",
                    background: "var(--lime-400)",
                    color: "#0A0C0F",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: !input && !file ? 0.4 : 1,
                    cursor: !input && !file ? "not-allowed" : "pointer",
                  }}
                  aria-label="Send"
                >
                  <Send size={18} />
                </button>
              </div>

              {/* File indicator */}
              {file && (
                <div className="flex items-center gap-2 mt-2" style={{ fontSize: 12, color: "var(--lime-400)" }}>
                  <Paperclip size={12} />
                  <span className="truncate">{file.name}</span>
                  <button
                    onClick={() => setFile(null)}
                    style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", fontSize: 12, display: "inline-flex" }}
                    aria-label="Remove file"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* File error (e.g. oversized video) */}
              {fileError && (
                <div className="flex items-center gap-2 mt-2" style={{ fontSize: 12, color: "var(--error)" }}>
                  <span>{fileError}</span>
                  <button
                    onClick={() => setFileError(null)}
                    style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", fontSize: 12, display: "inline-flex" }}
                    aria-label="Dismiss error"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ════ Right rail ════ */}
          <aside className="cl-rail" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Calories remaining (static/derived — no live source on this page) */}
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                background: "var(--surface-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 18,
                padding: 22,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: -30,
                  top: -30,
                  width: 180,
                  height: 180,
                  background: "radial-gradient(circle, rgba(170,255,0,.14), transparent 65%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 4 }}>Calories remaining</div>
                {stats?.hasGoal ? (
                  <div className="flex" style={{ alignItems: "baseline", gap: 7, marginBottom: 18 }}>
                    <span className="cl-mono" style={{ fontSize: 34, fontWeight: 700, color: "var(--lime-400)", lineHeight: 1 }}>
                      {Math.max(0, stats.calorieGoal - stats.consumed).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>/ {stats.calorieGoal.toLocaleString()}</span>
                  </div>
                ) : (
                  <Link href="/onboarding" style={{ display: "inline-block", marginBottom: 18, fontSize: 14, fontWeight: 600, color: "var(--lime-600)" }}>
                    Set your daily goal →
                  </Link>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  <div>
                    <div className="flex" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 5 }}>
                      <span>Protein</span>
                      <span className="cl-mono">{stats ? `${stats.protein}${stats.proteinGoal ? ` / ${stats.proteinGoal}` : ""}g` : "—"}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--surface-elevated)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${stats?.proteinGoal ? Math.min(100, Math.round((stats.protein / stats.proteinGoal) * 100)) : 0}%`, background: "var(--macro-protein)", borderRadius: 99, transition: "width .6s ease" }} />
                    </div>
                  </div>
                  {/* Steps — greyed out until the mobile app ships step counting */}
                  <div aria-disabled="true" style={{ userSelect: "none" }}>
                    <div style={{ opacity: 0.45, filter: "grayscale(1)", pointerEvents: "none" }}>
                      <div className="flex" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 5 }}>
                        <span>Steps</span>
                        <span className="cl-mono">{(stats?.steps || 0).toLocaleString()} / {(stats?.stepGoal ?? STEP_GOAL).toLocaleString()}</span>
                      </div>
                      <div style={{ height: 6, background: "var(--surface-elevated)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, Math.round(((stats?.steps || 0) / (stats?.stepGoal ?? STEP_GOAL)) * 100))}%`, background: "var(--info)", borderRadius: 99 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 5 }}>
                      To count your steps, download our app — coming soon.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Try asking */}
            <div
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 18,
                padding: 22,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="cl-disp" style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", marginBottom: 14 }}>
                Try asking
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {suggestions.map((sg) => (
                  <button
                    key={sg.t}
                    onClick={sg.go}
                    className="cl-card-hover"
                    style={{
                      textAlign: "left",
                      padding: "13px 15px",
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{sg.t}</div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{sg.s}</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .cl-home-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 20px;
          align-items: start;
        }
        .cl-attach-item {
          transition: background 0.12s ease;
        }
        .cl-attach-item:hover {
          background: var(--surface-elevated);
        }
        @media (max-width: 860px) {
          .cl-home {
            padding: 20px 16px 32px !important;
          }
          .cl-home-grid {
            grid-template-columns: 1fr;
          }
          .cl-rail {
            order: -1;
          }
          .cl-chat-card {
            height: calc(100vh - 140px) !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
