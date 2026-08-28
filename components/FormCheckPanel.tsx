"use client";
// On-device form check: MediaPipe pose runs in the browser, only compact
// telemetry JSON goes to /api/form-analysis. Replaces the old Python server.
import { useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { apiFetch } from "../lib/api-client";
import { makeVideoThumb } from "../lib/image-compress";
import AdCard from "./ads/AdCard";
import ShareChatButton from "./ShareChatButton";

export interface FormAnalysisResult {
  exercise_name: string;
  score: number;
  verdict: string;
  positives: string[];
  corrections: string[];
  feedback?: { positive?: string; improvement?: string };
}

interface FormCheckPanelProps {
  onResult?: (result: FormAnalysisResult) => void;
}

type Stage = "idle" | "loading-model" | "analyzing" | "scoring" | "done";

export default function FormCheckPanel({ onResult }: FormCheckPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [exerciseHint, setExerciseHint] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FormAnalysisResult | null>(null);
  const [adKeywords, setAdKeywords] = useState<string[]>([]);
  const [adsEnabled, setAdsEnabled] = useState(true);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setStage("idle");
    setProgress(0);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setError(null);
    setResult(null);

    try {
      setStage("loading-model");
      const { extractTelemetry } = await import("../lib/pose/telemetry");

      setStage("analyzing");
      const telemetry = await extractTelemetry(file, {
        exerciseHint: exerciseHint || undefined,
        onProgress: (fraction) => setProgress(fraction),
      });

      setStage("scoring");
      // Tiny frame from the video so past form checks can show a preview.
      const thumb = await makeVideoThumb(file);
      const res = await apiFetch("/api/form-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telemetry, thumb }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Analysis failed.");

      setResult(json.data);
      setAdKeywords(json.adKeywords || []);
      setAdsEnabled(json.adsEnabled ?? true);
      setStage("done");
      onResult?.(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStage("idle");
    }
  };

  const scoreColor = (score: number) =>
    score >= 75 ? "var(--lime-400)" : score >= 50 ? "var(--warning)" : "var(--error)";

  const stageLabel =
    stage === "loading-model"
      ? "Loading on-device AI model…"
      : stage === "analyzing"
        ? `Tracking your movement… ${Math.round(progress * 100)}%`
        : "Scoring your form…";

  return (
    <div className="cl-card-accent flex flex-col" style={{ borderRadius: 18, padding: 22 }}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
            Check Your Form
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>AI pose analysis, on your device</p>
        </div>
        {result && (
          <div
            style={{
              padding: "4px 10px",
              borderRadius: "100px",
              fontSize: 13,
              fontWeight: 700,
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              color: scoreColor(result.score),
              fontFamily: "var(--font-mono)",
            }}
          >
            {result.score}/100
          </div>
        )}
      </div>

      {stage === "idle" && !result && (
        <>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            ref={fileInputRef}
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <div
            className="flex flex-col items-center justify-center gap-2"
            style={{
              height: 130,
              borderRadius: "var(--radius-lg)",
              border: "2px dashed var(--border-color)",
              background: "var(--surface-card)",
              cursor: "pointer",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={26} style={{ color: "var(--lime-400)" }} />
            <span style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "0 10px" }}>
              {file ? file.name : "Drop video or click to upload"}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>MP4, MOV — up to 60 seconds</span>
          </div>

          <input
            type="text"
            value={exerciseHint}
            onChange={(event) => setExerciseHint(event.target.value)}
            placeholder="Which exercise? (optional, e.g. squat)"
            className="cl-input mt-3"
            style={{ fontSize: 13 }}
          />

          <button
            onClick={handleAnalyze}
            disabled={!file}
            className="btn-primary w-full mt-3 flex items-center justify-center gap-2"
            style={{ height: 44, fontSize: 14, opacity: !file ? 0.5 : 1 }}
          >
            <Sparkles size={15} /> Analyse Form
          </button>

          <p className="flex items-center gap-1.5 justify-center mt-3" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            <ShieldCheck size={12} style={{ color: "var(--lime-400)" }} />
            Your video is processed on your device and never uploaded.
          </p>
          {error && (
            <p style={{ color: "var(--error)", fontSize: 12, marginTop: 10, textAlign: "center" }}>{error}</p>
          )}
        </>
      )}

      {(stage === "loading-model" || stage === "analyzing" || stage === "scoring") && (
        <div
          className="flex flex-col items-center justify-center gap-4 py-8"
          style={{ border: "2px dashed var(--border-color)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)" }}
        >
          <Loader2 size={30} className="animate-spin" style={{ color: "var(--lime-400)" }} />
          <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5 }}>{stageLabel}</p>
          {stage === "analyzing" && (
            <div className="macro-bar__track" style={{ width: "70%" }}>
              <div
                className="macro-bar__fill"
                style={{ width: `${Math.round(progress * 100)}%`, background: "var(--lime-400)" }}
              />
            </div>
          )}
        </div>
      )}

      {result && stage === "done" && (
        <div
          style={{
            background: "var(--surface-elevated)",
            padding: 16,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", textTransform: "capitalize" }}>
            {result.exercise_name} — {result.verdict}
          </span>

          {result.positives.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {result.positives.map((item, index) => (
                <p key={index} className="flex items-start gap-2" style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                  <CheckCircle2 size={14} style={{ color: "var(--lime-400)", marginTop: 2, flexShrink: 0 }} />
                  {item}
                </p>
              ))}
            </div>
          )}

          {result.corrections.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Fix this
              </p>
              {result.corrections.map((item, index) => (
                <p
                  key={index}
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    paddingLeft: 10,
                    borderLeft: "2px solid var(--warning)",
                  }}
                >
                  {item}
                </p>
              ))}
            </div>
          )}

          <AdCard keywords={adKeywords} enabled={adsEnabled} />

          {/* Snapshotted as a two-turn chat so a shared link opens in the same
              reader as every other share, and can be carried on. */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <ShareChatButton
              compact={false}
              label="Share this analysis"
              title={`${result.exercise_name} form check`}
              messages={[
                { role: "user", text: `How was my ${result.exercise_name} form?` },
                {
                  role: "ai",
                  text: [
                    `**${result.exercise_name} — ${result.verdict}** (${result.score}/100)`,
                    result.positives.length ? `\n${result.positives.map((p) => `- ${p}`).join("\n")}` : "",
                    result.corrections.length ? `\n**Fix this**\n${result.corrections.map((c) => `- ${c}`).join("\n")}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                },
              ]}
            />
          </div>

          <button
            onClick={reset}
            className="w-full mt-4"
            style={{
              fontSize: 13,
              color: "var(--lime-400)",
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "8px 0",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Analyse Another Video
          </button>
        </div>
      )}
    </div>
  );
}
