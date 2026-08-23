"use client";
/**
 * Set a new password after signing in through an email link.
 *
 * The forgot-password flow deliberately uses the email SIGN-IN link rather than
 * Firebase's reset email: the link already proves control of the address, and
 * signing the user in first means `updatePassword` can be called directly. It
 * also means one email template to keep out of spam instead of two.
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updatePassword } from "firebase/auth";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { auth } from "../../../lib/firebase";
import { useAuth } from "../../../lib/AuthContext";
import { BrandMark } from "../../../components/AppLayout";

const MIN_LENGTH = 8;

export default function NewPasswordPage() {
  const router = useRouter();
  const { user, loading } = useAuth() as { user: { email?: string | null } | null; loading: boolean };
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Only reachable while signed in — the email link is what authorises this.
  useEffect(() => {
    if (!loading && !user) router.replace("/forgot-password");
  }, [loading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Both passwords must match.");
      return;
    }
    const current = auth.currentUser;
    if (!current) {
      setError("Your sign-in link expired. Request a new one.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(current, password);
      setDone(true);
      setTimeout(() => router.replace("/"), 1400);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/requires-recent-login") {
        setError("For security this link is too old. Request a fresh email and try again.");
      } else if (code === "auth/weak-password") {
        setError("That password is too weak — mix in numbers or symbols.");
      } else {
        setError(
          (err as { message?: string })?.message?.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]+\)\.?$/, "") ||
            "Could not update your password. Please try again."
        );
      }
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-app)" }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--bg-app)", color: "var(--text-primary)", padding: 20 }}
    >
      <div className="flex items-center" style={{ gap: 10, marginBottom: 26 }}>
        <BrandMark size={28} id="lg-newpass" />
        <span className="brand-wordmark" style={{ fontSize: 21 }}>
          calo<span style={{ color: "var(--accent)" }}>lean</span>
        </span>
      </div>

      <div className="cl-card" style={{ width: "100%", maxWidth: 400, padding: "28px 26px" }}>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <span
              style={{
                display: "inline-flex",
                width: 52,
                height: 52,
                borderRadius: 16,
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-text)",
                marginBottom: 14,
              }}
            >
              <ShieldCheck size={24} />
            </span>
            <h1 className="cl-disp" style={{ fontSize: 21, fontWeight: 700, margin: "0 0 6px" }}>
              Password updated
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Taking you to your dashboard…</p>
          </div>
        ) : (
          <>
            <h1 className="cl-disp" style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>
              Set a new password
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", margin: "0 0 20px" }}>
              You&apos;re signed in as <strong style={{ color: "var(--text-primary)" }}>{user.email}</strong>. Choose a
              password you&apos;ll use from now on.
            </p>

            {error && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "11px 14px",
                  borderRadius: 10,
                  background: "rgba(231, 76, 60, 0.1)",
                  border: "1px solid rgba(231, 76, 60, 0.3)",
                  color: "var(--error)",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              <label className="cl-label" htmlFor="new-pass">
                New password
              </label>
              <div style={{ position: "relative", marginBottom: 14 }}>
                <input
                  id="new-pass"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  className="cl-input"
                  placeholder={`Min. ${MIN_LENGTH} characters`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: "100%", paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-tertiary)",
                    display: "flex",
                  }}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <label className="cl-label" htmlFor="confirm-pass">
                Confirm password
              </label>
              <input
                id="confirm-pass"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                className="cl-input"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={{ width: "100%", marginBottom: 18 }}
              />

              <button
                type="submit"
                className="btn-primary"
                disabled={busy}
                style={{ width: "100%", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Saving…" : "Save password"}
              </button>
            </form>

            <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
              Happy as you are?{" "}
              <Link href="/" style={{ color: "var(--accent-text)", fontWeight: 600 }}>
                Skip for now
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
