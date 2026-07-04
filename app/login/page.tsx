"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { Eye, EyeOff, Activity, Utensils, Dumbbell, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

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

  React.useEffect(() => {
    // If we wanted to check redirect results we could do it here, but we are switching to popup
  }, [friendlyAuthError, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: unknown) {
      setError(friendlyAuthError(err));
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (err: unknown) {
      setError(friendlyAuthError(err));
    }
  };

  const features = [
    { icon: Activity, t: "Advanced Tracking", s: "Monitor your calories, macros, and activity in real-time." },
    { icon: Utensils, t: "AI Nutrition Analysis", s: "Snap a photo and get instant nutritional breakdown." },
    { icon: Dumbbell, t: "On-device Form Analysis", s: "AI-powered exercise form correction to prevent injuries." },
  ];

  return (
    <div
      className="cl-auth"
      style={{
        display: "grid",
        gridTemplateColumns: "1.04fr 1fr",
        minHeight: "100vh",
        background: "var(--bg-app)",
      }}
    >
      {/* ── Brand panel ── */}
      <div
        className="cl-brand"
        style={{
          position: "relative",
          overflow: "hidden",
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
              <mask id="lg-auth">
                <rect width="100" height="100" fill="black" />
                <circle cx="50" cy="50" r="42" fill="white" />
                <circle cx="77" cy="23" r="27" fill="black" />
              </mask>
              <circle cx="50" cy="50" r="42" fill="var(--lime-400)" mask="url(#lg-auth)" />
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
          <p style={{ margin: "0 0 32px", color: "var(--text-secondary)", fontSize: 15 }}>
            Your goals are waiting.
          </p>

          <form onSubmit={handleEmailLogin}>
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
      </div>
    </div>
  );
}
