"use client";
import React from "react";
import { MessageSquare, Utensils, ShoppingBag, Dumbbell, User, Settings, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "../lib/AuthContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth() as { user: any };
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const navItems = [
    { name: "Home", href: "/", icon: MessageSquare },
    { name: "Diet", href: "/diet", icon: Utensils },
    { name: "Exercise", href: "/exercise", icon: Dumbbell },
    { name: "Shop", href: "/shop", icon: ShoppingBag },
    { name: "Profile", href: "/profile", icon: User },
  ];

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";
  const userName = user?.displayName || user?.email?.split("@")[0] || "User";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}>
      
      {/* ── Desktop Sidebar ── */}
      <nav
        className="hidden md:flex flex-col fixed left-0 top-0 h-full z-40"
        style={{
          width: 240,
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-color)",
        }}
      >
        {/* Logo Area */}
        <div className="flex items-center px-6" style={{ height: 64 }}>
          <span className="brand-wordmark" style={{ fontSize: 22 }}>
            <span style={{ color: "var(--text-primary)" }}>calo</span>
            <span style={{ color: "var(--lime-400)" }}>lean</span>
          </span>
        </div>

        {/* Nav Items */}
        <div className="flex-1 px-3 mt-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 relative"
                style={{
                  height: 48,
                  padding: "0 16px",
                  borderRadius: isActive ? "0 var(--radius-md) var(--radius-md) 0" : "var(--radius-md)",
                  background: isActive ? "rgba(170, 255, 0, 0.08)" : "transparent",
                  color: isActive ? "var(--lime-400)" : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 15,
                  borderLeft: isActive ? "3px solid var(--lime-400)" : "3px solid transparent",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "var(--surface-elevated)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
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
        </div>

        {/* Bottom Section — User + Settings */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            height: 64,
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-full)",
              background: "var(--lime-400)",
              color: "#0A0C0F",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "var(--font-sans)",
            }}
          >
            {userInitial}
          </div>
          <span
            className="flex-1 truncate"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
          >
            {userName}
          </span>
          
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="btn-icon"
              style={{ width: 32, height: 32, border: "none", background: "transparent" }}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main
        className="flex-1 overflow-y-auto relative"
        style={{ marginLeft: 240, paddingBottom: 0 }}
      >
        {/* Mobile top bar with theme toggle */}
        <div
          className="md:hidden flex items-center justify-between px-4 sticky top-0 z-30"
          style={{
            height: 56,
            background: "var(--bg-sidebar)",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <span className="brand-wordmark" style={{ fontSize: 20 }}>
            <span style={{ color: "var(--text-primary)" }}>calo</span>
            <span style={{ color: "var(--lime-400)" }}>lean</span>
          </span>
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="btn-icon"
              style={{ width: 36, height: 36 }}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
        </div>

        {/* Hide margin on mobile */}
        <style>{`
          @media (max-width: 767px) {
            main { margin-left: 0 !important; padding-bottom: 80px !important; }
          }
        `}</style>
        
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="md:hidden fixed bottom-0 w-full flex justify-around items-center z-50"
        style={{
          height: 68,
          background: "var(--bg-sidebar)",
          borderTop: "1px solid var(--border-color)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2 px-3"
              style={{
                color: isActive ? "var(--lime-400)" : "var(--text-tertiary)",
                fontSize: 10,
                fontWeight: isActive ? 600 : 500,
                transition: "color 0.15s ease",
              }}
            >
              <item.icon size={22} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}