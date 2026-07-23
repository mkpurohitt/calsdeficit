"use client";
import React from "react";
import { MessageSquare, Utensils, ShoppingBag, Dumbbell, User, Sun, Moon, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "../lib/AuthContext";
import { listConversations, deleteConversation, type ConversationMeta } from "../lib/user-data";

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

/** Desktop-sidebar chat history (Claude-style). Lists past Home conversations,
 * each opening `/?c=<id>` to continue with full context. Hidden on mobile via
 * `.cl-sidebar`. Stays in sync with the Home page via the
 * `calolean:conversations` window event (fired after every turn). */
function SidebarChats() {
  const { user } = useAuth() as { user: { uid?: string } | null };
  const router = useRouter();
  const [chats, setChats] = React.useState<ConversationMeta[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    if (!user?.uid) {
      setChats([]);
      return;
    }
    listConversations(user.uid).then(setChats).catch(() => {});
  }, [user]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // Initial active id from the URL (?c=…). Read client-side so AppLayout stays
  // free of useSearchParams (which would force a Suspense boundary everywhere).
  React.useEffect(() => {
    try {
      setActiveId(new URLSearchParams(window.location.search).get("c"));
    } catch {
      /* noop */
    }
  }, []);

  // Home fires this after each turn (new chat, updated preview, active change).
  React.useEffect(() => {
    const onConversations = (event: Event) => {
      const detail = (event as CustomEvent<{ activeId: string | null }>).detail;
      if (detail && "activeId" in detail) setActiveId(detail.activeId ?? null);
      refresh();
    };
    window.addEventListener("calolean:conversations", onConversations);
    return () => window.removeEventListener("calolean:conversations", onConversations);
  }, [refresh]);

  const handleDelete = async (id: string) => {
    if (!user?.uid) return;
    setChats((prev) => prev.filter((c) => c.id !== id)); // optimistic
    try {
      await deleteConversation(user.uid, id);
    } catch {
      /* noop */
    }
    if (id === activeId) {
      setActiveId(null);
      router.push("/");
    }
  };

  if (!user?.uid) return null;

  return (
    <div className="cl-chats" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, marginTop: 20 }}>
      <div className="flex items-center justify-between" style={{ padding: "0 11px 6px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--text-tertiary)" }}>
          Chats
        </span>
        <Link href="/" aria-label="New chat" title="New chat" className="cl-newchat">
          <Plus size={16} />
        </Link>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
        {chats.length === 0 ? (
          <div style={{ padding: "5px 12px", fontSize: 12.5, color: "var(--text-tertiary)" }}>No chats yet</div>
        ) : (
          chats.map((c) => {
            const active = c.id === activeId;
            return (
              <div key={c.id} className="cl-chatrow" style={{ position: "relative" }}>
                <Link
                  href={`/?c=${c.id}`}
                  className="flex items-center"
                  title={c.title || "New chat"}
                  style={{
                    gap: 9,
                    padding: "8px 32px 8px 11px",
                    borderRadius: 9,
                    textDecoration: "none",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: active ? 600 : 500,
                    ...(active ? { background: "var(--surface-elevated)" } : {}),
                  }}
                >
                  <MessageSquare size={14} style={{ flex: "none", color: active ? "var(--lime-400)" : "var(--text-tertiary)" }} />
                  <span className="truncate" style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
                    {c.title || "New chat"}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label="Delete chat"
                  className="cl-chatdel"
                  onClick={() => handleDelete(c.id)}
                  style={{
                    position: "absolute",
                    right: 5,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

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

        {/* Past conversations (Claude-style) — desktop only */}
        <SidebarChats />

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
        .cl-chatdel { opacity: 0; transition: opacity 0.12s ease, color 0.12s ease, background 0.12s ease; }
        .cl-chatrow:hover .cl-chatdel { opacity: 1; }
        .cl-chatdel:hover { color: var(--error); background: var(--surface-card); }
        .cl-chats > div:last-child::-webkit-scrollbar { width: 6px; }
        .cl-chats > div:last-child::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 99px; }
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
