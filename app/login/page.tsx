"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { Eye, EyeOff, Activity, Utensils, Dumbbell, Sun, Moon, Mail, Smartphone } from "lucide-react";
import { useTheme } from "next-themes";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"email" | "phone">("email");
  // phone flow
  const [phoneCode, setPhoneCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  // email-link flow

  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Tear the reCAPTCHA widget down when the page unmounts so re-renders /
  // client navigations never leave a stale verifier behind.
  React.useEffect(() => {
    return () => {
      try {
        verifierRef.current?.clear();
      } catch {
        /* already cleared */
      }
      verifierRef.current = null;
    };
  }, []);

  const friendlyAuthError = React.useCallback((err: unknown) => {
    const authError = err as { code?: string; message?: string };
    const code = authError?.code || "";
    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      return "Your browser blocked the Google sign-in popup. We switched Google sign-in to a redirect flow.";
    }
    if (code === "auth/unauthorized-domain") {
      return "Google sign-in is not enabled for this domain in Firebase Authentication.";
    }
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      return "Email or password is incorrect.";
    }
    return authError?.message?.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]+\)\.?$/, "") || "Sign in failed. Please try again.";
  }, []);

  const friendlyPhoneError = React.useCallback(
    (err: unknown) => {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/invalid-phone-number" || code === "auth/missing-phone-number") {
        return "That phone number doesn't look valid. Include the country code, e.g. +91 98765 43210.";
      }
      if (code === "auth/invalid-verification-code") {
        return "That code isn't right. Double-check the 6 digits and try again.";
      }
      if (code === "auth/code-expired") {
        return "That code has expired. Tap Resend code to get a new one.";
      }
      if (code === "auth/too-many-requests") {
        return "Too many attempts. Please wait a few minutes before trying again.";
      }
      if (code === "auth/quota-exceeded") {
        return "SMS limit reached for now. Please try again later or sign in another way.";
      }
      // Surface the project the bundle is actually talking to: this error means
      // the Phone provider is off for THAT project, which is usually a
      // different one from the console tab that's open.
      if (code === "auth/operation-not-allowed" || code === "auth/billing-not-enabled") {
        const project = auth.app.options.projectId || "unknown";
        return `Phone sign-in is disabled for Firebase project "${project}" (${code}). Enable the Phone provider for that exact project, then reload.`;
      }
      // Classic reCAPTCHA/App Check failure — distinct from a disabled provider.
      if (code === "auth/invalid-app-credential" || code === "auth/captcha-check-failed") {
        const domain = auth.app.options.authDomain || "unknown";
        return `Couldn't verify this site with reCAPTCHA (${code}). Add this domain to Firebase Authentication → Settings → Authorized domains (auth domain: ${domain}).`;
      }
      return code ? `${friendlyAuthError(err)} (${code})` : friendlyAuthError(err);
    },
    [friendlyAuthError]
  );

  const resetRecaptcha = () => {
    try {
      verifierRef.current?.clear();
    } catch {
      /* already cleared */
    }
    verifierRef.current = null;
    if (recaptchaRef.current) recaptchaRef.current.innerHTML = "";
  };

  /**
   * Where to land after a successful sign-in. `?next=` lets flows like a shared
   * chat link send the user back where they started; it is restricted to
   * same-origin paths so the parameter can't be used as an open redirect.
   */
  const landingPath = () => {
    try {
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    } catch {
      /* noop */
    }
    return "/";
  };

  const getVerifier = () => {
    if (!verifierRef.current && recaptchaRef.current) {
      verifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, { size: "invisible" });
    }
    return verifierRef.current;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push(landingPath());
    } catch (err: unknown) {
      setError(friendlyAuthError(err));
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push(landingPath());
    } catch (err: unknown) {
      setError(friendlyAuthError(err));
    }
  };

  const handleSendOtp = async () => {
    setError("");
    const raw = (phoneCode.trim() + phoneNumber).replace(/[\s()-]/g, "");
    const e164 = raw.startsWith("+") ? raw : "+" + raw;
    if (!/^\+\d{7,15}$/.test(e164)) {
      setError("Enter a valid phone number, e.g. +91 98765 43210.");
      return;
    }
    setPhoneLoading(true);
    try {
      const verifier = getVerifier();
      if (!verifier) throw new Error("reCAPTCHA is not ready. Please try again.");
      confirmationRef.current = await signInWithPhoneNumber(auth, e164, verifier);
      setSentTo(e164);
      setOtp("");
      setOtpSent(true);
    } catch (err: unknown) {
      resetRecaptcha();
      setError(friendlyPhoneError(err));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    if (!confirmationRef.current) {
      setError("Please request a new code.");
      setOtpSent(false);
      return;
    }
    setPhoneLoading(true);
    try {
      await confirmationRef.current.confirm(otp);
      router.push(landingPath());
    } catch (err: unknown) {
      setError(friendlyPhoneError(err));
      setPhoneLoading(false);
    }
  };

  const features = [
    { icon: Activity, t: "Advanced Tracking", s: "Monitor your calories, macros, and activity in real-time." },
    { icon: Utensils, t: "AI Nutrition Analysis", s: "Snap a photo and get instant nutritional breakdown." },
    { icon: Dumbbell, t: "On-device Form Analysis", s: "AI-powered exercise form correction to prevent injuries." },
  ];

  return (
    <div className="cl-auth" style={{ background: "var(--bg-app)" }}>
      {/* ── Brand panel ── */}
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
        {/* radial glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(680px 460px at 18% 30%,color-mix(in srgb, var(--accent) 16%, transparent),transparent 60%),radial-gradient(600px 600px at 90% 90%,rgba(77,158,255,.10),transparent 55%)",
          }}
        />
        {/* faint grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)",
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(620px 620px at 30% 40%,#000,transparent 75%)",
            WebkitMaskImage: "radial-gradient(620px 620px at 30% 40%,#000,transparent 75%)",
          }}
        />

        <div style={{ position: "relative" }}>
          {/* brand mark + wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 54 }}>
            <svg width="32" height="32" viewBox="0 0 100 100" aria-hidden>
              {/* Panel is dark in both themes, so the mark keeps its dark-mode variant */}
              <mask id="lg-auth">
                <rect width="100" height="100" fill="black" />
                <circle cx="50" cy="50" r="42" fill="white" />
                <circle cx="77" cy="23" r="27" fill="black" />
              </mask>
              <circle cx="50" cy="50" r="42" fill="var(--brand-panel-accent)" mask="url(#lg-auth)" />
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

          {/* headline */}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 46,
              lineHeight: 1.05,
              fontWeight: 700,
              color: "var(--brand-panel-text)",
              margin: "0 0 18px",
              maxWidth: "9ch",
            }}
          >
            Train smart. Eat clean.
          </h1>

          {/* mono kicker */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 48 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: ".18em",
                color: "var(--brand-panel-accent)",
              }}
            >
              GET LEANER, FASTER
            </span>
          </div>

          {/* feature rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 380 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span
                  style={{
                    flex: "none",
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "color-mix(in srgb, var(--brand-panel-accent) 14%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--brand-panel-accent) 30%, transparent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--brand-panel-accent)",
                  }}
                >
                  <f.icon size={20} />
                </span>
                <div>
                  <div style={{ color: "var(--brand-panel-text)", fontWeight: 600, fontSize: 15 }}>{f.t}</div>
                  <div style={{ color: "var(--brand-panel-muted)", fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>{f.s}</div>
                </div>
              </div>
            ))}
          </div>
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
        {/* Theme toggle - top right */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            style={{
              position: "absolute",
              top: 26,
              right: 28,
              width: 42,
              height: 42,
              borderRadius: 12,
              border: "1px solid var(--border-color)",
              background: "var(--surface-card)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        <div style={{ width: "100%", maxWidth: 420 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 700,
              margin: "0 0 8px",
              color: "var(--text-primary)",
            }}
          >
            Welcome back, athlete
          </h2>
          <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", fontSize: 15 }}>
            Your goals are waiting.
          </p>

          {/* Method toggle: Email | Phone */}
          <div
            role="tablist"
            aria-label="Sign-in method"
            style={{
              display: "flex",
              gap: 6,
              padding: 4,
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => {
                  setMethod(m);
                  setError("");
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "9px 0",
                  borderRadius: 9,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  background: method === m ? "var(--lime-400)" : "transparent",
                  color: method === m ? "var(--on-accent)" : "var(--text-secondary)",
                  transition: "background .15s, color .15s",
                }}
              >
                {m === "email" ? <Mail size={15} /> : <Smartphone size={15} />}
                {m === "email" ? "Email" : "Phone"}
              </button>
            ))}
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(255, 77, 77, 0.1)",
                border: "1px solid rgba(255, 77, 77, 0.3)",
                color: "var(--error)",
                fontSize: 13,
                textAlign: "center",
                marginBottom: 18,
              }}
            >
              {error}
            </div>
          )}

          {method === "email" && (
            <form onSubmit={handleEmailLogin}>
              {/* Email */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 7,
                }}
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cl-input"
                placeholder="you@example.com"
                style={{ marginBottom: 18 }}
              />

              {/* Password */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 7,
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--lime-600)" }}
                >
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: "relative", marginBottom: 26 }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="cl-input"
                  style={{ paddingRight: 46 }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Sign In Button */}
              <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                Sign In
              </button>

            </form>
          )}

          {method === "phone" && !otpSent && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 7,
                }}
              >
                Phone number
              </label>
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <input
                  type="tel"
                  aria-label="Country code"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value.replace(/[^\d+]/g, "").slice(0, 5))}
                  className="cl-input"
                  style={{ width: 84, flex: "none", textAlign: "center" }}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s-]/g, ""))}
                  className="cl-input"
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={phoneLoading}
                className="btn-primary"
                style={{ width: "100%", opacity: phoneLoading ? 0.7 : 1 }}
              >
                {phoneLoading ? "Sending OTP…" : "Send OTP"}
              </button>
              <p style={{ margin: "14px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-tertiary)", textAlign: "center" }}>
                We&apos;ll text you a 6-digit code.
              </p>
            </div>
          )}

          {method === "phone" && otpSent && (
            <div>
              <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-secondary)" }}>
                Enter the 6-digit code sent to{" "}
                <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{sentTo}</strong>
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="cl-input"
                style={{
                  textAlign: "center",
                  letterSpacing: "0.45em",
                  fontSize: 20,
                  fontFamily: "var(--font-mono)",
                  marginBottom: 20,
                }}
              />
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={phoneLoading}
                className="btn-primary"
                style={{ width: "100%", opacity: phoneLoading ? 0.7 : 1 }}
              >
                {phoneLoading ? "Verifying…" : "Verify & Sign In"}
              </button>
              <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                    setError("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  Change number
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={phoneLoading}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--lime-600)",
                    opacity: phoneLoading ? 0.6 : 1,
                  }}
                >
                  Resend code
                </button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "24px 0" }}>
            <span style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
              or continue with
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
          </div>

          {/* Google Button */}
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="cl-card-hover"
            style={{
              width: "100%",
              padding: 13,
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              color: "var(--text-primary)",
              fontWeight: 500,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.9 10.9 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
            </svg>
            Continue with Google
          </button>

          {/* Footer */}
          <p
            style={{
              textAlign: "center",
              margin: "26px 0 0",
              fontSize: 14,
              color: "var(--text-secondary)",
            }}
          >
            No account?{" "}
            <Link href="/signup" style={{ color: "var(--lime-600)", fontWeight: 700 }}>
              Sign up
            </Link>
          </p>
        </div>

        {/* Invisible reCAPTCHA mount point (always in the DOM so the verifier
            survives method toggling and re-renders) */}
        <div ref={recaptchaRef} />
      </div>
    </div>
  );
}
