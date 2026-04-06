"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Activity, Utensils, Dumbbell, Sun, Moon } from "lucide-react";
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
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

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
      router.push("/");
    } catch (err: any) {
      const msg = err.message.replace("Firebase: ", "").replace("auth/", "");
      setError(msg);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (err: any) {
      setError("Google sign-in failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-app)" }}>

      {/* ── Left Half — Branding ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #0A0C0F 0%, #0F1218 50%, #161B24 100%)",
          }}
        />
        <div
          className="absolute"
          style={{
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(170,255,0,0.08) 0%, transparent 70%)",
            bottom: "10%",
            right: "10%",
            filter: "blur(60px)",
          }}
        />

        <div className="relative z-10 flex flex-col justify-center p-12 lg:p-20 w-full max-w-lg mx-auto">
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

          <div className="space-y-8 mt-12">
            {[
              { icon: Activity, title: "Advanced Tracking", desc: "Monitor your vitals and nutrition in real-time." },
              { icon: Utensils, title: "AI Nutrition Analysis", desc: "Snap a photo, get instant macro breakdown." },
              { icon: Dumbbell, title: "Form Analysis", desc: "Perfect your exercise technique with AI feedback." },
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

      {/* ── Right Half — Signup Form ── */}
      <div
        className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 relative"
        style={{ background: "var(--bg-app)" }}
      >
        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="btn-icon absolute top-6 right-6 z-10"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        <div className="w-full max-w-[460px] animate-float-in">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="brand-wordmark inline-block" style={{ fontSize: 32 }}>
              <span style={{ color: "var(--text-primary)" }}>calo</span>
              <span style={{ color: "var(--lime-400)" }}>lean</span>
            </div>
          </div>

          {/* Card */}
          <div className="cl-card-elevated" style={{ padding: "36px 32px" }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              Create Account
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28 }}>
              Start your health transformation today.
            </p>

            <form onSubmit={handleSignup} className="space-y-4">
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

              {/* Full Name */}
              <div>
                <label className="cl-label">Full Name</label>
                <input
                  type="text"
                  placeholder="Jane Doe"
                  className="cl-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="cl-label">Email Address</label>
                <input
                  type="email"
                  placeholder="jane@example.com"
                  className="cl-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="cl-label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    className="cl-input"
                    style={{ paddingRight: 48 }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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

              {/* Confirm Password */}
              <div>
                <label className="cl-label">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    className="cl-input"
                    style={{ paddingRight: 48 }}
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 pt-1">
                <div className="flex items-center" style={{ height: 24 }}>
                  <input
                    id="terms"
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    required
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: `1.5px solid var(--border-color)`,
                      background: "var(--input-bg)",
                      accentColor: "var(--lime-400)",
                      cursor: "pointer",
                    }}
                  />
                </div>
                <label htmlFor="terms" style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", lineHeight: 1.5 }}>
                  I agree to the{" "}
                  <span style={{ fontWeight: 600, color: "var(--lime-400)" }}>Terms of Service</span>{" "}
                  and{" "}
                  <span style={{ fontWeight: 600, color: "var(--lime-400)" }}>Privacy Policy</span>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn-primary w-full"
                style={{ height: 52, fontSize: 15, marginTop: 8, borderRadius: "var(--radius-md)" }}
              >
                Create Account
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1" style={{ height: 1, background: "var(--border-color)" }} />
              <span className="px-4" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                or continue with
              </span>
              <div className="flex-1" style={{ height: 1, background: "var(--border-color)" }} />
            </div>

            {/* Google */}
            <button onClick={handleGoogleSignup} type="button" className="btn-social">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              Continue with Google
            </button>

            <p className="text-center mt-7" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Already have an account?{" "}
              <Link href="/login" style={{ fontWeight: 600, color: "var(--lime-400)" }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}