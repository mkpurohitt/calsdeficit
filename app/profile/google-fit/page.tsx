"use client";

import { Suspense, useEffect, useState } from "react";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { getDateKey, getDay, getUserGoal, saveDay } from "../../../lib/user-data";
import { STEP_GOAL } from "../../../lib/config/app";
import { Check, Footprints, Loader2, Plus, Smartphone } from "lucide-react";

function StepsContent() {
  const { user } = useAuth() as { user: { uid?: string } | null };

  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(STEP_GOAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    Promise.all([getDay(user.uid, getDateKey()), getUserGoal(user.uid)]).then(([day, goal]) => {
      if (day?.steps) setSteps(day.steps);
      if (goal?.step_goal) setStepGoal(goal.step_goal);
      setLoading(false);
    });
  }, [user]);

  const persist = async (value: number) => {
    const next = Math.max(0, Math.round(value));
    setSteps(next);
    if (!user?.uid) return;
    setSaving(true);
    try {
      await saveDay(user.uid, getDateKey(), { steps: next, steps_source: "manual" });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } finally {
      setSaving(false);
    }
  };

  const pct = Math.min(100, Math.round((steps / stepGoal) * 100));

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--lime-400)" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "30px 38px 48px", maxWidth: 640, margin: "0 auto" }}>
      <div className="cl-mono" style={{ fontSize: 12, letterSpacing: ".12em", color: "var(--text-tertiary)", marginBottom: 7 }}>
        ACTIVITY
      </div>
      <h1 className="cl-disp" style={{ fontSize: 30, fontWeight: 700, margin: "0 0 24px", color: "var(--text-primary)" }}>
        Daily Steps
      </h1>

      {/* Today's steps */}
      <section className="cl-card" style={{ borderRadius: 18, padding: 24, marginBottom: 18 }}>
        <div className="flex items-center" style={{ gap: 14, marginBottom: 18 }}>
          <span
            style={{
              flex: "none",
              width: 46,
              height: 46,
              borderRadius: 12,
              background: "rgba(77,158,255,.12)",
              color: "var(--info)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Footprints size={22} />
          </span>
          <div>
            <div className="cl-mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
              {steps.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>
              of {stepGoal.toLocaleString()} steps today
            </div>
          </div>
        </div>

        <div style={{ height: 8, background: "var(--surface-elevated)", borderRadius: 99, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "var(--info)", borderRadius: 99, transition: "width .5s ease" }} />
        </div>

        {/* Manual input */}
        <label className="cl-label">Set today&apos;s step count</label>
        <div className="flex items-center" style={{ gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input
            type="number"
            value={steps}
            min={0}
            onChange={(e) => setSteps(Math.max(0, parseInt(e.target.value || "0", 10)))}
            className="cl-input"
            style={{ maxWidth: 200 }}
          />
          <button
            onClick={() => persist(steps)}
            disabled={saving}
            className="btn-primary flex items-center"
            style={{ gap: 8, borderRadius: 11, opacity: saving ? 0.7 : 1 }}
          >
            {saved ? <Check size={16} /> : saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saved ? "Saved" : "Save"}
          </button>
        </div>

        {/* Quick add */}
        <div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>
          {[500, 1000, 2500, 5000].map((n) => (
            <button
              key={n}
              onClick={() => persist(steps + n)}
              className="flex items-center"
              style={{
                gap: 5,
                padding: "8px 14px",
                borderRadius: 99,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
              }}
            >
              <Plus size={13} /> {n.toLocaleString()}
            </button>
          ))}
        </div>
      </section>

      {/* Auto-sync note */}
      <div
        className="flex items-start"
        style={{
          gap: 12,
          padding: "16px 18px",
          borderRadius: 14,
          background: "var(--surface-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <Smartphone size={18} style={{ color: "var(--text-tertiary)", flex: "none", marginTop: 2 }} />
        <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Automatic step sync is coming with the Calolean mobile app.</span>{" "}
          Apple Health and Android Health Connect only expose step data to installed apps, not websites — so for now, log your steps here and they&apos;ll power your Exercise activity ring.
        </div>
      </div>
    </div>
  );
}

export default function StepsPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-8" style={{ color: "var(--text-secondary)" }}>Loading…</div>}>
        <StepsContent />
      </Suspense>
    </AppLayout>
  );
}
