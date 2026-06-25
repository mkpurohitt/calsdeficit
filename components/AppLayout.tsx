"use client";
import React from "react";
import { MessageSquare, Utensils, ShoppingBag, Dumbbell, User, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "../lib/AuthContext";

/** Calolean brand mark (from the design export). */
function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <rect width="512" height="512" rx="120" fill="#13171F" />
      <path
        d="M340 178c-20-26-52-42-88-42-62 0-110 50-110 120s48 120 110 120c36 0 68-16 88-42"
        fill="none"
        stroke="var(--lime-400)"
        strokeWidth="52"
        strokeLinecap="round"
      />
      <circle cx="356" cy="256" r="30" fill="var(--lime-400)" />
    </svg>
  );
}

const NAV_ITEMS = [
  { name: "Home", mobileName: "Home", href: "/", icon: MessageSquare },
  { name: "Diet", mobileName: "Diet", href: "/diet", icon: Utensils },
  { name: "Exercise", mobileName: "Train", href: "/exercise", icon: Dumbbell },
  { name: "Shop", mobileName: "Shop", href: "/shop", icon: ShoppingBag },
  { name: "Profile", mobileName: "You", href: "/profile", icon: User },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth() as { user: { displayName?: string | null; email?: string | null } | null };
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";
  const userName = user?.displayName || user?.email?.split("@")[0] || "User";

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <div className="flex" style={{ minHeight: "100vh", background: "var(--bg-app)", color: "var(--text-primary)" }}>

      {/* ── Desktop Sidebar ── */}
      <aside
        className="cl-sidebar"
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          width: 252,
          flex: "none",
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          padding: "22px 16px",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 10px 26px", textDecoration: "none" }}>
          <BrandMark size={28} />
          <span className="brand-wordmark" style={{ fontSize: 21, color: "var(--text-primary)" }}>
            calo<span style={{ color: "var(--lime-400)" }}>lean</span>
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center"
                style={{
                  gap: 13,
                  padding: "11px 13px",
                  borderRadius: 11,
                  fontWeight: 500,
                  fontSize: 15,
                  textDecoration: "none",
                  color: active ? "var(--lime-400)" : "var(--text-secondary)",
                  background: active ? "rgba(170,255,0,0.10)" : "transparent",
                  boxShadow: active ? "inset 3px 0 0 var(--lime-400)" : "inset 3px 0 0 transparent",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "var(--surface-elevated)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
              >
                <item.icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom user card */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <Link
            href="/profile"
            className="flex items-center"
            style={{
              gap: 11,
              padding: 9,
              borderRadius: 12,
              textDecoration: "none",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-card)",
            }}
          >
            <span
              className="flex items-center justify-center"
              style={{
                flex: "none",
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--lime-400), #72B800)",
                fontWeight: 700,
                color: "#0A0C0F",
                fontSize: 14,
              }}
            >
              {userInitial}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="truncate" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {userName}
              </span>
              <span style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)" }}>Free plan</span>
            </span>
            {mounted && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleTheme();
                }}
                aria-label="Toggle theme"
                style={{
                  flex: "none",
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "none",
                  background: "var(--surface-elevated)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            )}
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1" style={{ minWidth: 0, height: "100vh", overflowY: "auto" }}>
        {/* Mobile top bar */}
        <div
          className="cl-mobiletop flex items-center justify-between px-4 sticky top-0 z-30"
          style={{
            height: 56,
            background: "var(--bg-sidebar)",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <span className="flex items-center" style={{ gap: 9 }}>
            <BrandMark size={24} />
            <span className="brand-wordmark" style={{ fontSize: 19, color: "var(--text-primary)" }}>
              calo<span style={{ color: "var(--lime-400)" }}>lean</span>
            </span>
          </span>
          {mounted && (
            <button onClick={toggleTheme} className="btn-icon" style={{ width: 36, height: 36 }} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
        </div>

        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="cl-mobilebar fixed bottom-0 w-full flex justify-around items-center z-50"
        style={{
          height: 66,
          background: "var(--bg-sidebar)",
          borderTop: "1px solid var(--border-color)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center"
              style={{
                gap: 3,
                fontSize: 10,
                fontWeight: active ? 600 : 500,
                textDecoration: "none",
                color: active ? "var(--lime-400)" : "var(--text-tertiary)",
                transition: "color 0.15s ease",
              }}
            >
              <item.icon size={22} />
              <span>{item.mobileName}</span>
            </Link>
          );
        })}
      </nav>

      {/* Responsive rules: hide sidebar on mobile, hide mobile chrome on desktop */}
      <style>{`
        .cl-mobiletop { display: none; }
        .cl-mobilebar { display: none; }
        @media (max-width: 860px) {
          .cl-sidebar { display: none !important; }
          .cl-mobiletop { display: flex !important; }
          .cl-mobilebar { display: flex !important; }
          main { padding-bottom: 80px; }
        }
      `}</style>
    </div>
  );
}
