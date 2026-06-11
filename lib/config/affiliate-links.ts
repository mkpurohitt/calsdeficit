/**
 * Keyword → Amazon affiliate link map. ONLY keywords present here ever render
 * as links — this whitelist is both the monetization config and the privacy /
 * Amazon-ToS insulation layer (raw AI text never becomes a link).
 *
 * Add products freely; keys are matched case-insensitively against the
 * `product_keyword` Gemini suggests.
 */
const TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || "";

export interface AffiliateLink {
  label: string;
  url: string;
}

function amazon(search: string): string {
  const base = `https://www.amazon.in/s?k=${encodeURIComponent(search)}`;
  return TAG ? `${base}&tag=${encodeURIComponent(TAG)}` : base;
}

const AFFILIATE_MAP: Record<string, AffiliateLink> = {
  "paneer":        { label: "High-Protein Paneer", url: amazon("high protein paneer") },
  "whey protein":  { label: "Whey Protein", url: amazon("whey protein powder") },
  "protein powder":{ label: "Protein Powder", url: amazon("protein powder") },
  "protein bar":   { label: "Protein Bars", url: amazon("protein bars") },
  "peanut butter": { label: "Natural Peanut Butter", url: amazon("natural peanut butter unsweetened") },
  "olive oil":     { label: "Extra Virgin Olive Oil", url: amazon("cold pressed extra virgin olive oil") },
  "oats":          { label: "Rolled Oats", url: amazon("rolled oats") },
  "almonds":       { label: "Raw Almonds", url: amazon("raw almonds") },
  "chia seeds":    { label: "Chia Seeds", url: amazon("organic chia seeds") },
  "flax seeds":    { label: "Flax Seeds", url: amazon("roasted flax seeds") },
  "greek yogurt":  { label: "Greek Yogurt", url: amazon("greek yogurt high protein") },
  "honey":         { label: "Raw Honey", url: amazon("raw organic honey") },
  "brown rice":    { label: "Brown Rice", url: amazon("brown rice") },
  "quinoa":        { label: "Quinoa", url: amazon("organic quinoa") },
  "green tea":     { label: "Green Tea", url: amazon("green tea bags") },
  "multivitamin":  { label: "Multivitamin", url: amazon("multivitamin tablets") },
  "creatine":      { label: "Creatine Monohydrate", url: amazon("creatine monohydrate") },
  "tofu":          { label: "Tofu", url: amazon("tofu") },
  "eggs":          { label: "Protein-Rich Eggs", url: amazon("protein eggs") },
  "dark chocolate":{ label: "Dark Chocolate (85%)", url: amazon("dark chocolate 85 percent") },
};

export function affiliateLinkFor(keyword?: string | null): AffiliateLink | null {
  if (!keyword) return null;
  const key = keyword.toLowerCase().trim();
  if (AFFILIATE_MAP[key]) return AFFILIATE_MAP[key];
  // tolerate minor variations like "whey protein powder"
  const partial = Object.keys(AFFILIATE_MAP).find((k) => key.includes(k) || k.includes(key));
  return partial ? AFFILIATE_MAP[partial] : null;
}
