"use client";

import { useEffect, useState } from "react";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { getNotificationPreferences, saveNotificationPreferences } from "../../../lib/user-data";

export default function NotificationsPage() {
  const { user } = useAuth() as { user: { uid?: string } | null };
  const [prefs, setPrefs] = useState({ meal_reminders: true, workout_reminders: true, weekly_summary: true });

  useEffect(() => {
    if (!user?.uid) return;
    getNotificationPreferences(user.uid).then((data) => setPrefs({
      meal_reminders: data.meal_reminders,
      workout_reminders: data.workout_reminders,
      weekly_summary: data.weekly_summary,
    }));
  }, [user]);

  const handleToggle = async (key: keyof typeof prefs) => {
    if (!user?.uid) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await saveNotificationPreferences({ user_id: user.uid, ...next });
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Notification Settings</h1>
          <div className="space-y-4">
            {[
              ["Meal reminders", "meal_reminders"],
              ["Workout reminders", "workout_reminders"],
              ["Weekly summary", "weekly_summary"],
            ].map(([label, key]) => (
              <button key={key} onClick={() => handleToggle(key as keyof typeof prefs)} className="cl-card flex items-center justify-between w-full" style={{ padding: "16px 20px", borderRadius: 16 }}>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{label}</span>
                <span style={{ color: prefs[key as keyof typeof prefs] ? "var(--lime-400)" : "var(--text-tertiary)", fontWeight: 700 }}>
                  {prefs[key as keyof typeof prefs] ? "On" : "Off"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

