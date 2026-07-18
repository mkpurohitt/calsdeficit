"use client";
import { useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendSignInLinkToEmail,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Activity, Utensils, Dumbbell, Sun, Moon, Check, Mail, Smartphone, MailCheck } from "lucide-react";
import { useTheme } from "next-themes";
import React from "react";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [method, setMethod] = useState<"email" | "phone">("email");
  // phone flow
  const [phoneCode, setPhoneCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  // email-link flow
  const [linkSent, setLinkSent] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

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
    if (authError.code === "auth/popup-blocked" || authError.code === "auth/cancelled-popup-request") {
      return "Your browser blocked the Google sign-in popup. We switched Google sign-in to a redirect flow.";
    }
    return authError.message?.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]+\)\.?$/, "") || "Google sign-in failed. Please try again.";
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
        return "SMS limit reached for now. Please try again later or sign up another way.";
      }
      if (code === "auth/operation-not-allowed" || code === "auth/billing-not-enabled") {
        return `Phone sign-up isn't available right now (${code}). Please use email or Google.`;
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

  const getVerifier = () => {
    if (!verifierRef.current && recaptchaRef.current) {
      verifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, { size: "invisible" });
    }
    return verifierRef.current;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPass) {
      setError("Passwords do not match");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Terms of Service and Privacy Policy");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, {
        displayName: fullName
      });
      router.push("/onboarding");
    } catch (err: unknown) {
      const msg = friendlyAuthError(err);
      setError(msg);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/onboarding");
    } catch (err: unknown) {
      setError(friendlyAuthError(err));
    }
  };

  const handleSendLink = async () => {
    setError("");
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError("Enter your email address above first, then we'll send you a sign-in link.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Terms of Service and Privacy Policy");
      return;
    }
    setLinkLoading(true);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: window.location.origin + "/auth/verify",
        handleCodeInApp: true,
      });
      window.localStorage.setItem("calolean_email_for_signin", email);
      setLinkSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/operation-not-allowed") {
        setError("Email-link sign-in isn't enabled for this app yet. Please use a password or Google.");
      } else {
        setError(friendlyAuthError(err));
      }
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError("");
    if (!agreed) {
      setError("You must agree to the Terms of Service and Privacy Policy");
      return;
    }
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
      router.push("/onboarding");
    } catch (err: unknown) {
      setError(friendlyPhoneError(err));
      setPhoneLoading(false);
    }
  };

  const termsRow = (withHiddenInput: boolean) => (
    <div
      onClick={() => setAgreed(!agreed)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        marginBottom: 22,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 20,
          height: 20,
          borderRadius: 6,
          border: `1.5px solid ${agreed ? "var(--lime-400)" : "var(--border-color)"}`,
          background: agreed ? "var(--lime-400)" : "var(--input-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0A0C0F",
        }}
      >
        {agreed && <Check size={14} strokeWidth={3} />}
      </span>
      {/* hidden input preserves required validation + checked state wiring */}
      {withHiddenInput && (
        <input
          id="terms"
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          required
          style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        I agree to the{" "}
        <span style={{ color: "var(--lime-600)", fontWeight: 600 }}>Terms of Service</span> and{" "}
        <span style={{ color: "var(--lime-600)", fontWeight: 600 }}>Privacy Policy</span>
      </span>
    </div>
  );

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
          background: "#0A0C0F",
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
              "radial-gradient(680px 460px at 18% 30%,rgba(170,255,0,.16),transparent 60%),radial-gradient(600px 600px at 90% 90%,rgba(77,158,255,.10),transparent 55%)",
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
              {/* dark brand panel always uses the lime-disc/white-dot variant */}
              <mask id="lg-auth-su">
                <rect width="100" height="100" fill="black" />
                <circle cx="50" cy="50" r="42" fill="white" />
                <circle cx="77" cy="23" r="27" fill="black" />
              </mask>
              <circle cx="50" cy="50" r="42" fill="var(--lime-400)" mask="url(#lg-auth-su)" />
              <circle cx="77" cy="23" r="10.5" fill="#FFFFFF" />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-.5px",
                color: "#fff",
              }}
            >
              calo<span style={{ color: "var(--lime-400)" }}>lean</span>
            </span>
          </div>

          {/* headline */}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 46,
              lineHeight: 1.05,
              fontWeight: 700,
              color: "#fff",
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
                color: "var(--lime-400)",
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
                    background: "rgba(170,255,0,.12)",
                    border: "1px solid rgba(170,255,0,.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--lime-400)",
                  }}
                >
                  <f.icon size={20} />
                </span>
                <div>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{f.t}</div>
                  <div style={{ color: "#8A95AC", fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>{f.s}</div>
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
            Create account
          </h2>
          <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", fontSize: 15 }}>
            Start your transformation today.
          </p>

          {/* Method toggle: Email | Phone */}
          <div
            role="tablist"
            aria-label="Sign-up method"
            style={{
              display: "flex",
              gap: 6,
              padding: 4,
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              marginBottom: 22,
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
                  color: method === m ? "#0A0C0F" : "var(--text-secondary)",
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
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {method === "email" && linkSent && (
            /* Email link sent — check inbox state */
            <div className="cl-card" style={{ textAlign: "center", padding: "30px 24px", marginBottom: 4 }}>
              <span
                style={{
                  display: "inline-flex",
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: "rgba(170,255,0,.12)",
                  border: "1px solid rgba(170,255,0,.3)",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--lime-600)",
                  marginBottom: 14,
                }}
              >
                <MailCheck size={24} />
              </span>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  fontWeight: 700,
                  margin: "0 0 6px",
                  color: "var(--text-primary)",
                }}
              >
                Check your inbox
              </h3>
              <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)" }}>
                We sent a sign-in link to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>. Open it on
                this device to create your account instantly — no password needed.
              </p>
              <button
                type="button"
                onClick={handleSendLink}
                disabled={linkLoading}
                className="btn-secondary"
                style={{ width: "100%", opacity: linkLoading ? 0.6 : 1 }}
              >
                {linkLoading ? "Resending…" : "Resend link"}
              </button>
              <button
                type="button"
                onClick={() => setLinkSent(false)}
                style={{
                  marginTop: 12,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                Use a password instead
              </button>
            </div>
          )}

          {method === "email" && !linkSent && (
            <form onSubmit={handleSignup}>
              {/* Full Name */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 7,
                }}
              >
                Full name
              </label>
              <input
                type="text"
                placeholder="Jane Doe"
                className="cl-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{ marginBottom: 16 }}
              />

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
                type="email"
                placeholder="jane@example.com"
                className="cl-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ marginBottom: 16 }}
              />

              {/* Password */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 7,
                }}
              >
                Password
              </label>
              <div style={{ position: "relative", marginBottom: 16 }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  className="cl-input"
                  style={{ paddingRight: 46 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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

              {/* Confirm Password */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 7,
                }}
              >
                Confirm password
              </label>
              <div style={{ position: "relative", marginBottom: 22 }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  className="cl-input"
                  style={{ paddingRight: 46 }}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
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
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Terms Checkbox */}
              {termsRow(true)}

              {/* Submit */}
              <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                Create account
              </button>

              {/* Passwordless email link */}
              <button
                type="button"
                onClick={handleSendLink}
                disabled={linkLoading}
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: "10px 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--lime-600)",
                  opacity: linkLoading ? 0.6 : 1,
                }}
              >
                {linkLoading ? "Sending link…" : "Email me a sign-in link instead"}
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

              {/* Terms Checkbox (shared state with the email form) */}
              {termsRow(false)}

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
                {phoneLoading ? "Verifying…" : "Verify & Create account"}
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
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "22px 0" }}>
            <span style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
              or continue with
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleSignup}
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

          <p
            style={{
              textAlign: "center",
              margin: "24px 0 0",
              fontSize: 14,
              color: "var(--text-secondary)",
            }}
          >
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--lime-600)", fontWeight: 700 }}>
              Sign in
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
