"use client";
import { useState } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react"; // Icons

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/"); // Redirect to home after login
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (err) {
      setError("Google sign-in failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05110f] px-4">
      <div className="w-full max-w-md bg-[#0a1f1c] p-8 rounded-2xl border border-gray-800 shadow-xl">
        
        {/* Header Section (NEW) */}
        <div className="text-center mb-8">
          {/* CHANGED: Removed the pill icon, Title moves up naturally */}
          <h1 className="text-3xl font-bold text-white mb-2">CalsDeficit</h1>
          <p className="text-gray-400 text-sm">
            Track your health, diet and gym all in one
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Email Input */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
              <input 
                type="email" 
                placeholder="user@example.com"
                className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#00ff9d] transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
              <input 
                type="password" 
                placeholder="••••••••"
                className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#00ff9d] transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Login Button */}
          <button 
            type="submit"
            className="w-full bg-[#00ff9d] hover:bg-[#00cc7d] text-black font-bold py-3.5 rounded-xl transition-all transform active:scale-95"
          >
            Log In →
          </button>
        </form>

        <div className="my-6 flex items-center">
          <div className="flex-1 h-px bg-gray-800"></div>
          <span className="px-4 text-xs text-gray-500 uppercase">Or continue with</span>
          <div className="flex-1 h-px bg-gray-800"></div>
        </div>

        {/* Google Button */}
        <button 
          onClick={handleGoogleLogin}
          className="w-full bg-[#112926] hover:bg-[#1a3b36] text-white border border-gray-700 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <span className="text-xl">G</span> Continue with Google
        </button>

        <p className="mt-8 text-center text-gray-500 text-sm">
          New here? <a href="/signup" className="text-[#00ff9d] hover:underline">Create an account</a>
        </p>
      </div>
    </div>
  );
}