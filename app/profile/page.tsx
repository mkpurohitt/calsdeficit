"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/AppLayout";
import { useAuth } from "../../lib/AuthContext";
import { auth } from "../../lib/firebase";
import { apiFetch } from "../../lib/api-client";
import {
  getFoodLogs,
  getDateKey,
  getDateKeyDaysAgo,
  getNotificationPreferences,
  saveNotificationPreferences,
} from "../../lib/user-data";
import type { Tier } from "../../lib/entitlements";
import { deleteUser } from "firebase/auth";
import { Award, ChevronRight, Download, LogOut, Settings, User, Activity } from "lucide-react";

type NotifPrefs = { meal_reminders: boolean; workout_reminders: boolean; weekly_summary: boolean };

const NOTIF_ROWS: { key: keyof NotifPrefs; label: string }[] = [
  { key: "meal_reminders", label: "Daily diary reminder" },
  { key: "workout_reminders", label: "Workout reminder" },
  { key: "weekly_summary", label: "Weekly progress report" },
];

export default function ProfilePage() {
  const { user } = useAuth() as { user: { uid?: string; email?: string | null; displayName?: string | null; metadata?: { creationTime?: string } } | null };
  const router = useRouter();

  const [promptsUsed, setPromptsUsed] = useState(0);
  const [promptLimit, setPromptLimit] = useState(10);
  const [tier, setTier] = useState<Tier>("free");
  const [streak, setStreak] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ meal_reminders: true, workout_reminders: true, weekly_summary: false });

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";
  const userName = user?.displayName || "Fitness Enthusiast";
  const userEmail = user?.email || "user@calolean.app";
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Recently";

  const usagePct = promptLimit > 0 ? Math.min(100, Math.round((promptsUsed / promptLimit) * 100)) : 0;

  useEffect(() => {
    if (!user?.uid) return;

    const loadProfile = async () => {
      const todayKey = getDateKey();
      const logs = await getFoodLogs(user.uid!, { from: getDateKeyDaysAgo(90), to: todayKey });

      let currentStreak = 0;
      for (let dayOffset = 0; dayOffset < 90; dayOffset += 1) {
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);
        const dayKey = getDateKey(date);
        const hasLogs = logs.some((log) => log.date_key === dayKey);
        if (hasLogs) {
          currentStreak += 1;
        } else if (dayOffset !== 0) {
          break;
        }
      }
      setStreak(currentStreak);

      try {
        const res = await apiFetch(`/api/limit`);
        if (res.ok) {
          const limitData = await res.json();
          if (limitData.success) {
            setPromptsUsed(limitData.used);
            setPromptLimit(limitData.limit);
            setTier(limitData.tier === "premium" ? "premium" : "free");
          }
        }
      } catch (err) {
        console.error("Error fetching limits:", err);
      }

      try {
        const prefs = await getNotificationPreferences(user.uid!);
        setNotifPrefs({
          meal_reminders: prefs.meal_reminders,
          workout_reminders: prefs.workout_reminders,
          weekly_summary: prefs.weekly_summary,
        });
      } catch (err) {
        console.error("Error fetching notification preferences:", err);
      }
    };

    loadProfile();
  }, [user]);

  const handleToggleNotif = async (key: keyof NotifPrefs) => {
    if (!user?.uid) return;
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    try {
      await saveNotificationPreferences({ user_id: user.uid, ...next });
    } catch (err) {
      console.error("Error saving notification preferences:", err);
    }
  };

  const handleSignOut = () => {
    auth.signOut();
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    const confirmed = window.confirm(
      "Delete your Calolean account permanently? Your logs and goals will no longer be accessible."
    );
    if (!confirmed) return;
    setDeleteError(null);
    try {
      await deleteUser(auth.currentUser);
      router.push("/signup");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setDeleteError(
        code === "auth/requires-recent-login"
          ? "For security, please log out, log back in, and try deleting again."
          : "Could not delete the account. Please try again."
      );
    }
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.1em",
    color: "var(--text-tertiary)",
    marginBottom: 11,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--surface-card)",
    border: "1px solid var(--border-color)",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "var(--shadow-card)",
  };

  const iconChipStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "var(--surface-elevated)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--lime-600)",
    flex: "none",
  };

  const goalRows: { icon: typeof User; label: string; href: string }[] = [
    { icon: User, label: "Personal Information", href: "/profile/personal-info" },
    { icon: Settings, label: "Edit TDEE & Macros", href: "/profile/goals" },
  ];

  return (
    <AppLayout>
      <div style={{ padding: "30px 38px 48px", maxWidth: 1380, margin: "0 auto" }}>
        <h1 className="cl-disp" style={{ fontSize: 30, fontWeight: 700, margin: "0 0 24px", color: "var(--text-primary)" }}>
          Profile
        </h1>

        <div className="profile-grid">
          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Avatar card */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--surface-card)", border: "1px solid var(--border-color)", borderRadius: 18, padding: "30px 24px", boxShadow: "var(--shadow-card)", textAlign: "center" }}>
              <div style={{ position: "absolute", left: "50%", top: -20, transform: "translateX(-50%)", width: 220, height: 160, background: "radial-gradient(circle,rgba(170,255,0,.16),transparent 65%)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <div className="cl-disp" style={{ width: 88, height: 88, borderRadius: "50%", margin: "0 auto 14px", background: "linear-gradient(135deg,var(--lime-400),var(--lime-600))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 700, color: "#0A0C0F" }}>
                  {userInitial}
                </div>
                <div className="cl-disp" style={{ fontSize: 21, fontWeight: 700, color: "var(--text-primary)" }}>{userName}</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", margin: "3px 0 14px" }}>{userEmail}</div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 15px", borderRadius: "var(--radius-full)", background: "rgba(255,184,0,.12)", color: "var(--warning)", fontSize: 13, fontWeight: 600 }}>
                  🔥 {streak} day streak
                </span>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 12 }}>Member since {memberSince}</div>
              </div>
            </div>

            {/* Plan + usage card (counts live on the Usage page, Claude-style) */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--surface-card)", border: "1px solid rgba(170,255,0,.3)", borderRadius: 18, padding: 24, boxShadow: "0 0 24px rgba(170,255,0,.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                <Award size={20} style={{ color: "var(--lime-400)" }} />
                <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
                  {tier === "premium" ? "Premium Plan" : "Free Plan"}
                </span>
              </div>

              <Link
                href="/profile/usage"
                className="cl-card-hover flex items-center"
                style={{
                  gap: 12,
                  padding: "13px 15px",
                  borderRadius: 12,
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  marginBottom: 18,
                }}
              >
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Usage</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {usagePct}% of your 24-hour window used
                  </span>
                </span>
                <ChevronRight size={17} style={{ color: "var(--text-tertiary)" }} />
              </Link>

              {tier !== "premium" && (
                <>
                  <Link
                    href="/profile/privacy-security"
                    className="btn-primary"
                    style={{ width: "100%", padding: 13, fontSize: 14, display: "block", textAlign: "center" }}
                  >
                    Upgrade to Premium
                  </Link>
                  <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)", marginTop: 12 }}>
                    5× more usage · no ads — coming soon
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — settings */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* PERSONAL GOALS */}
            <div>
              <div className="cl-mono" style={sectionLabelStyle}>PERSONAL GOALS</div>
              <div style={cardStyle}>
                {goalRows.map((row, index) => (
                  <Link
                    key={row.href}
                    href={row.href}
                    className="cl-card-hover"
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderBottom: index < goalRows.length - 1 ? "1px solid var(--border-subtle)" : "none", cursor: "pointer" }}
                  >
                    <span style={iconChipStyle}>
                      <row.icon size={18} />
                    </span>
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{row.label}</span>
                    <ChevronRight size={18} style={{ color: "var(--text-tertiary)" }} />
                  </Link>
                ))}
              </div>
            </div>

            {/* ACTIVITY — step counting arrives with the mobile app */}
            <div>
              <div className="cl-mono" style={sectionLabelStyle}>ACTIVITY</div>
              <div aria-disabled="true" style={{ ...cardStyle, overflow: "visible", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, userSelect: "none", cursor: "default" }}>
                <span style={{ ...iconChipStyle, color: "var(--text-tertiary)", opacity: 0.55 }}>
                  <Activity size={18} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-tertiary)" }}>Step counting</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>To count your steps, download our app — coming soon.</div>
                </div>
              </div>
            </div>

            {/* NOTIFICATIONS */}
            <div>
              <div className="cl-mono" style={sectionLabelStyle}>NOTIFICATIONS</div>
              <div style={cardStyle}>
                {NOTIF_ROWS.map((row, index) => {
                  const on = notifPrefs[row.key];
                  return (
                    <div
                      key={row.key}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderBottom: index < NOTIF_ROWS.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                    >
                      <span style={{ flex: 1, fontSize: 15, color: "var(--text-primary)" }}>{row.label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={row.label}
                        onClick={() => handleToggleNotif(row.key)}
                        className="cl-switch"
                        style={{ background: on ? "var(--lime-400)" : "var(--surface-hover)" }}
                      >
                        <span className="cl-switch__knob" style={{ left: on ? 21 : 3 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ACCOUNT */}
            <div>
              <div className="cl-mono" style={sectionLabelStyle}>ACCOUNT</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  href="/profile/export"
                  className="cl-card-hover"
                  style={{ flex: 1, minWidth: 150, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 14, background: "var(--surface-card)", border: "1px solid var(--border-color)", borderRadius: 13, color: "var(--text-primary)", fontWeight: 500, fontSize: 14, cursor: "pointer" }}
                >
                  <Download size={17} /> Export Data
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{ flex: 1, minWidth: 150, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 14, background: "transparent", border: "1px solid rgba(255,77,77,.4)", borderRadius: 13, color: "var(--error)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                >
                  <LogOut size={17} /> Sign Out
                </button>
              </div>
              <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 16, padding: "0 4px", flexWrap: "wrap" }}>
                <Link href="/profile/privacy-policy" style={{ fontSize: 13, fontWeight: 600, color: "var(--lime-600)", cursor: "pointer" }}>Privacy Policy</Link>
                <Link href="/profile/terms" style={{ fontSize: 13, fontWeight: 600, color: "var(--lime-600)", cursor: "pointer" }}>Terms of Service</Link>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                >
                  Delete Account
                </button>
                <span className="cl-mono" style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: "auto" }}>v1.0.0</span>
              </div>
              {deleteError && (
                <p style={{ fontSize: 13, color: "var(--error)", fontWeight: 600, marginTop: 12 }}>{deleteError}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .profile-grid {
          display: grid;
          grid-template-columns: 380px minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .profile-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </AppLayout>
  );
}
