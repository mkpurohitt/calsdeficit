"use client";
/**
 * Password recovery via email SIGN-IN link.
 *
 * Firebase's own reset email wasn't reaching inboxes, while the sign-in-link
 * template was — so this sends the link instead. Clicking it signs the user in
 * (which already proves control of the address) and /auth/verify then forwards
 * them to /auth/new-password to choose a new one.
 *
 * The screen looks identical whether or not the address is registered, so it
 * can't be used to enumerate accounts.
 */
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sendSignInLinkToEmail } from "firebase/auth";
import { useTheme } from "next-themes";
import { ArrowLeft, MailCheck, Moon, Sun } from "lucide-react";
import { auth } from "../../lib/firebase";

/** Resend guard — Firebase rate-limits, and rapid taps just burn the quota. */
const RESEND_SECONDS = 45;

export default function ForgotPasswordPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    const address = email.trim();
    if (!/\S+@\S+\.\S+/.test(address)) {
      setError("Enter the email address you signed up with.");
      return;
    }
    setBusy(true);
    try {
      await sendSignInLinkToEmail(auth, address, {
        // Land on the verifier, which completes sign-in then hands off to the
        // set-password step.
        url: `${window.location.origin}/auth/verify?next=/auth/new-password`,
        handleCodeInApp: true,
      });
      // /auth/verify reads this so the user isn't re-prompted for their address.
      window.localStorage.setItem("calolean_email_for_signin", address);
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      // Never reveal whether an address is registered.
      if (code === "auth/user-not-found") {
        setSent(true);
        setCooldown(RESEND_SECONDS);
      } else if (code === "auth/operation-not-allowed") {
        const project = auth.app.options.projectId || "unknown";
        setError(
          `Email-link sign-in is disabled for Firebase project "${project}". Enable it under Authentication → Sign-in method → Email/Password → Email link.`
        );
      } else if (code === "auth/invalid-email") {
        setError("That email address doesn't look valid.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Wait a few minutes and try again.");
      } else if (code === "auth/network-request-failed") {
        setError("Network problem — check your connection and try again.");
      } else {
        setError(
          (err as { message?: string })?.message?.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]+\)\.?$/, "") ||
            "Could not send the reset email. Please try again."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cl-auth" style={{ background: "var(--bg-app)" }}>
      {/* ── Brand panel (dark in both themes, like login/signup) ── */}
      <div
        className="cl-brand"
        style={{
          position: "relative",
          overflow: "hidden",
          minWidth: 0,
          background: "var(--brand-panel)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px 72px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(680px 460px at 18% 30%,color-mix(in srgb, var(--accent) 16%, transparent),transparent 60%)",
          }}
        />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
            <svg width="32" height="32" viewBox="0 0 100 100" aria-hidden>
              <mask id="lg-forgot">
                <rect width="100" height="100" fill="black" />
                <circle cx="50" cy="50" r="42" fill="white" />
                <circle cx="77" cy="23" r="27" fill="black" />
              </mask>
              <circle cx="50" cy="50" r="42" fill="var(--brand-panel-accent)" mask="url(#lg-forgot)" />
              <circle cx="77" cy="23" r="10.5" fill="var(--brand-panel-text)" />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-.5px",
                color: "var(--brand-panel-text)",
              }}
            >
              calo<span style={{ color: "var(--brand-panel-accent)" }}>lean</span>
            </span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 44,
              lineHeight: 1.06,
              fontWeight: 700,
              color: "var(--brand-panel-text)",
              margin: "0 0 16px",
              maxWidth: "11ch",
            }}
          >
            Back to your streak.
          </h1>
          <p style={{ color: "var(--brand-panel-muted)", fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}>
            Reset your password and pick up right where you left off — your logs, plan and history are all still here.
          </p>
        </div>
      </div>

      {/* ── Form side ── */}
      <div
        className="cl-authpad"
        style={{
          position: "relative",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "48px 56px",
          background: "var(--bg-app)",
        }}
      >
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="btn-icon"
            style={{ position: "absolute", top: 26, right: 26, width: 40, height: 40 }}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        <div style={{ width: "100%", maxWidth: 400 }}>
          {sent ? (
            <div className="cl-card" style={{ textAlign: "center", padding: "32px 24px" }}>
              <span
                style={{
                  display: "inline-flex",
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-text)",
                  marginBottom: 14,
                }}
              >
                <MailCheck size={24} />
              </span>
              <h2
                className="cl-disp"
                style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--text-primary)" }}
              >
                Check your inbox
              </h2>
              <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                We&apos;ve sent a secure sign-in link to{" "}
                <strong style={{ color: "var(--text-primary)" }}>{email.trim()}</strong>. Open it on this device — it
                signs you in and takes you straight to setting a new password.
              </p>
              <p style={{ margin: "0 0 20px", fontSize: 12.5, lineHeight: 1.6, color: "var(--text-tertiary)" }}>
                Nothing yet? Check spam — and make sure you used the address you signed up with.
              </p>

              <button
                type="button"
                onClick={() => submit()}
                disabled={busy || cooldown > 0}
                className="btn-secondary"
                style={{ width: "100%", opacity: busy || cooldown > 0 ? 0.55 : 1 }}
              >
                {busy ? "Resending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
              </button>

              <Link
                href="/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 16,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                }}
              >
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 22,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                }}
              >
                <ArrowLeft size={15} /> Back to sign in
              </Link>

              <h1
                className="cl-disp"
                style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px", color: "var(--text-primary)" }}
              >
                Forgot your password?
              </h1>
              <p style={{ margin: "0 0 26px", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                Enter your email and we&apos;ll send you a secure sign-in link. Open it and you can set a new password
                right away — no old password needed.
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
                <label className="cl-label" htmlFor="reset-email">
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  className="cl-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", marginBottom: 18 }}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy}
                  style={{ width: "100%", opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? "Sending…" : "Email me a sign-in link"}
                </button>
              </form>

              <p style={{ marginTop: 18, fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
                Signed up with Google or a phone number?{" "}
                <Link href="/login" style={{ color: "var(--accent-text)", fontWeight: 600 }}>
                  Use that instead
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
