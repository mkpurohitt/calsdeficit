"use client";
import AppLayout from "../../components/AppLayout";
import { useAuth } from "../../lib/AuthContext";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import { Settings, User, Bell, Shield, CreditCard, LogOut, ChevronRight, Download, Trash2, ExternalLink, Flame, Crown } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth() as { user: any };
  const router = useRouter();

  const handleLogout = () => {
    auth.signOut();
    router.push("/login");
  };

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";
  const userName = user?.displayName || "Fitness Enthusiast";
  const userEmail = user?.email || "user@calolean.app";

  const settingsSections = [
    {
      title: "Personal Goals",
      items: [
        { icon: User, label: "Personal Information", hasChevron: true },
        { icon: Settings, label: "Edit TDEE & Macros", hasChevron: true },
      ],
    },
    {
      title: "Notifications",
      items: [
        { icon: Bell, label: "Notification Settings", hasChevron: true },
      ],
    },
    {
      title: "Connected Apps",
      items: [
        { icon: ExternalLink, label: "Google Fit", subtitle: "Last synced: 5 mins ago", hasChevron: true },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: Download, label: "Export Data (CSV)", hasChevron: false },
        { icon: Shield, label: "Privacy & Security", hasChevron: true },
        { icon: CreditCard, label: "Subscription & Billing", hasChevron: true },
      ],
    },
  ];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">

          {/* ── Left Column: User Card + Subscription ── */}
          <div className="space-y-6">
            {/* User Card */}
            <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28, textAlign: "center" }}>
              <div
                className="mx-auto mb-4"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "var(--radius-full)",
                  background: "var(--lime-400)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0A0C0F",
                  fontSize: 28,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                }}
              >
                {userInitial}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                {userName}
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                {userEmail}
              </p>
              
              {/* Streak */}
              <div
                className="inline-flex items-center gap-2 mx-auto"
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-full)",
                  background: "rgba(255, 184, 0, 0.1)",
                  border: "1px solid rgba(255, 184, 0, 0.2)",
                  color: "var(--warning)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Flame size={14} /> 7 days
              </div>

              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 12 }}>
                Member since April 2026
              </p>
            </div>

            {/* Subscription Card */}
            <div className="cl-card-accent" style={{ borderRadius: 20, padding: 24 }}>
              <div className="flex items-center gap-2 mb-4">
                <Crown size={18} style={{ color: "var(--lime-400)" }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Free Plan</span>
              </div>

              {/* Usage */}
              <div className="mb-4">
                <div className="flex justify-between mb-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>Food scans today</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>3/5</span>
                </div>
                <div className="macro-bar__track">
                  <div className="macro-bar__fill" style={{ width: "60%", background: "var(--lime-400)" }} />
                </div>
              </div>

              <button className="btn-primary w-full" style={{ height: 48, fontSize: 14 }}>
                Upgrade to Pro
              </button>

              <div className="mt-4 space-y-2">
                {["Unlimited food scans", "Advanced form analysis", "Priority support"].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--lime-400)" }}>✓</span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Column: Settings ── */}
          <div className="lg:col-span-2 space-y-6">
            {settingsSections.map((section, sIdx) => (
              <div key={sIdx}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {section.title}
                </h3>
                <div className="cl-card" style={{ borderRadius: "var(--radius-lg)", padding: 0, overflow: "hidden" }}>
                  {section.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between cursor-pointer"
                      style={{
                        padding: "14px 20px",
                        borderBottom: idx < section.items.length - 1 ? "1px solid var(--border-subtle)" : "none",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-elevated)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div className="flex items-center gap-4">
                        <item.icon size={18} style={{ color: "var(--text-tertiary)" }} />
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.label}</span>
                          {(item as any).subtitle && (
                            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{(item as any).subtitle}</p>
                          )}
                        </div>
                      </div>
                      {item.hasChevron && <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Legal */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Legal
              </h3>
              <div className="cl-card" style={{ borderRadius: "var(--radius-lg)", padding: "14px 20px" }}>
                <div className="flex items-center gap-6">
                  <a href="#" style={{ fontSize: 13, color: "var(--lime-400)", fontWeight: 500 }}>Privacy Policy</a>
                  <a href="#" style={{ fontSize: 13, color: "var(--lime-400)", fontWeight: 500 }}>Terms of Service</a>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>v1.0.0</span>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="flex gap-3">
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2"
                style={{
                  padding: "14px 20px",
                  borderRadius: "var(--radius-lg)",
                  background: "transparent",
                  border: "1px solid rgba(255, 77, 77, 0.3)",
                  color: "var(--error)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--error)"; e.currentTarget.style.color = "#FFFFFF"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--error)"; }}
              >
                <LogOut size={18} /> Sign Out
              </button>

              {/* Delete Account */}
              <button
                className="flex items-center justify-center gap-2"
                style={{
                  padding: "14px 20px",
                  borderRadius: "var(--radius-lg)",
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-tertiary)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Trash2 size={16} /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}