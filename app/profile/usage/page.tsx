"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../../../components/AppLayout";
import { apiFetch } from "../../../lib/api-client";
import { Camera, Loader2, MessageSquare, RefreshCw, Video } from "lucide-react";

interface LimitInfo {
  used_pct: number;
  remaining_pct: number;
  window_start: string | null;
  resets_at: string | null;
  costs: { text: number; image: number; video: number };
  tierLabel: string;
}

function barColor(usedPct: number): string {
  if (usedPct >= 90) return "var(--error)";
  if (usedPct >= 70) return "var(--warning)";
  return "var(--lime-400)";
}

function formatCountdown(resetsAt: string, now: number): string {
  const ms = new Date(resetsAt).getTime() - now;
  if (ms <= 0) return "any moment now";
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function UsagePage() {
  const [info, setInfo] = useState<LimitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch("/api/limit");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "failed");
      setInfo(json as LimitInfo);
    } catch (err) {
      console.error("[usage] load failed", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tick the countdown every 30 s while a window is open.
  useEffect(() => {
    if (!info?.resets_at) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [info?.resets_at]);

  const usedPct = info?.used_pct ?? 0;

  return (
    <AppLayout>
      <div className="usage-wrap" style={{ padding: "30px 38px 48px", maxWidth: 720, margin: "0 auto" }}>
        <div className="cl-mono" style={{ fontSize: 12, letterSpacing: ".12em", color: "var(--text-tertiary)", marginBottom: 7 }}>
          {info?.tierLabel?.toUpperCase() || "YOUR PLAN"}
        </div>
        <h1 className="cl-disp" style={{ fontSize: 30, fontWeight: 700, margin: "0 0 24px", color: "var(--text-primary)" }}>
          Usage
        </h1>

        {loading ? (
          <div className="skeleton" style={{ height: 170, borderRadius: 18, marginBottom: 18 }} />
        ) : error ? (
          <div className="cl-card" style={{ borderRadius: 18, padding: 28, textAlign: "center", marginBottom: 18 }}>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
              Could not load your usage right now.
            </p>
            <button onClick={load} className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 11 }}>
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div
              className="cl-card"
              style={{ borderRadius: 18, padding: "26px 24px", marginBottom: 18, position: "relative", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", right: -50, top: -50, width: 220, height: 220, background: "radial-gradient(circle, rgba(170,255,0,.10), transparent 65%)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <div className="flex" style={{ alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <span className="cl-mono" style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, color: barColor(usedPct) }}>
                    {usedPct}%
                  </span>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>used</span>
                </div>
                <div style={{ height: 9, background: "var(--surface-elevated)", borderRadius: 99, overflow: "hidden", margin: "12px 0 10px" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, usedPct)}%`,
                      background: barColor(usedPct),
                      borderRadius: 99,
                      transition: "width .6s cubic-bezier(.34,1.56,.64,1)",
                    }}
                  />
                </div>
                <div className="flex" style={{ justifyContent: "space-between", fontSize: 12.5, color: "var(--text-tertiary)", flexWrap: "wrap", gap: 6 }}>
                  <span>{info?.remaining_pct ?? 100}% remaining</span>
                  {info?.resets_at ? (
                    <span>
                      Resets in <span className="cl-mono" style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{formatCountdown(info.resets_at, now)}</span>
                      {" · "}
                      {new Date(info.resets_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : (
                    <span>Your 24-hour window starts with your first prompt.</span>
                  )}
                </div>
              </div>
            </div>

            {/* How usage works */}
            <div className="cl-card" style={{ borderRadius: 18, padding: 24, marginBottom: 18 }}>
              <div className="cl-disp" style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 6 }}>
                How usage works
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 16 }}>
                Your usage window opens the moment you send your first prompt and fully resets 24 hours later.
                Each kind of prompt uses a slice of the window:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: MessageSquare, label: "Text prompt", desc: "Questions, food by text, workout logging", pct: info?.costs.text ?? 8 },
                  { icon: Camera, label: "Photo scan", desc: "Food photo analysis", pct: info?.costs.image ?? 10 },
                  { icon: Video, label: "Video analysis", desc: "Gym form checks and video logging", pct: info?.costs.video ?? 20 },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center"
                    style={{ gap: 13, padding: "12px 14px", borderRadius: 12, background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)" }}
                  >
                    <span style={{ flex: "none", width: 34, height: 34, borderRadius: 9, background: "var(--surface-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lime-600)" }}>
                      <row.icon size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{row.label}</span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginTop: 1 }}>{row.desc}</span>
                    </span>
                    <span className="cl-mono" style={{ flex: "none", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                      {row.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan */}
            <div className="cl-card" style={{ borderRadius: 18, padding: 24 }}>
              <div className="flex items-center" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="cl-disp" style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
                    {info?.tierLabel || "Free Plan"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 3 }}>
                    Premium gets 5× more usage and no ads — coming soon.
                  </div>
                </div>
                <Link href="/profile" style={{ fontSize: 13, fontWeight: 600, color: "var(--lime-600)" }}>
                  Back to profile →
                </Link>
              </div>
            </div>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center" style={{ gap: 8, color: "var(--text-tertiary)", fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> Loading usage…
          </div>
        )}

        <style jsx>{`
          @media (max-width: 720px) {
            .usage-wrap { padding: 20px 16px 40px !important; }
          }
        `}</style>
      </div>
    </AppLayout>
  );
}
