"use client";

import { useState } from "react";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { auth } from "../../../lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

export default function PrivacySecurityPage() {
  const { user } = useAuth() as { user: { email?: string | null } | null };
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setMessage("Your account has no email (Google sign-in) — manage your password in your Google account.");
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage(`Password reset link sent to ${user.email}.`);
    } catch {
      setMessage("Could not send the reset email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl space-y-6">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>
            Privacy &amp; Security
          </h1>

          <div className="space-y-4" style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            <p className="flex items-start gap-2">
              <ShieldCheck size={18} style={{ color: "var(--lime-400)", marginTop: 2, flexShrink: 0 }} />
              Sign-in is handled by Firebase Authentication. Your nutrition logs, workout logs, goals,
              and preferences are stored in your private space in Firebase Firestore, protected by
              security rules so only your account can access them.
            </p>
            <p className="flex items-start gap-2">
              <ShieldCheck size={18} style={{ color: "var(--lime-400)", marginTop: 2, flexShrink: 0 }} />
              Workout videos for form analysis are processed entirely on your device — only an
              anonymized joint-angle summary is sent to our AI for scoring. Food photos are compressed
              on your device before analysis and are not stored.
            </p>
            <p className="flex items-start gap-2">
              <ShieldCheck size={18} style={{ color: "var(--lime-400)", marginTop: 2, flexShrink: 0 }} />
              You can export your data as CSV or delete your account at any time from the Profile page.
            </p>
          </div>
        </div>

        <div className="cl-card" style={{ borderRadius: 20, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Password</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            We&apos;ll email you a secure link to change your password.
          </p>
          <button onClick={handlePasswordReset} disabled={sending} className="btn-secondary flex items-center gap-2">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            Send password reset email
          </button>
          {message && <p style={{ fontSize: 13, color: "var(--lime-400)", marginTop: 12, fontWeight: 600 }}>{message}</p>}
        </div>
      </div>
    </AppLayout>
  );
}
