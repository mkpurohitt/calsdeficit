"use client";
import React from "react";
import { MessageSquare, Utensils, ShoppingBag, Dumbbell, User, Sun, Moon, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "../lib/AuthContext";
import ChatHistory from "./ChatHistory";

/** Calolean brand mark — masked-disc logo from the v2 design export.
 * Colors come from --logo-disc/--logo-dot so it adapts to light/dark. */
export function BrandMark({ size = 28, id = "lg" }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <mask id={id}>
        <rect width="100" height="100" fill="black" />
        <circle cx="50" cy="50" r="42" fill="white" />
        <circle cx="77" cy="23" r="27" fill="black" />
      </mask>
      <circle cx="50" cy="50" r="42" fill="var(--logo-disc)" mask={`url(#${id})`} />
      <circle cx="77" cy="23" r="10.5" fill="var(--logo-dot)" />
    </svg>
  );
}

const NAV_ITEMS = [
  { name: "Home", mobileName: "Home", href: "/", icon: MessageSquare },
  { name: "Diet", mobileName: "Diet", href: "/diet", icon: Utensils },
  { name: "Shop", mobileName: "Shop", href: "/shop", icon: ShoppingBag },
  { name: "Exercise", mobileName: "Exercise", href: "/exercise", icon: Dumbbell },
  { name: "Profile", mobileName: "You", href: "/profile", icon: User },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth() as { user: { displayName?: string | null; email?: string | null } | null };
  const [mounted, setMounted] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Close the mobile drawer whenever the route changes (tapping a chat).
  React.useEffect(() => setDrawerOpen(false), [pathname]);

  // Lock background scroll and allow Escape to dismiss while the drawer is open.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

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
          <BrandMark size={28} id="lg-side" />
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
                  background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
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

        {/* Past conversations (Claude-style) — desktop rail */}
        <ChatHistory />

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
                color: "var(--on-accent)",
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
          <span className="flex items-center" style={{ gap: 6 }}>
            <button
              onClick={() => setDrawerOpen(true)}
              className="btn-icon"
              style={{ width: 36, height: 36, marginLeft: -6 }}
              aria-label="Open chat history"
              aria-expanded={drawerOpen}
            >
              <Menu size={20} />
            </button>
            <BrandMark size={24} id="lg-top" />
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

      {/* ── Mobile chat drawer (same history UI as the desktop rail) ── */}
      {drawerOpen && (
        <div
          className="cl-drawer-root"
          style={{ position: "fixed", inset: 0, zIndex: 90 }}
          role="dialog"
          aria-modal="true"
          aria-label="Chat history"
        >
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", animation: "cl-fade .18s ease" }}
          />
          <aside
            style={{
              position: "absolute",
              inset: "0 auto 0 0",
              width: "min(310px, 86vw)",
              background: "var(--bg-sidebar)",
              borderRight: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              padding: "16px 14px",
              animation: "cl-slide-in .22s cubic-bezier(.22,1,.36,1)",
            }}
          >
            <div className="flex items-center justify-between" style={{ paddingBottom: 6 }}>
              <Link href="/" onClick={() => setDrawerOpen(false)} style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
                <BrandMark size={24} id="lg-drawer" />
                <span className="brand-wordmark" style={{ fontSize: 18, color: "var(--text-primary)" }}>
                  calo<span style={{ color: "var(--lime-400)" }}>lean</span>
                </span>
              </Link>
              <button onClick={() => setDrawerOpen(false)} className="btn-icon" style={{ width: 34, height: 34 }} aria-label="Close chat history">
                <X size={18} />
              </button>
            </div>

            <ChatHistory onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

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
        .cl-newchat {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 8px;
          color: var(--text-secondary); text-decoration: none;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .cl-newchat:hover { background: var(--surface-elevated); color: var(--text-primary); }
        .cl-chatrow a { transition: background 0.12s ease, color 0.12s ease; }
        .cl-chatrow a:hover { background: var(--surface-elevated); color: var(--text-primary); }
        .cl-chats > div:last-child::-webkit-scrollbar { width: 6px; }
        .cl-chats > div:last-child::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 99px; }
        @keyframes cl-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cl-slide-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .cl-menuitem { transition: background 0.12s ease; }
        .cl-menuitem:hover { background: var(--surface-elevated); }
        .cl-chatmenu { opacity: 0; transition: opacity 0.12s ease, background 0.12s ease; }
        .cl-chatrow:hover .cl-chatmenu { opacity: 1; }
        .cl-chatmenu:hover { background: var(--surface-elevated); color: var(--text-primary); }
        /* The drawer is mobile-only; a desktop resize must not leave it open. */
        .cl-drawer-root { display: block; }
        @media (min-width: 861px) { .cl-drawer-root { display: none; } }
        /* Touch devices have no hover, so the row menu button is always visible. */
        @media (hover: none) { .cl-chatmenu { opacity: 1; } }
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
