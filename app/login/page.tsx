"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect to dashboard or home after successful login
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
      // Redirect to dashboard or home after successful login
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to log in with Google.");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#2a2a35] via-[#1a1a24] to-[#121219] text-white font-sans relative flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Logo Section */}
      <div className="flex flex-col items-center mb-10 w-full max-w-md">
        <div className="flex justify-center text-[2.75rem] leading-none mb-4 font-extrabold tracking-[-0.04em]">
          <span className="text-white">calo</span>
          <span className="text-[#bcfd01]">lean</span>
        </div>
        <div className="text-gray-400 text-xs sm:text-sm tracking-[0.15em] sm:tracking-[0.2em] font-medium flex items-center justify-center space-x-2">
          <span>TRAIN SMARTER</span>
          <span className="text-[#bcfd01] text-[10px]">●</span>
          <span>EAT CLEANER</span>
          <span className="text-[#bcfd01] text-[10px]">●</span>
          <span>GET LEANER</span>
        </div>
      </div>

      {/* Card Container */}
      <div className="w-full max-w-[420px] bg-[#1a1d29] p-8 sm:p-10 rounded-2xl shadow-2xl border border-white/5 relative z-10">
        <h2 className="text-[1.35rem] sm:text-2xl font-bold text-white mb-6">
          Sign in to your account
        </h2>

        <form className="space-y-5" onSubmit={handleEmailLogin}>
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-xl border border-white/5 bg-[#232533] py-3.5 px-4 text-sm text-white placeholder:text-gray-500 focus:border-[#bcfd01] focus:ring-1 focus:ring-[#bcfd01] focus:outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs sm:text-sm font-semibold text-[#bcfd01] hover:text-[#a8e001] transition-colors">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-xl border border-white/5 bg-[#232533] py-3.5 px-4 text-sm text-white placeholder:text-gray-500 placeholder:text-lg focus:border-[#bcfd01] focus:ring-1 focus:ring-[#bcfd01] focus:outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full flex justify-center rounded-xl bg-[#bcfd01] hover:bg-[#a8e001] px-4 py-3.5 text-sm font-bold text-[#1a1c29] transition-all active:scale-[0.98] mt-2"
          >
            Sign in
          </button>
        </form>

        <div className="mt-8 mb-6 relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[#1a1d29] px-4 text-gray-400">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#232533] hover:bg-[#2a2d3e] border border-white/5 px-4 py-3.5 text-sm font-medium text-white transition-all active:scale-[0.98]"
        >
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
          </svg>
          Google
        </button>

        <p className="mt-8 text-center text-sm text-gray-400">
          Not a member?{" "}
          <Link href="/signup" className="font-semibold text-[#bcfd01] hover:text-[#a8e001] transition-colors">
            Register now
          </Link>
        </p>
      </div>

      <p className="mt-12 text-center text-xs text-gray-500">
        © 2025 calolean. All rights reserved.
      </p>
    </main>
  );
}