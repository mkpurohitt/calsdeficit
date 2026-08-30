/**
 * Portion resolution + macro scaling.
 *
 * The `foods` table stores macros **per 100 g** (USDA/IFCT/CNF/Norway are all
 * per-100g references, and Open Food Facts is read from its `*_100g` fields).
 * A scan, however, is about a real serving — "32 g", "2 rotis", "1 cup".
 * Everything here exists to turn a portion phrase into grams so the per-100g
 * numbers can be scaled to what the user actually ate.
 *
 * Pure + dependency-free so it can run on the server (analysis) and be unit
 * tested directly.
 */

export type PortionSource = "user" | "ai" | "default";

export interface PortionInfo {
  /** Resolved edible weight in grams. */
  grams: number;
  /** Human label for the card, e.g. "2 rotis (~90 g)". */
  label: string;
  /** Where the weight came from — drives the "estimated" hint in the UI. */
  source: PortionSource;
}

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

/* ── Weight units → grams ────────────────────────────────────────────────── */

const MASS_UNITS: Record<string, number> = {
  g: 1, gm: 1, gms: 1, gram: 1, grams: 1, gramme: 1, grammes: 1,
  kg: 1000, kgs: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
  mg: 0.001,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  // Volume treated as ~1 g/ml — correct for water/milk/juice, close enough for
  // the drinks people actually log.
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000,
};

/**
 * Household measures → grams. Deliberately conservative averages; these only
 * apply when no explicit weight is present.
 */
const HOUSEHOLD_UNITS: Record<string, number> = {
  cup: 240, cups: 240,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  glass: 250, glasses: 250,
  bowl: 200, bowls: 200,
  plate: 350, plates: 350,
  katori: 150, katoris: 150,
  scoop: 30, scoops: 30,
  handful: 30, handfuls: 30,
  slice: 30, slices: 30,
  piece: 50, pieces: 50,
  serving: 100, servings: 100,
  packet: 50, packets: 50, pack: 50,
  can: 330, cans: 330,
  bottle: 500, bottles: 500,
};

/**
 * Per-item weights for foods people count rather than weigh. Matched against
 * the food name / portion text. Longest key wins so "boiled egg" beats "egg".
 */
const ITEM_WEIGHTS: Record<string, number> = {
  roti: 45, chapati: 45, phulka: 40, paratha: 80, naan: 90, puri: 25,
  idli: 40, dosa: 90, vada: 45, samosa: 60, dhokla: 40,
  egg: 50, "boiled egg": 50, "egg white": 33, "egg yolk": 17,
  banana: 118, apple: 182, orange: 130, mango: 200, guava: 120,
  "slice of bread": 28, bread: 28, toast: 28, bun: 60, chapathi: 45,
  biscuit: 12, cookie: 16, rusk: 12,
  almond: 1.2, almonds: 1.2, cashew: 1.6, cashews: 1.6, walnut: 4, walnuts: 4,
  date: 8, dates: 8, "dry date": 8,
  momo: 25, momos: 25, dumpling: 25,
  chapati_roll: 120, wrap: 200, sandwich: 150, burger: 220, pizza: 110,
  "pizza slice": 110, samosa_large: 90, laddu: 45, ladoo: 45, barfi: 30,
  gulab_jamun: 45, "gulab jamun": 45, rasgulla: 50, jalebi: 25,
  chicken_breast: 174, "chicken breast": 174, "chicken leg": 150,
  "chapati roll": 120, paneer_cube: 15, "paneer cube": 15,
  "protein bar": 60, "energy bar": 50, "protein scoop": 30,
};

/**
 * Fallback serving sizes by food category, used when the user gives no weight
 * and no countable item matches. Keeps "dal" from defaulting to a flat 100 g.
 */
const CATEGORY_DEFAULTS: { match: RegExp; grams: number; unit: string }[] = [
  { match: /\b(water|juice|smoothie|shake|lassi|buttermilk|soda|cola|beer)\b/i, grams: 250, unit: "1 glass" },
  { match: /\b(tea|chai|coffee|espresso|latte)\b/i, grams: 150, unit: "1 cup" },
  { match: /\b(milk)\b/i, grams: 240, unit: "1 cup" },
  { match: /\b(dal|daal|curry|sabzi|sabji|gravy|soup|stew|rajma|chole|sambar|kadhi)\b/i, grams: 150, unit: "1 katori" },
  { match: /\b(rice|biryani|pulao|pilaf|khichdi|poha|upma|noodles|pasta|spaghetti)\b/i, grams: 180, unit: "1 bowl" },
  { match: /\b(yogurt|curd|dahi|raita)\b/i, grams: 150, unit: "1 katori" },
  { match: /\b(salad|sabudana)\b/i, grams: 120, unit: "1 bowl" },
  { match: /\b(oil|ghee|butter|mayonnaise|dressing)\b/i, grams: 10, unit: "1 tbsp" },
  { match: /\b(sugar|honey|jam|ketchup|sauce|chutney|pickle|achar)\b/i, grams: 15, unit: "1 tbsp" },
  { match: /\b(nuts|seeds|peanuts|trail mix|granola|muesli)\b/i, grams: 30, unit: "1 handful" },
  { match: /\b(cheese|paneer|tofu)\b/i, grams: 50, unit: "50 g" },
  { match: /\b(chicken|mutton|fish|prawn|beef|pork|meat)\b/i, grams: 150, unit: "1 serving" },
  { match: /\b(chips|namkeen|snack|crisps)\b/i, grams: 40, unit: "1 packet" },
  { match: /\b(chocolate|candy|sweet|dessert|cake|pastry|ice cream)\b/i, grams: 60, unit: "1 serving" },
  { match: /\b(protein powder|whey)\b/i, grams: 30, unit: "1 scoop" },
];

/** Anything with no better signal. 100 g == the reference basis (no scaling). */
const GENERIC_DEFAULT_GRAMS = 100;

/** Volume units keep their own label so "250 ml milk" never reads "250 g". */
const VOLUME_UNITS = new Set(["ml", "milliliter", "milliliters", "millilitre", "millilitres", "l", "litre", "litres", "liter", "liters"]);

/** Spelled-out counts people actually type. */
const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, dozen: 12,
  half: 0.5, quarter: 0.25,
};

/**
 * A quantity. The leading lookbehind is essential: without it the spelled-out
 * numbers match *inside* ordinary words — "d(a)(l)" would parse as 1 litre,
 * and "me(a)(l)" likewise — so a quantity must start at a word boundary.
 */
const NUM = String.raw`(?<![\p{L}\d])(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|½|¼|¾|\d+\s*½|${Object.keys(WORD_NUMBERS).join("|")})`;

/** "1/2" / "½" / "1,5" / "half" → number. */
function toNumber(raw: string): number {
  const s = raw.trim().toLowerCase().replace(/,/g, ".");
  if (s in WORD_NUMBERS) return WORD_NUMBERS[s];
  if (s === "½") return 0.5;
  if (s === "¼") return 0.25;
  if (s === "¾") return 0.75;
  const half = s.match(/^(\d+)\s*½$/);
  if (half) return Number(half[1]) + 0.5;
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d ? Number(frac[1]) / d : NaN;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Explicit weight/volume in a phrase → grams. Returns null when the text
 * carries no real measurement ("a plate of rice" → null; "350g" → 350).
 */
export function parseExplicitGrams(text: string | null | undefined): number | null {
  return parseMeasure(text)?.grams ?? null;
}

/** Explicit measurement with the unit preserved for display. */
function parseMeasure(text: string | null | undefined): { grams: number; label: string } | null {
  if (!text) return null;
  const unitAlternation = Object.keys(MASS_UNITS).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`${NUM}\\s*(${unitAlternation})\\b`, "giu");
  let best: { grams: number; label: string } | null = null;
  for (const m of text.matchAll(re)) {
    const qty = toNumber(m[1]);
    const unit = m[2].toLowerCase();
    const factor = MASS_UNITS[unit];
    if (!Number.isFinite(qty) || !factor) continue;
    const grams = qty * factor;
    if (grams <= 0) continue;
    // Several numbers can appear ("1 plate (~350 g)") — the largest explicit
    // mass is the portion; smaller ones are usually per-unit asides.
    if (best === null || grams > best.grams) {
      // Volumes keep their own unit; masses normalize to g/kg.
      const label = VOLUME_UNITS.has(unit)
        ? `${trimNum(qty)} ${unit === "l" || unit.startsWith("lit") ? "L" : "ml"}`
        : formatWeight(grams);
      best = { grams, label };
    }
  }
  return best;
}

/** "2 rotis" / "3 slices" / "1.5 cups" → grams, using the count tables. */
function parseCountedGrams(text: string | null | undefined): { grams: number; label: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Countable food items first (roti, egg, banana …) — longest key wins.
  const itemKeys = Object.keys(ITEM_WEIGHTS).sort((a, b) => b.length - a.length);
  for (const key of itemKeys) {
    const word = key.replace(/_/g, "[ _-]?");
    const re = new RegExp(`${NUM}\\s*(?:x\\s*)?${word}s?\\b`, "iu");
    const m = lower.match(re);
    if (m) {
      const qty = toNumber(m[1]);
      if (Number.isFinite(qty) && qty > 0) {
        const grams = qty * ITEM_WEIGHTS[key];
        const plural = qty === 1 ? key : `${key}s`;
        return { grams, label: `${trimNum(qty)} ${plural.replace(/_/g, " ")}` };
      }
    }
  }

  // Household measures (cup, bowl, katori …).
  const unitKeys = Object.keys(HOUSEHOLD_UNITS).sort((a, b) => b.length - a.length);
  for (const key of unitKeys) {
    const re = new RegExp(`${NUM}\\s*${key}\\b`, "iu");
    const m = lower.match(re);
    if (m) {
      const qty = toNumber(m[1]);
      if (Number.isFinite(qty) && qty > 0) {
        return { grams: qty * HOUSEHOLD_UNITS[key], label: `${trimNum(qty)} ${key}` };
      }
    }
  }
  return null;
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Standard-serving default for a food with no stated quantity. */
function defaultPortionFor(foodName: string): { grams: number; label: string } {
  const name = (foodName || "").toLowerCase();

  // A bare countable food ("roti", "egg") defaults to one of them.
  const itemKeys = Object.keys(ITEM_WEIGHTS).sort((a, b) => b.length - a.length);
  for (const key of itemKeys) {
    const word = key.replace(/_/g, "[ _-]?");
    if (new RegExp(`\\b${word}s?\\b`, "i").test(name)) {
      return { grams: ITEM_WEIGHTS[key], label: `1 ${key.replace(/_/g, " ")}` };
    }
  }
  for (const cat of CATEGORY_DEFAULTS) {
    if (cat.match.test(name)) return { grams: cat.grams, label: cat.unit };
  }
  return { grams: GENERIC_DEFAULT_GRAMS, label: "100 g" };
}

/**
 * Resolve the portion for a scan.
 *
 * Precedence: an explicit weight the user typed → a count they gave ("2 rotis")
 * → the model's own gram estimate (it can see the plate) → a sensible default.
 */
export function resolvePortion({
  userText,
  altText,
  aiPortionText,
  aiGrams,
  foodName,
}: {
  /** Raw message the user typed, if any. */
  userText?: string | null;
  /**
   * Normalized restatement of the message (e.g. the intent router's
   * "2 rotis" for "what about 2 of them?"). Checked only when the raw text
   * carries no quantity of its own, so a follow-up still resolves.
   */
  altText?: string | null;
  /** Portion phrase the model returned, e.g. "1 plate (~350 g)". */
  aiPortionText?: string | null;
  /** Explicit gram estimate from the model. */
  aiGrams?: number | null;
  foodName: string;
}): PortionInfo {
  // 1. Explicit weight typed by the user wins over everything.
  const userMeasure = parseMeasure(userText);
  if (userMeasure) {
    return { grams: round1(userMeasure.grams), label: userMeasure.label, source: "user" };
  }

  // 2. A count the user gave ("2 rotis", "1 cup rice").
  const userCount = parseCountedGrams(userText);
  if (userCount) {
    return {
      grams: round1(userCount.grams),
      label: `${userCount.label} (~${formatWeight(userCount.grams)})`,
      source: "user",
    };
  }

  // 3. Same two checks against the normalized restatement, so a follow-up
  //    like "what about 2 of them?" still resolves to a real weight.
  const altMeasure = parseMeasure(altText);
  if (altMeasure) {
    return { grams: round1(altMeasure.grams), label: altMeasure.label, source: "user" };
  }
  const altCount = parseCountedGrams(altText);
  if (altCount) {
    return {
      grams: round1(altCount.grams),
      label: `${altCount.label} (~${formatWeight(altCount.grams)})`,
      source: "user",
    };
  }

  // 4. The model's numeric estimate (photos: it can judge the plate).
  if (typeof aiGrams === "number" && Number.isFinite(aiGrams) && aiGrams > 0) {
    const label = aiPortionText?.trim()
      ? /\d/.test(aiPortionText) && parseExplicitGrams(aiPortionText)
        ? aiPortionText.trim()
        : `${aiPortionText.trim()} (~${formatWeight(aiGrams)})`
      : formatWeight(aiGrams);
    return { grams: round1(aiGrams), label, source: "ai" };
  }

  // 5. Weight embedded in the model's portion phrase.
  const aiTextGrams = parseExplicitGrams(aiPortionText);
  if (aiTextGrams && aiTextGrams > 0) {
    return { grams: round1(aiTextGrams), label: (aiPortionText || "").trim() || formatWeight(aiTextGrams), source: "ai" };
  }
  const aiCount = parseCountedGrams(aiPortionText);
  if (aiCount) {
    return {
      grams: round1(aiCount.grams),
      label: `${aiCount.label} (~${formatWeight(aiCount.grams)})`,
      source: "ai",
    };
  }

  // 6. Nothing stated anywhere — fall back to a standard serving.
  const fallback = defaultPortionFor(foodName);
  return {
    grams: fallback.grams,
    label: `${fallback.label}${/\d\s*g$/.test(fallback.label) ? "" : ` (~${formatWeight(fallback.grams)})`}`,
    source: "default",
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) return `${round1(grams / 1000)} kg`;
  return `${Math.round(grams)} g`;
}

/**
 * Scale per-100g reference macros to an actual portion.
 * `grams` of 100 is the identity case.
 */
export function scaleMacrosPer100g(per100g: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    calories: Math.round(per100g.calories * f),
    protein_g: round1(per100g.protein_g * f),
    carbs_g: round1(per100g.carbs_g * f),
    fat_g: round1(per100g.fat_g * f),
    fiber_g: round1(per100g.fiber_g * f),
  };
}
