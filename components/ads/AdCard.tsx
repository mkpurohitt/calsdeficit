"use client";
// ChatGPT-style "Sponsored" native ad card rendered after AI responses.
// Targeting input is ONLY the database-verified keyword whitelist coming from
// the API (never raw chat text) — blueprint context-isolation rule, which is
// also what keeps the AdSense integration policy-safe.
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { affiliateLinkFor } from "../../lib/config/affiliate-links";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_NATIVE;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdCardProps {
  keywords?: string[];
  /** From the API's entitlement check; premium users see no ads. */
  enabled?: boolean;
}

export default function AdCard({ keywords = [], enabled = true }: AdCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);
  const [visible, setVisible] = useState(false);

  const adsenseReady = Boolean(ADSENSE_CLIENT && ADSENSE_SLOT);
  // House fallback: show an affiliate product matching the context until
  // AdSense is approved, so the ad-card UX ships from day one.
  const fallback = keywords.map((k) => affiliateLinkFor(k)).find(Boolean) || null;

  useEffect(() => {
    if (!enabled || !adsenseReady || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [enabled, adsenseReady]);

  useEffect(() => {
    if (!visible || pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error("[AdCard] adsbygoogle push failed:", error);
    }
  }, [visible]);

  if (!enabled) return null;
  if (!adsenseReady && !fallback) return null;

  return (
    <div
      ref={containerRef}
      className="animate-fade-in-up"
      style={{
        marginTop: 12,
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-card)",
        overflow: "hidden",
        maxWidth: 520,
      }}
    >
      <div
        style={{
          padding: "6px 14px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        Sponsored
      </div>

      {adsenseReady ? (
        <div style={{ padding: 8, minHeight: 90 }}>
          {visible && (
            <ins
              className="adsbygoogle"
              style={{ display: "block", textAlign: "center" }}
              data-ad-client={ADSENSE_CLIENT}
              data-ad-slot={ADSENSE_SLOT}
              data-ad-layout="in-article"
              data-ad-format="fluid"
            />
          )}
        </div>
      ) : (
        fallback && (
          <a
            href={fallback.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex items-center justify-between gap-3"
            style={{ padding: "14px 16px", textDecoration: "none" }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fallback.label}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                Recommended for your goals — view on Amazon
              </p>
            </div>
            <span
              className="flex items-center gap-1 shrink-0"
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-full)",
                background: "var(--lime-400)",
                color: "#0A0C0F",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              View Offer <ExternalLink size={12} />
            </span>
          </a>
        )
      )}
    </div>
  );
}
