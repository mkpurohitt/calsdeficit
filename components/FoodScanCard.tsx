"use client";
// Blueprint result card (v2 design): verified badge → food name/kcal →
// macro tiles → health score bar → expert review → improvement tips with
// affiliate product card → ad LAST (commercial content never interrupts value).
import { useState } from "react";
import { BadgeCheck, Check, ExternalLink, Loader2, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { affiliateLinkFor } from "../lib/config/affiliate-links";
import type { FoodScanResult } from "../lib/schemas/food-scan";
import AdCard from "./ads/AdCard";

interface FoodScanCardProps {
  scan: FoodScanResult;
  adKeywords?: string[];
  adsEnabled?: boolean;
  /** Hide the ad slot (e.g. inside the diet scanner modal before saving). */
  showAd?: boolean;
  /** Optional "Add to diary" action. When absent the card renders exactly as before. */
  onAdd?: () => Promise<void>;
}

function healthLabel(rating: number): { text: string; color: string } {
  if (rating >= 8) return { text: "VERY HEALTHY", color: "var(--lime-600)" };
  if (rating >= 6) return { text: "HEALTHY", color: "var(--lime-600)" };
  if (rating >= 4) return { text: "OKAY IN MODERATION", color: "var(--warning)" };
  return { text: "TREAT — ENJOY SPARINGLY", color: "var(--error)" };
}

export default function FoodScanCard({ scan, adKeywords = [], adsEnabled = true, showAd = true, onAdd }: FoodScanCardProps) {
  const [addState, setAddState] = useState<"idle" | "saving" | "saved">("idle");

  const handleAdd = async () => {
    if (!onAdd || addState !== "idle") return;
    setAddState("saving");
    try {
      await onAdd();
      setAddState("saved");
    } catch (error) {
      console.error("[food-scan-card] add to diary failed", error);
      setAddState("idle");
    }
  };

  const rating = Math.round(scan.rating_out_of_10 * 10) / 10;
  const label = healthLabel(rating);
  const barColor =
    rating >= 6
      ? "linear-gradient(90deg, var(--lime-600), var(--lime-400))"
      : rating >= 4
      ? "var(--warning)"
      : "var(--error)";

  // First suggestion with a whitelisted product becomes the product card
  const productSuggestion = scan.improvement_suggestions.find(
    (s) => s.product_keyword && affiliateLinkFor(s.product_keyword)
  );
  const productLink = productSuggestion ? affiliateLinkFor(productSuggestion.product_keyword) : null;
  const textTips = scan.improvement_suggestions.filter((s) => s !== productSuggestion);

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Verification badge */}
      <div
        className="inline-flex items-center gap-1.5"
        style={{
          alignSelf: "flex-start",
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

      {/* Food name header */}
      <div className="flex items-center" style={{ gap: 14 }}>
        <span
          style={{
            flex: "none",
            width: 52,
            height: 52,
            borderRadius: 12,
            background: "var(--surface-card)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--lime-600)",
          }}
        >
          <UtensilsCrossed size={24} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cl-disp" style={{ fontWeight: 700, fontSize: 17, color: "var(--text-primary)" }}>
            {scan.food_name}
          </div>
          <div className="cl-mono" style={{ fontSize: 13, color: "var(--lime-600)", marginTop: 2 }}>
            {scan.calories} kcal · {scan.portion}
          </div>
        </div>
      </div>

      {/* Macro tiles */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Protein", value: `${scan.protein_g}g`, color: "var(--macro-protein)" },
          { label: "Fiber", value: `${scan.fiber_g}g`, color: "var(--macro-fiber)" },
          { label: "Fat", value: `${scan.fat_g}g`, color: "var(--macro-fat)" },
          { label: "Carbs", value: `${scan.carbs_g}g`, color: "var(--macro-carbs)" },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              padding: "11px 8px",
              textAlign: "center",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, margin: "0 auto 6px" }} />
            <div className="cl-mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{m.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Health score */}
      <div
        className="flex items-center"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "14px 16px",
          gap: 14,
        }}
      >
        <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 3 }}>
          <span className="cl-mono" style={{ fontSize: 28, fontWeight: 700, color: rating >= 6 ? "var(--lime-400)" : label.color, lineHeight: 1 }}>
            {rating}
          </span>
          <span className="cl-mono" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>/10</span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Health score</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: label.color }}>{label.text}</span>
          </div>
          <div style={{ height: 7, background: "var(--surface-elevated)", borderRadius: 99, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, Math.max(0, rating * 10))}%`,
                background: barColor,
                borderRadius: 99,
                transition: "width .6s cubic-bezier(.34,1.56,.64,1)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Expert review */}
      {scan.health_tip && (
        <div style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text-primary)" }}>{scan.health_tip}</div>
      )}

      {/* Text-only improvement tips */}
      {textTips.length > 0 && (
        <div className="space-y-2">
          {textTips.map((suggestion, index) => {
            const link = affiliateLinkFor(suggestion.product_keyword);
            return (
              <div
                key={index}
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
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

      {/* Product suggestion (affiliate) */}
      {productSuggestion && productLink && (
        <div
          className="flex items-center"
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "12px 14px",
            gap: 13,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{productLink.label}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1 }}>{productSuggestion.tip}</div>
          </div>
          <a
            href={productLink.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            style={{
              flex: "none",
              textDecoration: "none",
              padding: "8px 14px",
              border: "1.5px solid var(--lime-400)",
              borderRadius: 9,
              color: "var(--lime-600)",
              fontWeight: 700,
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            View →
          </a>
        </div>
      )}

      {/* Add to diary — always above the ad slot */}
      {onAdd && (
        <button
          onClick={handleAdd}
          disabled={addState !== "idle"}
          className="flex items-center justify-center gap-2 w-full"
          style={{
            padding: "11px 14px",
            borderRadius: 10,
            border: "none",
            background: addState === "saved" ? "rgba(170, 255, 0, 0.12)" : "var(--lime-400)",
            color: addState === "saved" ? "var(--lime-400)" : "#0A0C0F",
            fontSize: 14,
            fontWeight: 700,
            cursor: addState === "idle" ? "pointer" : "default",
            transition: "background 0.15s ease, color 0.15s ease",
          }}
        >
          {addState === "saved" ? (
            <>
              <Check size={15} /> Added to diary
            </>
          ) : addState === "saving" ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Adding…
            </>
          ) : (
            "Add to diary"
          )}
        </button>
      )}

      {/* Contextual native ad — always last */}
      {showAd && <AdCard keywords={adKeywords} enabled={adsEnabled} />}
    </div>
  );
}
