"use client";
import { useState } from "react";
import AppLayout from "../../components/AppLayout";
import { Bell, Sparkles, Leaf, Zap, Ban, type LucideIcon } from "lucide-react";

const features: { icon: LucideIcon; label: string }[] = [
  { icon: Leaf, label: "Zero Additives" },
  { icon: Ban, label: "No Extra Calories" },
  { icon: Sparkles, label: "Zero Sugar" },
  { icon: Zap, label: "Pure Plant Based" },
];

export default function ShopPage() {
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notified, setNotified] = useState(false);

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (notifyEmail.trim()) {
      setNotified(true);
      setNotifyEmail("");
    }
  };

  return (
    <AppLayout>
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          padding: "clamp(16px, 4vh, 40px) 20px",
          background: "var(--bg-app)",
        }}
      >
        {/* Ambient glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "26%",
            transform: "translate(-50%,-50%)",
            width: 520,
            height: 520,
            background: "radial-gradient(circle,color-mix(in srgb, var(--accent) 12%, transparent),transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 680, width: "100%" }}>
          {/* Headline */}
          <h1 className="cl-disp" style={{ fontSize: "clamp(30px, 5.4vw, 44px)", fontWeight: 700, margin: "0 0 12px", color: "var(--text-primary)", lineHeight: 1.05 }}>
            Elevate Your Performance
          </h1>
          <p style={{ fontSize: "clamp(14px, 1.6vw, 17px)", color: "var(--text-secondary)", margin: "0 auto 24px", maxWidth: 460 }}>
            Premium nutrition products, engineered for athletes. Built clean, priced fair.
          </p>

          {/* Animated COMING SOON badge */}
          <div style={{ marginBottom: "clamp(22px, 4vh, 36px)" }}>
            <span className="coming-soon-badge cl-mono animate-float-in" style={{ display: "inline-block", animationDelay: "0.2s" }}>
              COMING SOON
            </span>
          </div>

          {/* Feature grid */}
          <div className="shop-feature-grid" style={{ marginBottom: "clamp(20px, 3.5vh, 32px)" }}>
            {features.map((feature, i) => (
              <div
                key={feature.label}
                className="cl-card-hover animate-fade-in-up"
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 15,
                  padding: "clamp(14px, 2.4vh, 20px) 12px",
                  boxShadow: "var(--shadow-card)",
                  animationDelay: `${0.3 + i * 0.1}s`,
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 11px",
                    color: "var(--lime-600)",
                  }}
                >
                  <feature.icon size={20} />
                </span>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{feature.label}</div>
              </div>
            ))}
          </div>

          {/* Email capture card */}
          <div
            className="animate-float-in"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 18,
              padding: "clamp(18px, 3vh, 24px)",
              boxShadow: "var(--shadow-card)",
              maxWidth: 480,
              margin: "0 auto",
              animationDelay: "0.5s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 600, fontSize: 16, color: "var(--text-primary)", marginBottom: 6 }}>
              <Bell size={18} style={{ color: "var(--lime-600)" }} />
              Get notified when we launch
            </div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>
              Be the first to shop premium nutrition.
            </div>

            {notified ? (
              <div
                className="flex items-center justify-center gap-2"
                style={{
                  padding: 14,
                  borderRadius: "var(--radius-md)",
                  background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                  color: "var(--lime-400)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <Sparkles size={16} /> You&apos;re on the list! We&apos;ll notify you.
              </div>
            ) : (
              <form onSubmit={handleNotify} style={{ display: "flex", gap: 10 }}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="cl-input"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  required
                  style={{ flex: 1, fontSize: 14 }}
                />
                <button type="submit" className="btn-primary shrink-0" style={{ padding: "13px 22px", fontSize: 14, whiteSpace: "nowrap" }}>
                  Notify Me
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .shop-feature-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        @media (max-width: 560px) {
          .shop-feature-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </AppLayout>
  );
}
