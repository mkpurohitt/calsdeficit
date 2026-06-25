"use client";
import { useState, useEffect, useCallback, useRef, ChangeEvent, KeyboardEvent } from "react";
import { useAuth } from "../lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Camera, Video, Paperclip, Trash2, X, PlayCircle, Activity, Loader2, Bot } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { auth } from "../lib/firebase";
import AppLayout from "../components/AppLayout";
import AdCard from "../components/ads/AdCard";
import FoodScanCard from "../components/FoodScanCard";
import { apiFetch } from "../lib/api-client";
import { compressImage, fileToBase64 } from "../lib/image-compress";
import type { FoodScanResult } from "../lib/schemas/food-scan";
import { getFoodLogs, getUserGoal, getDay, getDateKey } from "../lib/user-data";
import { STEP_GOAL } from "../lib/config/app";

interface DailyStats {
  consumed: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  steps: number;
  hasGoal: boolean;
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  file?: string | null;
  exercises?: ExerciseResult[];
  scan?: FoodScanResult;
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

export default function Dashboard() {
  const { user, loading } = useAuth() as { user: { uid?: string } | null; loading: boolean };
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState<string>("");
  const [mode, setMode] = useState<'chat' | 'food' | 'gym'>("chat");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingLabel, setProcessingLabel] = useState("Thinking...");

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const consumed = logs.reduce((a, l) => a + (l.calories || 0), 0);
      const protein = logs.reduce((a, l) => a + (l.protein_g || 0), 0);
      setStats({
        consumed: Math.round(consumed),
        calorieGoal: goal?.daily_calories || 0,
        protein: Math.round(protein),
        proteinGoal: goal?.protein_g || 0,
        steps: day?.steps || 0,
        hasGoal: Boolean(goal?.daily_calories),
      });
    } catch (error) {
      console.error("[home] stats load failed", error);
      setStats({ consumed: 0, calorieGoal: 0, protein: 0, proteinGoal: 0, steps: 0, hasGoal: false });
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "gym" || requestedMode === "food") {
      setMode(requestedMode);
    }
  }, []);

  const getFileTypes = () => {
    if (mode === 'food') return "image/*";
    if (mode === 'gym') return "video/*";
    return "image/*";
  };

  const handleModeSwitch = (newMode: 'food' | 'gym') => {
    setMode((current) => (current === newMode ? 'chat' : newMode));
    setFile(null);
  };

  const handleReset = () => {
    setMessages(INITIAL_MESSAGES);
    setInput("");
    setFile(null);
    setMode("chat");
  };

  const handleLogout = () => {
    auth.signOut();
    router.push("/login");
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const getProcessingLabel = (text: string, selectedMode: 'chat' | 'food' | 'gym', selectedFile: File | null) => {
    if (selectedMode === 'food' || selectedFile?.type.startsWith('image/')) return "Calculating calories...";
    if (selectedMode === 'gym' || selectedFile?.type.startsWith('video/')) return "Analyzing form...";

    const lower = text.toLowerCase();
    const exerciseWords = ["exercise", "exercises", "workout", "chest", "back", "legs", "arms", "shoulders", "abs", "core"];
    if (exerciseWords.some((word) => lower.includes(word))) return "Searching exercise database...";

    return "Thinking through your health query...";
  };

  const handleSend = async () => {
    if (!input.trim() && !file) return;

    const userMsg: Message = {
      role: "user",
      text: input,
      file: file ? URL.createObjectURL(file) : null
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    const currentInput = input;
    const currentFile = file;
    const currentMode = mode;
    setProcessingLabel(getProcessingLabel(currentInput, currentMode, currentFile));
    setInput("");
    setFile(null);

    try {
      let fileData = null;
      let mimeType = null;

      if (currentFile) {
        // Images are standardized on-device (≤768px / 75% JPEG) so each scan
        // costs a flat 258 input tokens.
        const prepared = currentFile.type.startsWith("image/")
          ? await compressImage(currentFile)
          : currentFile;
        fileData = await fileToBase64(prepared);
        mimeType = prepared.type;
      }

      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          fileData: fileData,
          mimeType: mimeType,
          mode: currentMode,
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.kind === 'food-scan' && data.scan) {
          setMessages((prev) => [...prev, {
            role: "ai",
            text: "",
            scan: data.scan as FoodScanResult,
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
  // (mode switch or prefilling the input) — no new APIs introduced.
  const suggestions: { t: string; s: string; go: () => void }[] = [
    { t: "Scan a meal", s: "Snap a photo, get instant macros", go: () => handleModeSwitch('food') },
    { t: "Check my form", s: "Upload a clip for AI analysis", go: () => handleModeSwitch('gym') },
    { t: "Plan my macros", s: "Hit your protein target today", go: () => { setMode('chat'); setInput("Help me plan my macros to hit my protein target today."); } },
    { t: "What should I eat?", s: "Ideas for a balanced day", go: () => { setMode('chat'); setInput("What should I eat for a balanced, high-protein day?"); } },
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

          {/* ════ Chat panel card ════ */}
          <div
            className="cl-chat-card"
            style={{
              display: "flex",
              flexDirection: "column",
              height: "calc(100vh - 108px)",
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 20,
              boxShadow: "var(--shadow-card)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center"
              style={{
                gap: 11,
                padding: "16px 22px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, var(--lime-400), #72B800)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0A0C0F",
                  flex: "none",
                }}
              >
                <Bot size={18} />
              </span>
              <div style={{ flex: 1 }}>
                <div className="cl-disp" style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
                  CalAI
                </div>
                <div className="flex items-center" style={{ gap: 6, fontSize: 12, color: "var(--text-tertiary)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--lime-400)", boxShadow: "var(--shadow-lime-sm)" }} />
                  Online · powered by your data
                </div>
              </div>
              <button
                onClick={handleReset}
                className="btn-icon"
                aria-label="Reset chat"
                title="Reset chat"
                style={{ width: 36, height: 36 }}
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={handleLogout}
                className="btn-icon"
                aria-label="Log out"
                title="Log out"
                style={{ width: 36, height: 36 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: 16 }}
            >
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
                      <img
                        src={msg.file}
                        alt="upload"
                        className="mb-2"
                        style={{ borderRadius: "var(--radius-md)", maxHeight: 160, objectFit: "cover" }}
                      />
                    )}

                    {/* 1. FOOD SCAN CARD (structured pipeline) */}
                    {msg.role === 'ai' && msg.scan ? (
                      <FoodScanCard
                        scan={msg.scan}
                        adKeywords={msg.adKeywords}
                        adsEnabled={msg.adsEnabled}
                      />

                    // 2. GYM MODE CARD
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
                            <AdCard keywords={msg.adKeywords} enabled={msg.adsEnabled} />
                          </div>
                        );
                      })()

                    // 3. NORMAL TEXT
                    ) : (
                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                        <ReactMarkdown
                          components={{
                            h1: ({...props}) => <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--lime-400)", marginBottom: 8, fontFamily: "var(--font-display)" }} {...props} />,
                            h2: ({...props}) => <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--lime-400)", marginBottom: 8, fontFamily: "var(--font-display)" }} {...props} />,
                            strong: ({...props}) => <span style={{ fontWeight: 700, color: "var(--lime-400)" }} {...props} />,
                            ul: ({...props}) => <ul style={{ listStyleType: "disc", paddingLeft: 16, marginBottom: 8 }} {...props} />,
                            li: ({...props}) => <li style={{ marginBottom: 4 }} {...props} />,
                            p: ({...props}) => <p style={{ marginBottom: 8 }} {...props} />,
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
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
            <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "16px 22px" }}>
              {/* Quick-action chips */}
              <div className="flex" style={{ gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => handleModeSwitch('food')}
                  className="flex items-center"
                  style={{
                    gap: 7,
                    padding: "8px 14px",
                    borderRadius: 99,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: mode === 'food' ? "var(--lime-400)" : "var(--surface-elevated)",
                    color: mode === 'food' ? "#0A0C0F" : "var(--text-secondary)",
                    border: mode === 'food' ? "1px solid var(--lime-400)" : "1px solid var(--border-color)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Camera size={15} /> Scan Food
                </button>
                <button
                  onClick={() => handleModeSwitch('gym')}
                  className="flex items-center"
                  style={{
                    gap: 7,
                    padding: "8px 14px",
                    borderRadius: 99,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: mode === 'gym' ? "var(--lime-400)" : "var(--surface-elevated)",
                    color: mode === 'gym' ? "#0A0C0F" : "var(--text-secondary)",
                    border: mode === 'gym' ? "1px solid var(--lime-400)" : "1px solid var(--border-color)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Video size={15} /> Gym Form
                </button>
              </div>

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
                <label
                  style={{
                    flex: "none",
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Attach file"
                >
                  {mode === 'gym' ? <Video size={19} /> : mode === 'food' ? <Camera size={19} /> : <Paperclip size={19} />}
                  <input
                    type="file"
                    className="hidden"
                    accept={getFileTypes()}
                    onChange={handleFileChange}
                  />
                </label>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    file
                      ? `Attached: ${file.name}`
                      : mode === 'chat'
                      ? "Ask anything about your nutrition or training…"
                      : `Ask about your ${mode}…`
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
                  <Link href="/diet" style={{ display: "inline-block", marginBottom: 18, fontSize: 14, fontWeight: 600, color: "var(--lime-600)" }}>
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
                  <div>
                    <div className="flex" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 5 }}>
                      <span>Steps</span>
                      <span className="cl-mono">{(stats?.steps || 0).toLocaleString()} / {STEP_GOAL.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--surface-elevated)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, Math.round(((stats?.steps || 0) / STEP_GOAL) * 100))}%`, background: "var(--info)", borderRadius: 99, transition: "width .6s ease" }} />
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
