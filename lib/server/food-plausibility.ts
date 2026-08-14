import "server-only";
import type { Macros } from "../portion";

/**
 * Plausibility gate between the food database and the model.
 *
 * The database is a per-100g reference keyed by a trigram name search, so it
 * can return a row for a *different form* of the food — "chai masala" (the dry
 * spice blend, 393 kcal/100g) for someone who drank a glass of chai. Scaling
 * that to a 250 ml serving reported 983 kcal for a cup of tea.
 *
 * So a database hit is treated as a candidate, not as truth: it only overrides
 * the model when it survives these checks. The model always produces its own
 * portion-specific estimate, and that estimate is the sanity reference — it at
 * least knows which food the user actually named.
 */

/** Nothing edible exceeds pure fat, so anything above this is a bad row. */
const MAX_KCAL_PER_100G = 902;

/** Above this, a drink is a syrup or a dry mix — not something you sip. */
const MAX_KCAL_PER_100ML_DRINK = 150;

/** How far apart the two sources may be before we stop believing the database. */
const MAX_DISAGREEMENT = 2.5;

/**
 * Forms that are far more energy-dense than the prepared food of the same name.
 * A row whose name carries one of these, for a query that doesn't, is the wrong
 * form of the ingredient.
 */
const CONCENTRATED_FORMS = [
  "powder", "powdered", "mix", "premix", "spice", "spices", "seasoning",
  "dried", "dehydrated", "dehydrate", "concentrate", "concentrated", "extract",
  "granules", "instant", "paste", "syrup", "essence", "cube", "cubes",
];

/**
 * "masala" is deliberately NOT in the list above: in Indian cooking it names
 * ordinary dishes (masala dosa, paneer butter masala) as often as it names a
 * spice blend, so treating it as a concentrate would reject real meals. The
 * drink and disagreement checks catch the blend cases instead.
 */

/** Drinks — where a dry-mix mismatch is both most likely and most wrong. */
const DRINK_WORDS = [
  "chai", "tea", "coffee", "latte", "espresso", "cappuccino", "milk", "juice",
  "water", "soda", "cola", "lassi", "buttermilk", "chaas", "smoothie", "shake",
  "drink", "beverage", "beer", "wine", "kombucha", "lemonade", "sherbet",
];

/** Drinks that legitimately carry real calories, so the drink cap shouldn't bite. */
const RICH_DRINKS = ["shake", "smoothie", "lassi", "milkshake"];

export interface PlausibilityVerdict {
  /** Whether the database row should override the model's estimate. */
  useDatabase: boolean;
  /** Short machine-ish reason, logged when the database is rejected. */
  reason?: string;
}

function hasWord(text: string, words: string[]): boolean {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return words.some((w) => t.includes(` ${w} `));
}

/**
 * Decide whether a database match is really the food the user meant.
 *
 * `aiEstimate` is the model's macros for the SAME portion, so the two are
 * directly comparable.
 */
export function judgeDatabaseMatch({
  dbName,
  per100g,
  dbScaled,
  aiEstimate,
  queryName,
  portionLabel,
}: {
  dbName: string;
  per100g: Macros;
  dbScaled: Macros;
  aiEstimate: Macros;
  /** What the user/model called the food. */
  queryName: string;
  /** Resolved portion label, e.g. "1 glass (~250 g)". */
  portionLabel: string;
}): PlausibilityVerdict {
  // 1. Physically impossible energy density — a broken or mis-scaled row.
  if (per100g.calories > MAX_KCAL_PER_100G) {
    return { useDatabase: false, reason: `density ${per100g.calories} kcal/100g exceeds pure fat` };
  }

  // 2. Wrong FORM of the right ingredient: the row is a powder/paste/spice but
  //    the user didn't ask for one. This is the "chai masala" case.
  const dbForm = CONCENTRATED_FORMS.filter((w) => hasWord(dbName, [w]));
  const askedForForm = dbForm.some((w) => hasWord(queryName, [w]));
  if (dbForm.length > 0 && !askedForForm) {
    return { useDatabase: false, reason: `row is a concentrated form (${dbForm.join("/")}) the user did not ask for` };
  }

  // 3. Drinks: a sippable beverage cannot be this energy-dense. Skipped when the
  //    user actually asked about the powder/mix — then the dense row is right.
  const wantsConcentrate = CONCENTRATED_FORMS.some((w) => hasWord(queryName, [w]));
  const isDrink = hasWord(queryName, DRINK_WORDS) || hasWord(portionLabel, ["glass", "cup", "mug", "bottle"]);
  const isRichDrink = hasWord(queryName, RICH_DRINKS);
  if (isDrink && !isRichDrink && !wantsConcentrate && per100g.calories > MAX_KCAL_PER_100ML_DRINK) {
    return { useDatabase: false, reason: `drink at ${per100g.calories} kcal/100ml is a mix, not a beverage` };
  }

  // 4. Cross-check against the model. Without a usable reference we keep the
  //    database — it is still the better default.
  if (!Number.isFinite(aiEstimate.calories) || aiEstimate.calories <= 0) {
    return { useDatabase: true };
  }
  const hi = Math.max(dbScaled.calories, aiEstimate.calories);
  const lo = Math.min(dbScaled.calories, aiEstimate.calories);
  if (lo > 0 && hi / lo > MAX_DISAGREEMENT) {
    return {
      useDatabase: false,
      reason: `database ${dbScaled.calories} kcal vs model ${aiEstimate.calories} kcal (${(hi / lo).toFixed(1)}x apart)`,
    };
  }

  return { useDatabase: true };
}
