export type Tier = "free" | "premium";

/** What each prompt kind costs, in percent of the 24-hour usage window. */
export type UsageKind = "text" | "image" | "video";
export const USAGE_COSTS: Record<UsageKind, number> = {
  text: 8,
  image: 10,
  video: 20,
};

export interface TierConfig {
  label: string;
  /** Usage costs are divided by this (premium stretches the same window further). */
  usageDivisor: number;
  ads: boolean;
}

export const TIERS: Record<Tier, TierConfig> = {
  free: { label: "Free Plan", usageDivisor: 1, ads: true },
  premium: { label: "Premium", usageDivisor: 5, ads: false },
};

export function tierConfig(tier: string | undefined | null): TierConfig {
  return TIERS[(tier as Tier) || "free"] || TIERS.free;
}
