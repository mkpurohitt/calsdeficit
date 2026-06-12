"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { apiFetch } from "../../../lib/api-client";
import { getDateKey, getDay } from "../../../lib/user-data";
import { Activity, CheckCircle2, Link2, Loader2, RefreshCw, Unlink } from "lucide-react";

function GoogleHealthContent() {
  const { user } = useAuth() as { user: { uid?: string } | null };
  const searchParams = useSearchParams();
  const callbackStatus = searchParams.get("status");

  const [steps, setSteps] = useState<number | null>(null);
  const [connected, setConnected] = useState(callbackStatus === "connected");
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(
    callbackStatus === "connected"
      ? "Google Health connected! Sync your steps below."
      : callbackStatus === "denied"
        ? "You declined the Google Health permission."
        : callbackStatus && callbackStatus !== "connected"
          ? "Connection failed. Please try again."
          : null
  );

  useEffect(() => {
    if (!user?.uid) return;
    getDay(user.uid, getDateKey()).then((day) => {
      if (day) {
        setSteps(day.steps);
        if (day.steps_source === "google-health") setConnected(true);
      }
    });
  }, [user]);

  const handleConnect = async () => {
    setBusy("connect");
    setMessage(null);
    try {
      const res = await apiFetch("/api/health/connect");
      const json = await res.json();
      if (json.success && json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage(json.error || "Could not start the connection.");
    } catch {
      setMessage("Could not start the connection.");
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    setMessage(null);
    try {
      const res = await apiFetch("/api/health/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_key: getDateKey() }),
      });
      const json = await res.json();
      if (json.success) {
        setSteps(json.steps);
        setConnected(true);
        setMessage(`Synced ${Number(json.steps).toLocaleString()} steps for today.`);
      } else {
        setMessage(json.error || "Sync failed.");
      }
    } catch {
      setMessage("Sync failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    setBusy("disconnect");
    try {
      await apiFetch("/api/health/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", date_key: getDateKey() }),
      });
      setConnected(false);
      setMessage("Disconnected from Google Health.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "rgba(170, 255, 0, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Activity size={22} style={{ color: "var(--lime-400)" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>Google Health</h1>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {connected ? "Connected" : "Not connected"}
            </p>
          </div>
        </div>

        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 20 }}>
          Connect your Google account to automatically sync daily steps from your phone, Fitbit, or
          Pixel Watch via the Google Health API. Your step count powers the activity ring on the
          Exercise page. (Google Fit has been deprecated by Google — Google Health is its successor.)
        </p>

        {steps !== null && (
          <div
            className="flex items-center gap-3 mb-5"
            style={{
              padding: "14px 18px",
              borderRadius: "var(--radius-lg)",
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "var(--lime-400)" }}>
              {steps.toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>steps today</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {!connected ? (
            <button
              onClick={handleConnect}
              disabled={busy !== null}
              className="btn-primary flex items-center gap-2"
              style={{ opacity: busy ? 0.7 : 1 }}
            >
              {busy === "connect" ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              Connect Google Health
            </button>
          ) : (
            <>
              <button
                onClick={handleSync}
                disabled={busy !== null}
                className="btn-primary flex items-center gap-2"
                style={{ opacity: busy ? 0.7 : 1 }}
              >
                {busy === "sync" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Sync Today&apos;s Steps
              </button>
              <button
                onClick={handleDisconnect}
                disabled={busy !== null}
                className="btn-ghost flex items-center gap-2"
              >
                {busy === "disconnect" ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
                Disconnect
              </button>
            </>
          )}
        </div>

        {message && (
          <p className="flex items-center gap-2 mt-4" style={{ fontSize: 13, color: "var(--lime-400)", fontWeight: 600 }}>
            <CheckCircle2 size={14} /> {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default function GoogleHealthPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-8" style={{ color: "var(--text-secondary)" }}>Loading…</div>}>
        <GoogleHealthContent />
      </Suspense>
    </AppLayout>
  );
}
