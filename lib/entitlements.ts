export type Tier = "free" | "premium";

export interface TierConfig {
  label: string;
  dailyPrompts: number;
  ads: boolean;
}

export const TIERS: Record<Tier, TierConfig> = {
  free: { label: "Free Plan", dailyPrompts: 10, ads: true },
  premium: { label: "Premium", dailyPrompts: 100, ads: false },
};

export function tierConfig(tier: string | undefined | null): TierConfig {
  return TIERS[(tier as Tier) || "free"] || TIERS.free;
}
