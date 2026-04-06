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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/"); 
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to log in with Google.");
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-app)" }}>

      {/* ── Left Half — Branding ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background with dark overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #0A0C0F 0%, #0F1218 50%, #161B24 100%)",
          }}
        />
        {/* Decorative lime glow */}
        <div
          className="absolute"
          style={{
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(170,255,0,0.08) 0%, transparent 70%)",
            top: "20%",
            left: "30%",
            filter: "blur(60px)",
          }}
        />

        <div className="relative z-10 flex flex-col justify-center p-12 lg:p-20 w-full max-w-lg mx-auto">
          {/* Wordmark */}
          <div className="mb-10">
            <div className="brand-wordmark" style={{ fontSize: 40, lineHeight: 1 }}>
              <span style={{ color: "#FFFFFF" }}>calo</span>
              <span style={{ color: "#AAFF00" }}>lean</span>
            </div>
            <div
              className="flex items-center gap-2 mt-4"
              style={{ fontSize: 12, letterSpacing: "0.2em", fontWeight: 500, color: "rgba(255,255,255,0.6)" }}
            >
              <span>TRAIN SMARTER</span>
              <span style={{ color: "#AAFF00", fontSize: 8 }}>●</span>
              <span>EAT CLEANER</span>
              <span style={{ color: "#AAFF00", fontSize: 8 }}>●</span>
              <span>GET LEANER</span>
            </div>
          </div>

          {/* Feature bullets */}
          <div className="space-y-8 mt-12">
            {[
              { icon: Activity, title: "Advanced Tracking", desc: "Monitor your calories, macros, and activity in real-time." },
              { icon: Utensils, title: "AI Nutrition Analysis", desc: "Snap a photo and get instant nutritional breakdown." },
              { icon: Dumbbell, title: "Form Analysis", desc: "AI-powered exercise form correction to prevent injuries." },
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-5 animate-fade-in-up" style={{ animationDelay: `${i * 0.15}s` }}>
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "var(--radius-full)",
                    background: "rgba(170, 255, 0, 0.1)",
                    border: "1px solid rgba(170, 255, 0, 0.2)",
                  }}
                >
                  <feature.icon size={22} style={{ color: "#AAFF00" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: "#FFFFFF", marginBottom: 4 }}>{feature.title}</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Half — Login Form ── */}
      <div
        className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 relative"
        style={{ background: "var(--bg-app)" }}
      >
        {/* Theme toggle - top right */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="btn-icon absolute top-6 right-6 z-10"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        <div className="w-full max-w-[440px] animate-float-in">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="brand-wordmark inline-block" style={{ fontSize: 32 }}>
              <span style={{ color: "var(--text-primary)" }}>calo</span>
              <span style={{ color: "var(--lime-400)" }}>lean</span>
            </div>
          </div>

          {/* Card */}
          <div
            className="cl-card-elevated"
            style={{ padding: "40px 36px" }}
          >
            {/* Header */}
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              Welcome back, athlete
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 32 }}>
              Your goals are waiting.
            </p>

            <form className="space-y-5" onSubmit={handleEmailLogin}>
              {error && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255, 77, 77, 0.1)",
                    border: "1px solid rgba(255, 77, 77, 0.3)",
                    color: "var(--error)",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="cl-label">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="cl-input"
                  placeholder="you@example.com"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="cl-label" style={{ marginBottom: 0 }}>Password</label>
                  <Link
                    href="/forgot-password"
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--lime-400)" }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="cl-input"
                    style={{ paddingRight: 48 }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                className="btn-primary w-full"
                style={{ height: 52, fontSize: 15, marginTop: 8, borderRadius: "var(--radius-md)" }}
              >
                Sign In
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-7">
              <div className="flex-1" style={{ height: 1, background: "var(--border-color)" }} />
              <span className="px-4" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                or continue with
              </span>
              <div className="flex-1" style={{ height: 1, background: "var(--border-color)" }} />
            </div>

            {/* Google Button */}
            <button onClick={handleGoogleLogin} type="button" className="btn-social">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              Continue with Google
            </button>

            {/* Footer */}
            <p className="text-center mt-8" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              No account?{" "}
              <Link href="/signup" style={{ fontWeight: 600, color: "var(--lime-400)" }}>
                Sign up
              </Link>
            </p>
          </div>

          {/* Copyright */}
          <p className="text-center mt-8" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            © 2026 calolean. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}