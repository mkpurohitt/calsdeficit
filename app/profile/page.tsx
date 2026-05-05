"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/AppLayout";
import { useAuth } from "../../lib/AuthContext";
import { auth } from "../../lib/firebase";
import { getFoodLogs, getStepSync, getDateKey } from "../../lib/user-data";
import { Bell, ChevronRight, CreditCard, Crown, Download, ExternalLink, Flame, LogOut, Shield, Trash2, User, Settings } from "lucide-react";

interface ProfileItem {
  icon: typeof User;
  label: string;
  href: string | null;
  subtitle?: string;
}

export default function ProfilePage() {
  const { user } = useAuth() as { user: { uid?: string; email?: string | null; displayName?: string | null; metadata?: { creationTime?: string } } | null };
  const router = useRouter();

  const [todayScans, setTodayScans] = useState(0);
  const [promptsUsed, setPromptsUsed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [fitStatus, setFitStatus] = useState("Manual sync ready");

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";
  const userName = user?.displayName || "Fitness Enthusiast";
  const userEmail = user?.email || "user@calolean.app";
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Recently";

  useEffect(() => {
    if (!user?.uid) return;

    const loadProfile = async () => {
      const logs = await getFoodLogs(user.uid!);
      const todayKey = getDateKey();
      const todayLogs = logs.filter((log) => log.date_key === todayKey);
      setTodayScans(todayLogs.length);

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

      const stepSync = await getStepSync(user.uid!, todayKey);
      if (stepSync?.source === "google-fit") {
        setFitStatus("Connected");
      }

      try {
        const res = await fetch(`/api/limit?userId=${user.uid}`);
        if (res.ok) {
          const limitData = await res.json();
          if (limitData.success) {
            setPromptsUsed(limitData.used);
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
        { icon: ExternalLink, label: "Google Fit", href: "/profile/google-fit", subtitle: fitStatus },
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

            <div className="cl-card-accent" style={{ borderRadius: 20, padding: 24 }}>
              <div className="flex items-center gap-2 mb-4">
                <Crown size={18} style={{ color: "var(--lime-400)" }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Free Plan</span>
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>AI Prompts used today</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{promptsUsed}/10</span>
                </div>
                <div className="macro-bar__track">
                  <div className="macro-bar__fill" style={{ width: `${Math.min((promptsUsed / 10) * 100, 100)}%`, background: "var(--lime-400)" }} />
                </div>
              </div>

              <button className="btn-primary w-full" style={{ height: 48, fontSize: 14 }}>
                Upgrade to Pro
              </button>
            </div>
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
              <button className="flex items-center justify-center gap-2" style={{ padding: "14px 20px", borderRadius: "var(--radius-lg)", background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-tertiary)", fontSize: 14, fontWeight: 500 }}>
                <Trash2 size={16} /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
