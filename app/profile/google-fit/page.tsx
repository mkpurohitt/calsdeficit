"use client";

import { useEffect, useState } from "react";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { getDateKey, getStepSync, saveStepSync } from "../../../lib/user-data";

export default function GoogleFitPage() {
  const { user } = useAuth() as { user: { uid?: string } | null };
  const [steps, setSteps] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    getStepSync(user.uid, getDateKey()).then((record) => setSteps(record?.steps || 0));
  }, [user]);

  const handleSave = async () => {
    if (!user?.uid) return;
    await saveStepSync({
      user_id: user.uid,
      date_key: getDateKey(),
      steps,
      source: "manual",
      fit_status: "manual_only",
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Google Fit</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
            Google has deprecated new Google Fit API registrations. This app keeps your activity flow working by letting you save today&apos;s step count here, which feeds the exercise dashboard immediately.
          </p>
          <div>
            <label className="cl-label">Today&apos;s Steps</label>
            <input className="cl-input" type="number" value={steps} onChange={(event) => setSteps(Number(event.target.value))} />
          </div>
          <button className="btn-primary mt-4" onClick={handleSave}>Save Steps</button>
          {saved && <p style={{ fontSize: 13, color: "var(--lime-400)", marginTop: 12 }}>Steps saved for today.</p>}
        </div>
      </div>
    </AppLayout>
  );
}

