"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { BrandMark } from "../../../components/AppLayout";
import { Loader2, MailCheck, TriangleAlert } from "lucide-react";

const EMAIL_KEY = "calolean_email_for_signin";

/** Completes Firebase email-link (passwordless) sign-in. */
export default function VerifyEmailLinkPage() {
  const router = useRouter();
  const ranRef = useRef(false);
  const [status, setStatus] = useState<"working" | "need-email" | "error">("working");
  const [emailInput, setEmailInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const completeSignIn = async (email: string) => {
    try {
      setBusy(true);
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem(EMAIL_KEY);
      // Home routes brand-new users into onboarding automatically.
      router.replace("/");
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      setBusy(false);
      setStatus("error");
      if (code === "auth/invalid-action-code" || code === "auth/expired-action-code") {
        setError("This sign-in link has expired or was already used. Request a fresh one from the login page.");
      } else if (code === "auth/invalid-email") {
        setError("That email doesn't match this sign-in link. Enter the exact address the link was sent to.");
      } else {
        setError("Could not complete sign-in. Please request a new link and try again.");
      }
    }
  };

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setStatus("error");
      setError("This isn't a valid sign-in link. Open the newest email from Calolean and tap its button again.");
      return;
    }
    const saved = window.localStorage.getItem(EMAIL_KEY);
    if (saved) {
      completeSignIn(saved);
    } else {
      // Link opened on a different device/browser — ask for the email.
      setStatus("need-email");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--bg-app)", color: "var(--text-primary)", padding: 20 }}
    >
      <div className="flex items-center" style={{ gap: 10, marginBottom: 26 }}>
        <BrandMark size={28} id="lg-verify" />
        <span className="brand-wordmark" style={{ fontSize: 21 }}>
          calo<span style={{ color: "var(--lime-400)" }}>lean</span>
        </span>
      </div>

      <div
        className="cl-card"
        style={{ width: "100%", maxWidth: 420, borderRadius: 18, padding: 28, textAlign: "center" }}
      >
        {status === "working" && (
          <>
            <Loader2 size={30} className="animate-spin" style={{ color: "var(--lime-400)", margin: "0 auto 16px" }} />
            <div className="cl-disp" style={{ fontSize: 19, fontWeight: 700 }}>Signing you in…</div>
            <p style={{ fontSize: 13.5, color: "var(--text-tertiary)", marginTop: 8 }}>
              Verifying your email link with Firebase.
            </p>
          </>
        )}

        {status === "need-email" && (
          <>
            <MailCheck size={30} style={{ color: "var(--lime-400)", margin: "0 auto 16px" }} />
            <div className="cl-disp" style={{ fontSize: 19, fontWeight: 700 }}>Confirm your email</div>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: "8px 0 18px", lineHeight: 1.6 }}>
              You opened this link on a different device. Enter the email address the sign-in link was sent to.
            </p>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              className="cl-input"
              style={{ marginBottom: 14, textAlign: "center" }}
              autoFocus
            />
            {error && (
              <p style={{ fontSize: 13, color: "var(--error)", marginBottom: 12 }}>{error}</p>
            )}
            <button
              onClick={() => {
                setError(null);
                if (!/\S+@\S+\.\S+/.test(emailInput)) {
                  setError("Enter a valid email address.");
                  return;
                }
                setStatus("working");
                completeSignIn(emailInput.trim());
              }}
              disabled={busy}
              className="btn-primary"
              style={{ width: "100%", borderRadius: 12, opacity: busy ? 0.7 : 1 }}
            >
              Continue
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <TriangleAlert size={30} style={{ color: "var(--warning)", margin: "0 auto 16px" }} />
            <div className="cl-disp" style={{ fontSize: 19, fontWeight: 700 }}>Sign-in link problem</div>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: "8px 0 18px", lineHeight: 1.6 }}>
              {error}
            </p>
            <Link
              href="/login"
              className="btn-primary"
              style={{ display: "inline-block", borderRadius: 12, textDecoration: "none", padding: "12px 26px" }}
            >
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
