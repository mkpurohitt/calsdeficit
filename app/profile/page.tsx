"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/AppLayout";
import UpgradeBadge from "../../components/UpgradeBadge";
import { useAuth } from "../../lib/AuthContext";
import { auth } from "../../lib/firebase";
import { apiFetch } from "../../lib/api-client";
import { getFoodLogs, getDay, getDateKey, getDateKeyDaysAgo } from "../../lib/user-data";
import type { Tier } from "../../lib/entitlements";
import { deleteUser } from "firebase/auth";
import { Bell, ChevronRight, CreditCard, Download, ExternalLink, Flame, LogOut, Shield, Trash2, User, Settings } from "lucide-react";

interface ProfileItem {
  icon: typeof User;
  label: string;
  href: string | null;
  subtitle?: string;
}

export default function ProfilePage() {
  const { user } = useAuth() as { user: { uid?: string; email?: string | null; displayName?: string | null; metadata?: { creationTime?: string } } | null };
  const router = useRouter();

  const [promptsUsed, setPromptsUsed] = useState(0);
  const [promptLimit, setPromptLimit] = useState(10);
  const [tier, setTier] = useState<Tier>("free");
  const [streak, setStreak] = useState(0);
  const [fitStatus, setFitStatus] = useState("Not connected");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";
  const userName = user?.displayName || "Fitness Enthusiast";
  const userEmail = user?.email || "user@calolean.app";
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Recently";

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

      const day = await getDay(user.uid!, todayKey);
      if (day?.steps_source === "google-health") {
        setFitStatus("Connected");
      }

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
    };

    loadProfile();
  }, [user]);

  const sections: { title: string; items: ProfileItem[] }[] = [
    {
      title: "Personal Goals",
      items: [
        { icon: User, label: "Personal Information", href: "/profile/personal-info" },
        { icon: Settings, label: "Edit TDEE & Macros", href: "/profile/goals" },
      ],
    },
    {
      title: "Notifications",
      items: [
        { icon: Bell, label: "Notification Settings", href: "/profile/notifications" },
      ],
    },
    {
      title: "Connected Apps",
      items: [
        { icon: ExternalLink, label: "Google Health", href: "/profile/google-fit", subtitle: fitStatus },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: Download, label: "Export Data (CSV)", href: "/profile/export" },
        { icon: Shield, label: "Privacy & Security", href: "/profile/privacy-security" },
        { icon: CreditCard, label: "Subscription & Billing", href: null },
      ],
    },
  ];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="space-y-6">
            <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28, textAlign: "center" }}>
              <div className="mx-auto mb-4" style={{ width: 80, height: 80, borderRadius: "var(--radius-full)", background: "var(--lime-400)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0C0F", fontSize: 28, fontWeight: 700, fontFamily: "var(--font-display)" }}>
                {userInitial}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{userName}</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>{userEmail}</p>
              <div className="inline-flex items-center gap-2 mx-auto" style={{ padding: "6px 14px", borderRadius: "var(--radius-full)", background: "rgba(255, 184, 0, 0.1)", border: "1px solid rgba(255, 184, 0, 0.2)", color: "var(--warning)", fontSize: 13, fontWeight: 600 }}>
                <Flame size={14} /> {streak} days
              </div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 12 }}>Member since {memberSince}</p>
            </div>

            <UpgradeBadge tier={tier} used={promptsUsed} limit={promptLimit} />
          </div>

          <div className="lg:col-span-2 space-y-6">
            {sections.map((section) => (
              <div key={section.title}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {section.title}
                </h3>
                <div className="cl-card" style={{ borderRadius: "var(--radius-lg)", padding: 0, overflow: "hidden" }}>
                  {section.items.map((item, index) => {
                    const content = (
                      <>
                        <div className="flex items-center gap-4">
                          <item.icon size={18} style={{ color: "var(--text-tertiary)" }} />
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.label}</span>
                            {item.subtitle && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{item.subtitle}</p>}
                          </div>
                        </div>
                        <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
                      </>
                    );

                    return item.href ? (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center justify-between"
                        style={{ padding: "14px 20px", borderBottom: index < section.items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        key={item.label}
                        className="flex items-center justify-between"
                        style={{ padding: "14px 20px", borderBottom: index < section.items.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: 0.6 }}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Legal
              </h3>
              <div className="cl-card" style={{ borderRadius: "var(--radius-lg)", padding: "14px 20px" }}>
                <div className="flex items-center gap-6">
                  <Link href="/profile/privacy-policy" style={{ fontSize: 13, color: "var(--lime-400)", fontWeight: 500 }}>Privacy Policy</Link>
                  <Link href="/profile/terms" style={{ fontSize: 13, color: "var(--lime-400)", fontWeight: 500 }}>Terms of Service</Link>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>v1.0.0</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  auth.signOut();
                  router.push("/login");
                }}
                className="flex-1 flex items-center justify-center gap-2"
                style={{ padding: "14px 20px", borderRadius: "var(--radius-lg)", background: "transparent", border: "1px solid rgba(255, 77, 77, 0.3)", color: "var(--error)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                <LogOut size={18} /> Sign Out
              </button>
              <button
                onClick={async () => {
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
                }}
                className="flex items-center justify-center gap-2"
                style={{ padding: "14px 20px", borderRadius: "var(--radius-lg)", background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-tertiary)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                <Trash2 size={16} /> Delete Account
              </button>
            </div>
            {deleteError && (
              <p style={{ fontSize: 13, color: "var(--error)", fontWeight: 600 }}>{deleteError}</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
