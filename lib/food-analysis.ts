import "server-only";
import { genai, visionModelId } from "./server/genai";
import { verifyFood } from "./server/food-db";
import { resolvePortion, scaleMacrosPer100g, type Macros } from "./portion";
import { judgeDatabaseMatch } from "./server/food-plausibility";
import {
  foodScanAiSchema,
  foodScanResponseSchema,
  type FoodScanResult,
} from "./schemas/food-scan";

/** Shared rules so photo and text scans identify and weigh food the same way. */
const COMMON_RULES = `
IDENTIFICATION
- Name the SPECIFIC dish, not a category: "paneer butter masala", not "curry"; "masala dosa", not "pancake".
- search_name must be the plain generic form used by nutrition databases: lowercase, no brand, no adjectives about cooking vessel or garnish (e.g. "paneer butter masala", "chicken biryani", "rolled oats").
- If several distinct foods are present, name the dominant one in food_identified and list the rest in the review summary.

SANITY (your numbers are the fallback when the database disagrees, so they must stand on their own)
- Sense-check energy density before answering: a brewed drink (chai, coffee, juice) is ~20-60 kcal per 100 ml; a curry or dal ~80-150; rice/roti ~110-350 per 100 g cooked; nuts, oils and dry spice blends are 500-900 per 100 g.
- A glass of sweetened chai is roughly 100-150 kcal, NOT several hundred. If your own number looks extreme for the food, correct it.
- Macros must reconcile with the calories: protein×4 + carbs×4 + fat×9 should land within ~15% of the calorie figure.

PORTION (critical — macros are worthless without it)
- nutrition.portion_grams MUST be the total edible weight of the portion in grams. Never 0, never omitted.
- If the user states a weight or count, use exactly that ("32 g" → 32; "2 rotis" → ~90).
- Otherwise estimate from what you can see, or use a standard Indian/Western serving.
- nutrition.* macros must describe THAT portion — not per 100 g.

REVIEW
- Rate healthiness out of 10 for a fitness-focused person and justify it in 2-3 sentences.
- Give practical improvement tips; when a generic grocery product implements a tip (paneer, olive oil, whey protein), set product_keyword.
- suggested_ad_keywords: 3-6 GENERIC health/fitness shopping phrases about the food category only (e.g. "high protein", "meal prep"). Never personal or sensitive information.`;

const SCAN_PROMPT = `You are Calolean's expert nutritionist AI. Analyze the food in this image (use any extra user context provided).
Estimate nutrition for the VISIBLE portion.
${COMMON_RULES}`;

const TEXT_SCAN_PROMPT = `You are Calolean's expert nutritionist AI. The user DESCRIBES a food in text (no photo).
Analyze the described food for the portion the user states, or one standard serving if they state none.
${COMMON_RULES}`;

function toDisplayName(name: string) {
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function analyzeFoodImage({
  base64Data,
  mimeType,
  mealType = "Snacks",
  userContext,
  history,
}: {
  base64Data: string;
  mimeType: string;
  mealType?: string;
  userContext?: string;
  history?: string;
}): Promise<FoodScanResult> {
  const prompt = [
    SCAN_PROMPT,
    history ? `\nEarlier conversation (for context only):\n${history}` : "",
    userContext ? `\nUser context: ${userContext}` : "",
  ].join("");

  const response = await genai().models.generateContent({
    model: visionModelId(),
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { data: base64Data, mimeType } }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: foodScanResponseSchema,
      temperature: 0.2,
    },
  });

  return finishScan(response.text, mealType, userContext);
}

/**
 * Text-only variant: same structured pipeline, no image. Powers "I ate ..."
 * chat prompts and the diet scanner's type-it-in mode.
 */
export async function analyzeFoodText({
  description,
  mealType = "Snacks",
  history,
  userText,
}: {
  description: string;
  mealType?: string;
  history?: string;
  /**
   * The user's raw message, when `description` is a normalized form of it.
   * Portion resolution reads this: the normalizer can drop the quantity
   * ("32 g of oats" -> "oats"), and losing the weight is exactly what makes
   * macros wrong.
   */
  userText?: string;
}): Promise<FoodScanResult> {
  const prompt = [
    TEXT_SCAN_PROMPT,
    history ? `\nEarlier conversation (resolve pronouns like "it"/"that" against this):\n${history}` : "",
    `\nUser's food description: ${description}`,
  ].join("");

  const response = await genai().models.generateContent({
    model: visionModelId(),
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: foodScanResponseSchema,
      temperature: 0.2,
    },
  });

  // Raw message wins for portion parsing; the normalized description is the
  // fallback (it carries the quantity for follow-ups like "what about 2?").
  return finishScan(response.text, mealType, userText ?? description, userText ? description : undefined);
}

/**
 * Shared tail of both pipelines: parse → resolve the portion → verify against
 * the database → scale the per-100g reference macros to that portion.
 *
 * The `foods` table is a per-100g reference, so a verified match must be scaled
 * before it can replace the model's portion-specific estimate — otherwise a
 * 32 g serving reports the 100 g numbers.
 */
async function finishScan(
  text: string | undefined,
  mealType: string,
  userText?: string,
  altText?: string
): Promise<FoodScanResult> {
  if (!text) throw new Error("AI returned an empty response. Please try again.");

  const parsed = foodScanAiSchema.parse(JSON.parse(text));
  const searchName = parsed.search_name?.toLowerCase().trim() || parsed.food_identified.toLowerCase().trim();
  if (!searchName) throw new Error("AI could not identify a food name. Please try again.");

  const portion = resolvePortion({
    userText,
    altText,
    aiPortionText: parsed.nutrition.portion,
    aiGrams: parsed.nutrition.portion_grams ?? null,
    foodName: parsed.food_identified || searchName,
  });

  const verification = await verifyFood(searchName);

  // The model's own read of the portion. Also the sanity reference the database
  // candidate is judged against below.
  const aiEstimate: Macros = {
    calories: Math.round(parsed.nutrition.calories),
    protein_g: Math.round(parsed.nutrition.protein_g),
    carbs_g: Math.round(parsed.nutrition.carbs_g),
    fat_g: Math.round(parsed.nutrition.fat_g),
    fiber_g: Math.round(parsed.nutrition.fiber_g),
  };

  let macros = aiEstimate;
  let per100g: Macros | null = null;
  let usedDatabase = false;

  if (verification.verified && verification.match) {
    // Database rows are per 100 g — scale them to the resolved portion.
    const reference: Macros = {
      calories: verification.match.calories,
      protein_g: verification.match.protein_g,
      carbs_g: verification.match.carbs_g,
      fat_g: verification.match.fat_g,
      fiber_g: verification.match.fiber_g,
    };
    const scaled = scaleMacrosPer100g(reference, portion.grams);

    // A name search can return a different FORM of the food (the dry "chai
    // masala" blend for a glass of chai). Only let the row override the model
    // when it holds up as the same food.
    const verdict = judgeDatabaseMatch({
      dbName: verification.match.foodName,
      per100g: reference,
      dbScaled: scaled,
      aiEstimate,
      queryName: `${parsed.food_identified} ${searchName} ${userText ?? ""}`,
      portionLabel: portion.label,
    });

    if (verdict.useDatabase) {
      macros = scaled;
      per100g = reference;
      usedDatabase = true;
    } else {
      console.warn(
        `[food-analysis] rejected DB match "${verification.match.foodName}" for "${searchName}": ${verdict.reason}`
      );
    }
  }

  return {
    food_name: toDisplayName(usedDatabase && verification.match ? verification.match.foodName : parsed.food_identified),
    portion: portion.label,
    portion_grams: portion.grams,
    portion_source: portion.source,
    per_100g: per100g,
    calories: macros.calories,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    fiber_g: macros.fiber_g,
    health_tip: parsed.structured_review.summary,
    rating_out_of_10: Math.round(parsed.structured_review.rating_out_of_10 * 10) / 10,
    improvement_suggestions: parsed.structured_review.improvement_suggestions,
    suggested_ad_keywords: parsed.suggested_ad_keywords,
    // Only claim "database verified" when the database actually supplied these
    // numbers — a rejected match must not wear the verified badge.
    verified: usedDatabase,
    confidence: parsed.confidence_score,
    source: usedDatabase ? verification.sourceLabel : "Gemini Estimation",
    meal_type: mealType,
  };
}
