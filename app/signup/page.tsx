"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPass) {
      setError("Passwords do not match");
      return;
    }

    try {
      // 1. Create User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Add "Full Name" to their profile
      await updateProfile(userCredential.user, {
        displayName: fullName
      });

      router.push("/"); // Redirect to dashboard
    } catch (err: any) {
      // Clean up error message
      const msg = err.message.replace("Firebase: ", "").replace("auth/", "");
      setError(msg);
    }
  };

  const handleGoogleSignup = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (err: any) {
      setError("Google sign-in failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05110f] px-4 font-sans">
      <div className="w-full max-w-md p-2">
        
        {/* Header matching Screen 2 */}
        <div className="mb-8">
          <button onClick={() => router.back()} className="text-white mb-4">
            ←
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Join our AI-powered health ecosystem to track health, nutrition, and analyze exercise form.
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-white ml-1">Full Name</label>
            <input 
              type="text" 
              placeholder="Jane Doe"
              className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#00ff9d] placeholder-gray-500"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-white ml-1">Email Address</label>
            <input 
              type="email" 
              placeholder="jane@example.com"
              className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#00ff9d] placeholder-gray-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-white ml-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#00ff9d] placeholder-gray-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-white ml-1">Confirm Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter password"
                className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#00ff9d] placeholder-gray-500"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-3 mt-2">
            <input 
              type="checkbox" 
              required
              className="mt-1 w-5 h-5 accent-[#00ff9d] bg-[#112926] border-gray-700 rounded" 
            />
            <p className="text-sm text-gray-400">
              I agree to the <span className="text-[#00ff9d]">Terms of Service</span> and <span className="text-[#00ff9d]">Privacy Policy</span>
            </p>
          </div>

          {error && <p className="text-red-500 text-sm text-center bg-red-500/10 p-2 rounded">{error}</p>}

          {/* Submit Button */}
          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] hover:from-[#00cc7d] hover:to-[#00aa69] text-black font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] transition-all transform active:scale-[0.98] mt-4"
          >
            Create Account
          </button>
        </form>

        <div className="my-8 flex items-center">
          <div className="flex-1 h-px bg-gray-800"></div>
          <span className="px-4 text-xs text-gray-500">Or continue with</span>
          <div className="flex-1 h-px bg-gray-800"></div>
        </div>

        {/* Google Button */}
        <button 
          onClick={handleGoogleSignup}
          className="w-full bg-[#112926] hover:bg-[#1a3b36] text-white border border-gray-700 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
          </svg>
          Google
        </button>

        <p className="mt-8 text-center text-gray-500 text-sm">
          Already have an account? <a href="/login" className="text-[#00ff9d] font-medium hover:underline">Log in</a>
        </p>
      </div>
    </div>
  );
}