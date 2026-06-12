"use client";

import { useState } from "react";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { auth } from "../../../lib/firebase";
import { updateProfile } from "firebase/auth";

export default function PersonalInfoPage() {
  const { user } = useAuth() as { user: { displayName?: string | null; email?: string | null } | null };
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const value = displayName ?? user?.displayName ?? "";

  const handleSave = async () => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Personal Information</h1>
          <div className="space-y-4">
            <div>
              <label className="cl-label">Display Name</label>
              <input className="cl-input" value={value} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
            <div>
              <label className="cl-label">Email Address</label>
              <input className="cl-input" value={user?.email || ""} readOnly />
            </div>
            <button className="btn-primary" onClick={handleSave}>Save Changes</button>
            {saved && <p style={{ fontSize: 13, color: "var(--lime-400)" }}>Profile updated.</p>}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

