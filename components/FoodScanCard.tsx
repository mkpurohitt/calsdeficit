"use client";
// Blueprint result card: verified-match badge → calories/macros → AI rating →
// improvement tips with affiliate links → ad card LAST (commercial content
// never interrupts core value).
import { BadgeCheck, ExternalLink, Star, TriangleAlert } from "lucide-react";
import { affiliateLinkFor } from "../lib/config/affiliate-links";
import type { FoodScanResult } from "../lib/schemas/food-scan";
import AdCard from "./ads/AdCard";

interface FoodScanCardProps {
  scan: FoodScanResult;
  adKeywords?: string[];
  adsEnabled?: boolean;
  /** Hide the ad slot (e.g. inside the diet scanner modal before saving). */
  showAd?: boolean;
}

export default function FoodScanCard({ scan, adKeywords = [], adsEnabled = true, showAd = true }: FoodScanCardProps) {
  const rating = Math.round(scan.rating_out_of_10 * 10) / 10;
  const ratingColor = rating >= 7 ? "var(--lime-400)" : rating >= 4 ? "var(--warning)" : "var(--error)";

  return (
    <div className="space-y-3" style={{ maxWidth: 520 }}>
      {/* Verification badge */}
      <div
        className="inline-flex items-center gap-1.5"
        style={{
          padding: "4px 12px",
          borderRadius: "var(--radius-full)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          background: scan.verified ? "rgba(170, 255, 0, 0.12)" : "rgba(255, 184, 0, 0.12)",
          color: scan.verified ? "var(--lime-400)" : "var(--warning)",
        }}
      >
        {scan.verified ? <BadgeCheck size={13} /> : <TriangleAlert size={13} />}
        {scan.verified ? `DATABASE VERIFIED MATCH · ${scan.source}` : "AI ESTIMATE"}
      </div>

      {/* Name + calories */}
      <div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          {scan.food_name}
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{scan.portion}</p>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>
        {scan.calories}{" "}
        <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-tertiary)" }}>kcal</span>
      </div>

      {/* Macros */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Protein", value: `${scan.protein_g}g`, color: "var(--macro-protein)" },
          { label: "Carbs", value: `${scan.carbs_g}g`, color: "var(--macro-carbs)" },
          { label: "Fat", value: `${scan.fat_g}g`, color: "var(--macro-fat)" },
          { label: "Fiber", value: `${scan.fiber_g}g`, color: "var(--macro-fiber)" },
        ].map((m) => (
          <div
            key={m.label}
            style={{ background: "var(--surface-elevated)", padding: "8px 4px", borderRadius: "var(--radius-sm)" }}
          >
            <div style={{ color: m.color, fontWeight: 700, fontSize: 14, fontFamily: "var(--font-mono)" }}>{m.value}</div>
            <div style={{ color: "var(--text-tertiary)", fontSize: 10, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* AI rating + review */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: "var(--radius-md)",
          background: "var(--surface-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <Star size={15} style={{ color: ratingColor }} fill={ratingColor} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: ratingColor }}>
            {rating}/10
          </span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            AI Rating
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{scan.health_tip}</p>
      </div>

      {/* Improvement suggestions with affiliate links */}
      {scan.improvement_suggestions.length > 0 && (
        <div className="space-y-2">
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Make it better
          </p>
          {scan.improvement_suggestions.map((suggestion, index) => {
            const link = affiliateLinkFor(suggestion.product_keyword);
            return (
              <div
                key={index}
                style={{
                  fontSize: 13,
                  color: "var(--text-primary)",
                  lineHeight: 1.6,
                  paddingLeft: 10,
                  borderLeft: "2px solid var(--lime-400)",
                }}
              >
                {suggestion.tip}{" "}
                {link && (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-flex items-center gap-1"
                    style={{ color: "var(--lime-400)", fontWeight: 600 }}
                  >
                    {link.label} <ExternalLink size={11} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Contextual native ad — always last */}
      {showAd && <AdCard keywords={adKeywords} enabled={adsEnabled} />}
    </div>
  );
}
