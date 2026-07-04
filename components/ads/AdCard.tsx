"use client";
// ChatGPT-style "Sponsored" native ad card rendered after AI responses.
// Targeting input is ONLY the database-verified keyword whitelist coming from
// the API (never raw chat text) — blueprint context-isolation rule, which is
// also what keeps the AdSense integration policy-safe.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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
  const [hidden, setHidden] = useState(false);

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

  if (!enabled || hidden) return null;
  if (!adsenseReady && !fallback) return null;

  // AdSense unit keeps its labelled container; the affiliate fallback uses the
  // v2 compact "sponsored" row.
  if (adsenseReady) {
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
      </div>
    );
  }

  return (
    fallback && (
      <div
        ref={containerRef}
        className="animate-fade-in-up flex items-center"
        style={{
          marginTop: 12,
          gap: 13,
          padding: "13px 16px",
          borderRadius: 14,
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-card)",
          maxWidth: 520,
          opacity: 0.92,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center" style={{ gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fallback.label}</span>
            <span
              className="cl-mono"
              style={{
                flex: "none",
                fontSize: 9,
                letterSpacing: ".08em",
                padding: "2px 7px",
                borderRadius: 5,
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-tertiary)",
              }}
            >
              SPONSORED
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>
            Recommended for your goals — view on Amazon
          </div>
        </div>
        <a
          href={fallback.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          style={{
            flex: "none",
            textDecoration: "none",
            padding: "7px 13px",
            background: "var(--surface-elevated)",
            border: "1px solid var(--border-color)",
            borderRadius: 9,
            color: "var(--text-secondary)",
            fontWeight: 600,
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          Learn more
        </a>
        <button
          onClick={() => setHidden(true)}
          title="Hide this ad"
          aria-label="Hide this ad"
          style={{
            flex: "none",
            width: 24,
            height: 24,
            border: "none",
            background: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={13} />
        </button>
      </div>
    )
  );
}
