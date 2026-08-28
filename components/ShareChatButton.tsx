"use client";
/**
 * "Share" affordance for any AI output — a chat turn, a food scan, a form
 * check. Publishing copies the messages into a public `shares/<id>` snapshot,
 * so the recipient sees a frozen transcript they can open without an account
 * and continue in their own once they sign in.
 *
 * The snapshot is a copy on purpose: the owner can keep talking, rename, or
 * delete the original chat without changing what a link already handed out
 * shows.
 */
import React from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Link2, Loader2, Share2, X } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { createShare } from "../lib/user-data";

export default function ShareChatButton({
  messages,
  title,
  label = "Share",
  compact = true,
}: {
  /** Serialized messages to snapshot — same shape the chat persists. */
  messages: unknown[];
  title: string;
  label?: string;
  /** Compact renders as a small ghost row button (used under chat bubbles). */
  compact?: boolean;
}) {
  const { user } = useAuth() as {
    user: { uid?: string; displayName?: string | null; email?: string | null } | null;
  };
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const publish = async () => {
    if (!user?.uid || busy) return;
    setBusy(true);
    setError("");
    setOpen(true);
    try {
      const id = await createShare({
        owner_uid: user.uid,
        owner_name: user.displayName || user.email?.split("@")[0] || "",
        title: title || "Calolean chat",
        messages,
        created_at: new Date().toISOString(),
      });
      if (!id) throw new Error("no id");
      const link = `${window.location.origin}/share/${id}`;
      setUrl(link);
      // Offer the OS share sheet where there is one — on a phone that is the
      // natural way to send a link, and it saves a copy-then-paste round trip.
      if (navigator.share) {
        try {
          await navigator.share({ title: title || "Calolean chat", url: link });
        } catch {
          /* dismissed — the dialog still has the link */
        }
      }
    } catch {
      setError("Couldn't create the link. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy failed — select the link and copy it manually.");
    }
  };

  const close = () => {
    setOpen(false);
    setUrl("");
    setError("");
  };

  // Signed-out users have nothing to publish from.
  if (!user?.uid) return null;

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="cl-share-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Share this chat"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div className="cl-share-card">
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span className="flex items-center" style={{ gap: 9 }}>
                  <span className="cl-share-icon">
                    <Link2 size={17} />
                  </span>
                  <span
                    className="cl-disp"
                    style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}
                  >
                    Share this chat
                  </span>
                </span>
                <button onClick={close} className="btn-icon" style={{ width: 32, height: 32 }} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)", margin: "0 0 16px" }}>
                Anyone with the link can read this conversation and carry it on in their own
                Calolean. Your other chats and logs stay private.
              </p>

              {busy ? (
                <div className="flex items-center justify-center" style={{ gap: 9, padding: "22px 0" }}>
                  <Loader2 size={17} className="animate-spin" style={{ color: "var(--accent)" }} />
                  <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>Creating link…</span>
                </div>
              ) : error ? (
                <div className="cl-share-error">{error}</div>
              ) : (
                <>
                  <div className="cl-share-linkrow">
                    <span className="cl-share-link" title={url}>
                      {url}
                    </span>
                    <button onClick={copy} className="cl-share-copy" aria-label="Copy link">
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  {typeof navigator !== "undefined" && "share" in navigator && (
                    <button
                      onClick={() => navigator.share?.({ title, url }).catch(() => {})}
                      className="btn-secondary"
                      style={{ width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      <Share2 size={15} /> Share via…
                    </button>
                  )}
                </>
              )}
            </div>

            <style jsx>{`
              .cl-share-backdrop {
                position: fixed;
                inset: 0;
                z-index: 200;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(0, 0, 0, 0.55);
                backdrop-filter: blur(6px);
                animation: cl-share-fade 0.16s ease;
              }
              .cl-share-card {
                width: 100%;
                max-width: 420px;
                max-height: calc(var(--app-vh) - 36px);
                overflow-y: auto;
                padding: 20px;
                border-radius: 18px;
                background: var(--surface-card);
                border: 1px solid var(--border-color);
                box-shadow: var(--shadow-card);
                animation: cl-share-pop 0.22s cubic-bezier(0.34, 1.4, 0.64, 1);
              }
              .cl-share-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 34px;
                height: 34px;
                border-radius: 11px;
                background: color-mix(in srgb, var(--accent) 13%, transparent);
                color: var(--accent-text);
              }
              .cl-share-linkrow {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 8px 8px 12px;
                border-radius: 12px;
                background: var(--surface-elevated);
                border: 1px solid var(--border-subtle);
              }
              .cl-share-link {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-family: var(--font-mono);
                font-size: 12.5px;
                color: var(--text-secondary);
              }
              .cl-share-copy {
                flex: none;
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 13px;
                border: none;
                border-radius: 9px;
                background: var(--accent);
                color: var(--on-accent);
                font-size: 12.5px;
                font-weight: 700;
                font-family: inherit;
                cursor: pointer;
              }
              .cl-share-error {
                padding: 11px 14px;
                border-radius: 10px;
                background: rgba(231, 76, 60, 0.1);
                border: 1px solid rgba(231, 76, 60, 0.3);
                color: var(--error);
                font-size: 13px;
                line-height: 1.5;
              }
              @keyframes cl-share-fade {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes cl-share-pop {
                from { opacity: 0; transform: translateY(10px) scale(0.98); }
                to { opacity: 1; transform: none; }
              }
            `}</style>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        onClick={publish}
        className={compact ? "cl-sharebtn cl-sharebtn--compact" : "cl-sharebtn"}
        aria-label="Share this chat"
        title="Share this chat"
      >
        <Share2 size={compact ? 13 : 15} />
        {label}
      </button>
      {dialog}
      <style jsx>{`
        .cl-sharebtn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 11px;
          border: 1px solid var(--border-subtle);
          border-radius: 999px;
          background: transparent;
          color: var(--text-tertiary);
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
        }
        .cl-sharebtn:hover {
          background: var(--surface-elevated);
          color: var(--accent-text);
          border-color: var(--accent);
        }
        .cl-sharebtn--compact {
          padding: 5px 10px;
          font-size: 11.5px;
        }
      `}</style>
    </>
  );
}
