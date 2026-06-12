"use client";
import { RefreshCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 p-6"
      style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
    >
      <span className="brand-wordmark" style={{ fontSize: 26 }}>
        <span style={{ color: "var(--text-primary)" }}>calo</span>
        <span style={{ color: "var(--lime-400)" }}>lean</span>
      </span>
      <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)" }}>Something went wrong</h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", maxWidth: 360 }}>
        {error.message || "An unexpected error occurred. Your data is safe — try again."}
      </p>
      <button onClick={reset} className="btn-primary flex items-center gap-2" style={{ marginTop: 8 }}>
        <RefreshCw size={16} /> Try again
      </button>
    </div>
  );
}
