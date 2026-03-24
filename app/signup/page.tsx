"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

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
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#121219]">
      {/* Left Pane - Branding & Features */}
      <div className="hidden md:flex md:w-1/2 flex-col justify-center relative p-12 lg:p-20 overflow-hidden bg-gradient-to-br from-[#1b1c25] to-[#0e0e13]">
        {/* Subtle background text */}
        <div className="absolute bottom-10 left-0 w-full text-center opacity-[0.03] pointer-events-none select-none">
          <h1 className="text-[6rem] font-black uppercase tracking-widest text-white leading-none">FITNESS AND<br/>NUTRITION</h1>
        </div>

        <div className="relative z-10 w-full max-w-lg mx-auto">
          {/* Logo */}
          <div className="mb-14">
            <div className="flex text-[3.5rem] leading-none mb-6 font-extrabold tracking-[-0.04em]">
              <span className="text-white">calo</span>
              <span className="text-[#bcfd01]">lean</span>
            </div>
            <div className="text-gray-400 text-xs sm:text-sm tracking-[0.2em] font-medium flex items-center space-x-3">
              <span>TRAIN SMARTER</span>
              <span className="text-[#bcfd01] text-[10px]">●</span>
              <span>EAT CLEANER</span>
              <span className="text-[#bcfd01] text-[10px]">●</span>
              <span>GET LEANER</span>
            </div>
          </div>

          <div className="space-y-10 mt-16">
            {/* Feature 1 */}
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 rounded-full bg-[#1e2721] flex items-center justify-center shrink-0 border border-white/5 shadow-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bcfd01" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <div className="pt-1">
                <h3 className="text-xl font-bold text-white mb-2">Advanced Tracking</h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  Monitor your vitals and nutrition in real-time.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 rounded-full bg-[#1e2029] flex items-center justify-center shrink-0 border border-white/5 shadow-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bcfd01" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="7" r="4"/>
                  <path d="M5 22v-5l2-4h10l2 4v5"/>
                  <path d="M10 11H9a3 3 0 0 0-3 3v2M14 11h1a3 3 0 0 1 3 3v2"/>
                </svg>
              </div>
              <div className="pt-1">
                <h3 className="text-xl font-bold text-white mb-2">Form Analysis</h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  Perfect your exercise technique with AI feedback.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-bl from-[#302a2a] via-[#2a2a35] to-[#1e1e26] relative">
        <button 
          onClick={() => router.back()} 
          className="absolute top-8 left-8 text-white hover:text-gray-300 transition-colors p-2 z-20"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="w-full max-w-[440px] relative z-10 mt-16 md:mt-0 p-4 sm:p-8">
          <div className="mb-8">
            <h1 className="text-[2rem] font-bold text-white mb-4">Create Account</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Join our AI-powered health ecosystem to track health, nutrition, and analyze exercise form.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Full Name</label>
              <input 
                type="text" 
                placeholder="Jane Doe"
                className="block w-full rounded-xl border border-white/5 bg-[#232533] py-3.5 px-4 text-sm text-white placeholder:text-gray-500 focus:border-[#bcfd01] focus:ring-1 focus:ring-[#bcfd01] focus:outline-none transition-all"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            {/* Email Address */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Email Address</label>
              <input 
                type="email" 
                placeholder="jane@example.com"
                className="block w-full rounded-xl border border-white/5 bg-[#232533] py-3.5 px-4 text-sm text-white placeholder:text-gray-500 focus:border-[#bcfd01] focus:ring-1 focus:ring-[#bcfd01] focus:outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  className="block w-full rounded-xl border border-white/5 bg-[#232533] py-3.5 px-4 pr-12 text-sm text-white placeholder:text-gray-500 focus:border-[#bcfd01] focus:ring-1 focus:ring-[#bcfd01] focus:outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Confirm Password</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  className="block w-full rounded-xl border border-white/5 bg-[#232533] py-3.5 px-4 pr-12 text-sm text-white placeholder:text-gray-500 focus:border-[#bcfd01] focus:ring-1 focus:ring-[#bcfd01] focus:outline-none transition-all"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-3 pt-2">
              <div className="flex h-6 items-center">
                <input 
                  id="terms"
                  name="terms"
                  type="checkbox" 
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  className="h-5 w-5 rounded-full border border-white/10 bg-[#232533] checked:bg-[#bcfd01] checked:border-[#bcfd01] focus:ring-[#bcfd01] focus:ring-offset-0 focus:ring-1 appearance-none cursor-pointer transition-colors relative
                  before:content-[''] before:block before:absolute before:w-1.5 before:h-2.5 before:border-r-[2px] before:border-b-[2px] before:border-[#1a1c29] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-[60%] before:rotate-45 before:opacity-0 checked:before:opacity-100" 
                />
              </div>
              <div className="text-sm">
                <label htmlFor="terms" className="text-gray-400 cursor-pointer">
                  I agree to the <span className="font-semibold text-[#bcfd01] hover:text-[#a8e001] transition-colors">Terms of Service</span> and <span className="font-semibold text-[#bcfd01] hover:text-[#a8e001] transition-colors">Privacy Policy</span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              className="w-full flex justify-center rounded-xl bg-[#bcfd01] hover:bg-[#a8e001] px-4 py-3.5 text-sm font-bold text-[#1a1c29] transition-all active:scale-[0.98] mt-6"
            >
              Create Account
            </button>
          </form>

          <div className="flex items-center mt-8 mb-6">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-sm text-gray-400">Or continue with</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <button
            onClick={handleGoogleSignup}
            type="button"
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#232533] hover:bg-[#2a2d3e] border border-white/5 px-4 py-3.5 text-sm font-medium text-white transition-all active:scale-[0.98]"
          >
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
            </svg>
            Google
          </button>

          <p className="mt-8 text-center text-sm text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#bcfd01] hover:text-[#a8e001] transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}