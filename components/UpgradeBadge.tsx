"use client";
import { Crown } from "lucide-react";
import { TIERS, type Tier } from "../lib/entitlements";

interface UpgradeBadgeProps {
  tier: Tier;
  used: number;
  limit: number;
}

export default function UpgradeBadge({ tier, used, limit }: UpgradeBadgeProps) {
  const config = TIERS[tier] || TIERS.free;

  return (
    <div className="cl-card-accent" style={{ borderRadius: 20, padding: 24 }}>
      <div className="flex items-center gap-2 mb-4">
        <Crown size={18} style={{ color: "var(--lime-400)" }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{config.label}</span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between mb-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          <span>AI prompts used today</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
            {used}/{limit}
          </span>
        </div>
        <div className="macro-bar__track">
          <div
            className="macro-bar__fill"
            style={{ width: `${Math.min((used / Math.max(limit, 1)) * 100, 100)}%`, background: "var(--lime-400)" }}
          />
        </div>
      </div>

      {tier === "free" ? (
        <>
          <button className="btn-primary w-full" style={{ height: 48, fontSize: 14 }} disabled>
            Upgrade to Premium
          </button>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginTop: 8 }}>
            {TIERS.premium.dailyPrompts} prompts/day, no ads — coming soon
          </p>
        </>
      ) : (
        <p style={{ fontSize: 12, color: "var(--lime-400)", fontWeight: 600 }}>
          Premium active — no ads, {config.dailyPrompts} prompts/day.
        </p>
      )}
    </div>
  );
}
