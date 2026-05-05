"use client";

import AppLayout from "../../../components/AppLayout";

export default function PrivacySecurityPage() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Privacy & Security</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Your account uses Firebase Authentication for sign-in. Nutrition logs, workout logs, preferences, and manual step sync stay tied to your account data so the app can restore your progress across sessions.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

