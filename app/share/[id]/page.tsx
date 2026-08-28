"use client";
/**
 * Public view of a shared chat: /share/<id>.
 *
 * Readable signed out — the unguessable id is the capability. Signing in turns
 * the snapshot into a real conversation in the reader's own account, which is
 * what "continue this chat" means; the original is never touched.
 */
import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { useTheme } from "next-themes";
import { ArrowRight, Loader2, MessageSquareOff, Moon, Sun } from "lucide-react";
import { BrandMark } from "../../../components/AppLayout";
import FoodScanCard from "../../../components/FoodScanCard";
import { useAuth } from "../../../lib/AuthContext";
import { getShare, saveConversation, type SharedChatRecord } from "../../../lib/user-data";
import type { FoodScanResult } from "../../../lib/schemas/food-scan";

/** Only the fields the read-only transcript needs — cards stay interactive-free. */
interface SharedMessage {
  role: "user" | "ai";
  text?: string;
  scan?: FoodScanResult;
}

const markdownComponents: Components = {
  h1: (props) => <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-text)", marginBottom: 8, fontFamily: "var(--font-display)" }} {...props} />,
  h2: (props) => <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--accent-text)", marginBottom: 8, fontFamily: "var(--font-display)" }} {...props} />,
  strong: (props) => <span style={{ fontWeight: 700, color: "var(--accent-text)" }} {...props} />,
  ul: (props) => <ul style={{ listStyleType: "disc", paddingLeft: 16, marginBottom: 8 }} {...props} />,
  li: (props) => <li style={{ marginBottom: 4 }} {...props} />,
  p: (props) => <p style={{ marginBottom: 8 }} {...props} />,
};

export default function SharedChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading } = useAuth() as {
    user: { uid?: string } | null;
    loading: boolean;
  };

  const [share, setShare] = React.useState<SharedChatRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [continuing, setContinuing] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const shareId = typeof params?.id === "string" ? params.id : "";

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!shareId) return;
    let cancelled = false;
    getShare(shareId)
      .then((record) => {
        if (!cancelled) {
          setShare(record);
          setLoading(false);
        }
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const messages = (share?.messages ?? []) as SharedMessage[];

  const handleContinue = async () => {
    if (!share) return;
    // Signed out: land back here after login so the button does what it says.
    if (!user?.uid) {
      router.push(`/login?next=${encodeURIComponent(`/share/${shareId}`)}`);
      return;
    }
    setContinuing(true);
    const now = new Date().toISOString();
    const saved = await saveConversation({
      user_id: user.uid,
      title: share.title || "Shared chat",
      preview: messages.findLast?.((m) => m.role === "ai")?.text?.slice(0, 120) ?? "",
      messages: share.messages,
      created_at: now,
      updated_at: now,
    });
    if (saved?.id) router.push(`/?c=${saved.id}`);
    else setContinuing(false);
  };

  return (
    <div className="cl-shareview">
      {/* ── Header ── */}
      <header className="cl-shareview__bar">
        <Link href="/" className="flex items-center" style={{ gap: 10, textDecoration: "none" }}>
          <BrandMark size={26} id="lg-share" />
          <span className="brand-wordmark" style={{ fontSize: 19, color: "var(--text-primary)" }}>
            calo<span style={{ color: "var(--accent)" }}>lean</span>
          </span>
        </Link>
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="btn-icon"
            style={{ width: 36, height: 36 }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}
      </header>

      <main className="cl-shareview__body">
        {loading || authLoading ? (
          <div className="flex items-center justify-center" style={{ gap: 10, padding: "80px 0" }}>
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Loading shared chat…</span>
          </div>
        ) : !share ? (
          <div className="cl-card" style={{ textAlign: "center", padding: "40px 24px", maxWidth: 440, margin: "60px auto" }}>
            <span className="cl-shareview__emptyicon">
              <MessageSquareOff size={24} />
            </span>
            <h1 className="cl-disp" style={{ fontSize: 21, fontWeight: 700, margin: "0 0 8px", color: "var(--text-primary)" }}>
              This link isn&apos;t available
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", margin: "0 0 20px" }}>
              The chat may have been unshared, or the link is incomplete.
            </p>
            <Link href="/" className="btn-primary" style={{ display: "inline-block" }}>
              Go to Calolean
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 22 }}>
              <div className="cl-mono" style={{ fontSize: 11.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>
                Shared chat{share.owner_name ? ` · by ${share.owner_name}` : ""}
              </div>
              <h1 className="cl-disp" style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700, margin: 0, color: "var(--text-primary)", lineHeight: 1.15 }}>
                {share.title || "Calolean chat"}
              </h1>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}
                    style={msg.role === "user" ? undefined : { borderLeft: "2px solid var(--accent)" }}
                  >
                    {msg.scan ? (
                      // No onAdd — a reader can't log someone else's meal.
                      <FoodScanCard scan={msg.scan} showAd={false} />
                    ) : (
                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                        <ReactMarkdown components={markdownComponents}>{msg.text || ""}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Continue CTA ── */}
            <div className="cl-shareview__cta">
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="cl-disp" style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                  Carry this on in your own Calolean
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text-secondary)", margin: 0 }}>
                  {user?.uid
                    ? "We'll copy this chat into your history so you can keep asking."
                    : "Sign in and we'll copy this chat into your history so you can keep asking."}
                </p>
              </div>
              <button
                onClick={handleContinue}
                disabled={continuing}
                className="btn-primary flex items-center"
                style={{ gap: 8, flex: "none", opacity: continuing ? 0.65 : 1 }}
              >
                {continuing ? <Loader2 size={16} className="animate-spin" /> : null}
                {continuing ? "Opening…" : user?.uid ? "Continue this chat" : "Sign in to continue"}
                {!continuing && <ArrowRight size={16} />}
              </button>
            </div>
          </>
        )}
      </main>

      <style jsx>{`
        .cl-shareview {
          display: flex;
          flex-direction: column;
          min-height: var(--app-vh);
          background: var(--bg-app);
          color: var(--text-primary);
        }
        .cl-shareview__bar {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 20px;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border-color);
        }
        .cl-shareview__body {
          flex: 1;
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          padding: 28px 20px 48px;
        }
        .cl-shareview__emptyicon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          margin-bottom: 14px;
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          color: var(--accent-text);
        }
        .cl-shareview__cta {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
          padding: 20px;
          border-radius: 18px;
          background: var(--surface-card);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-card);
        }
      `}</style>
    </div>
  );
}
