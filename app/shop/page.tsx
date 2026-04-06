"use client";
import { useState } from "react";
import AppLayout from "../../components/AppLayout";
import { ShoppingCart, Star, Bell, Sparkles, Leaf, Zap, Ban } from "lucide-react";

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

  const ghostProducts = [
    { id: 1, name: "Premium Vegan Protein", price: "₹2,499", type: "Nutrition" },
    { id: 2, name: "Calolean Shaker Bottle", price: "₹499", type: "Accessories" },
    { id: 3, name: "Pre-Workout Energy", price: "₹1,899", type: "Nutrition" },
    { id: 4, name: "Lifting Straps Pro", price: "₹399", type: "Gear" },
    { id: 5, name: "BCAA Recovery Mix", price: "₹1,299", type: "Nutrition" },
    { id: 6, name: "Resistance Bands Set", price: "₹699", type: "Gear" },
  ];

  const features = [
    { icon: Leaf, label: "Zero Additives" },
    { icon: Ban, label: "No Extra Calories" },
    { icon: Sparkles, label: "Zero Sugar" },
    { icon: Zap, label: "Pure Plant Based" },
  ];

  return (
    <AppLayout>
      <div className="relative min-h-full overflow-hidden" style={{ background: "var(--bg-app)" }}>
        
        {/* ── Ghost Product Grid (Background) ── */}
        <div className="absolute inset-0 p-8" style={{ opacity: 0.15, filter: "blur(3px)", pointerEvents: "none" }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl mx-auto mt-32">
            {ghostProducts.map((product) => (
              <div
                key={product.id}
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-xl)",
                  padding: "24px",
                  height: 200,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 80,
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface-elevated)",
                    marginBottom: 16,
                  }}
                />
                <div style={{ height: 14, width: "70%", background: "var(--surface-elevated)", borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 12, width: "40%", background: "var(--surface-elevated)", borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Coming Soon Content ── */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-full py-20 px-6">
          
          {/* Wordmark */}
          <div className="brand-wordmark mb-6" style={{ fontSize: 40 }}>
            <span style={{ color: "var(--text-primary)" }}>calo</span>
            <span style={{ color: "var(--lime-400)" }}>lean</span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 36,
              fontWeight: 800,
              color: "var(--text-primary)",
              textAlign: "center",
              marginBottom: 8,
              maxWidth: 500,
              lineHeight: 1.2,
            }}
          >
            Elevate Your Performance
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "var(--text-secondary)",
              textAlign: "center",
              maxWidth: 400,
              lineHeight: 1.5,
              marginBottom: 40,
            }}
          >
            Premium nutrition products coming soon. Built for athletes.
          </p>

          {/* Animated Coming Soon Badge */}
          <div className="coming-soon-badge mb-10 animate-float-in" style={{ animationDelay: "0.2s" }}>
            COMING SOON
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-2xl w-full">
            {features.map((feature, i) => (
              <div
                key={i}
                className="cl-card flex flex-col items-center gap-3 text-center card-hover animate-fade-in-up"
                style={{
                  padding: "20px 16px",
                  borderRadius: "var(--radius-lg)",
                  animationDelay: `${0.3 + i * 0.1}s`,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--radius-full)",
                    background: "rgba(170, 255, 0, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <feature.icon size={20} style={{ color: "var(--lime-400)" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {feature.label}
                </span>
              </div>
            ))}
          </div>

          {/* Email Notification */}
          <div
            className="cl-card-elevated animate-float-in w-full"
            style={{
              maxWidth: 460,
              padding: "32px 28px",
              textAlign: "center",
              animationDelay: "0.5s",
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <Bell size={18} style={{ color: "var(--lime-400)" }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Get notified when we launch
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20 }}>
              Be the first to shop premium nutrition products.
            </p>

            {notified ? (
              <div
                className="flex items-center justify-center gap-2"
                style={{
                  padding: "14px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(170, 255, 0, 0.1)",
                  border: "1px solid rgba(170, 255, 0, 0.2)",
                  color: "var(--lime-400)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <Sparkles size={16} /> You&apos;re on the list! We&apos;ll notify you.
              </div>
            ) : (
              <form onSubmit={handleNotify} className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="cl-input flex-1"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  required
                  style={{ fontSize: 14 }}
                />
                <button type="submit" className="btn-primary shrink-0" style={{ padding: "12px 20px", fontSize: 14 }}>
                  Notify Me
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}