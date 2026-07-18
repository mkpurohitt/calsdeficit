import "server-only";
import { genai, visionModelId } from "./server/genai";
import { verifyFood } from "./server/food-db";
import {
  foodScanAiSchema,
  foodScanResponseSchema,
  type FoodScanResult,
} from "./schemas/food-scan";

const SCAN_PROMPT = `You are Calolean's expert nutritionist AI. Analyze the food in this image (use any extra user context provided).
- Identify the food and estimate nutrition for the VISIBLE portion.
- Rate its healthiness out of 10 for a fitness-focused person.
- Give practical improvement suggestions; when a generic grocery product would implement a tip (e.g. paneer, olive oil, whey protein), set product_keyword.
- suggested_ad_keywords must be 3-6 GENERIC health/fitness shopping phrases about the food category only (e.g. "high protein", "meal prep", "clean eating"). Never include personal or sensitive information.`;

function toDisplayName(name: string) {
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const TEXT_SCAN_PROMPT = `You are Calolean's expert nutritionist AI. The user DESCRIBES a food in text (no photo). Analyze the described food:
- Identify the food and estimate nutrition for one standard serving (or the portion the user states).
- Rate its healthiness out of 10 for a fitness-focused person.
- Give practical improvement suggestions; when a generic grocery product would implement a tip (e.g. paneer, olive oil, whey protein), set product_keyword.
- suggested_ad_keywords must be 3-6 GENERIC health/fitness shopping phrases about the food category only (e.g. "high protein", "meal prep", "clean eating"). Never include personal or sensitive information.`;

export async function analyzeFoodImage({
  base64Data,
  mimeType,
  mealType = "Snacks",
  userContext,
}: {
  base64Data: string;
  mimeType: string;
  mealType?: string;
  userContext?: string;
}): Promise<FoodScanResult> {
  const response = await genai().models.generateContent({
    model: visionModelId(),
    contents: [
      {
        role: "user",
        parts: [
          { text: userContext ? `${SCAN_PROMPT}\n\nUser context: ${userContext}` : SCAN_PROMPT },
          { inlineData: { data: base64Data, mimeType } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: foodScanResponseSchema,
      temperature: 0.2,
    },
  });

  return finishScan(response.text, mealType);
}

/**
 * Text-only variant: same structured pipeline, no image. Powers "I ate ..."
 * chat prompts and the diet scanner's type-it-in mode.
 */
export async function analyzeFoodText({
  description,
  mealType = "Snacks",
}: {
  description: string;
  mealType?: string;
}): Promise<FoodScanResult> {
  const response = await genai().models.generateContent({
    model: visionModelId(),
    contents: [
      {
        role: "user",
        parts: [{ text: `${TEXT_SCAN_PROMPT}\n\nUser's food description: ${description}` }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: foodScanResponseSchema,
      temperature: 0.2,
    },
  });

  return finishScan(response.text, mealType);
}

/** Shared tail of both pipelines: parse → verify against the DB → result. */
async function finishScan(text: string | undefined, mealType: string): Promise<FoodScanResult> {
  if (!text) throw new Error("AI returned an empty response. Please try again.");

  const parsed = foodScanAiSchema.parse(JSON.parse(text));
  const searchName = parsed.search_name?.toLowerCase().trim() || parsed.food_identified.toLowerCase().trim();
  if (!searchName) throw new Error("AI could not identify a food name. Please try again.");

  // Database verification: a verified match's macros override the AI estimate.
  const verification = await verifyFood(searchName);
  const macros = verification.verified && verification.match
    ? verification.match
    : {
        foodName: parsed.food_identified,
        calories: Math.round(parsed.nutrition.calories),
        protein_g: Math.round(parsed.nutrition.protein_g),
        carbs_g: Math.round(parsed.nutrition.carbs_g),
        fat_g: Math.round(parsed.nutrition.fat_g),
        fiber_g: Math.round(parsed.nutrition.fiber_g),
      };

  return {
    food_name: toDisplayName(verification.verified && verification.match ? verification.match.foodName : parsed.food_identified),
    portion: parsed.nutrition.portion,
    calories: macros.calories,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    fiber_g: macros.fiber_g,
    health_tip: parsed.structured_review.summary,
    rating_out_of_10: Math.round(parsed.structured_review.rating_out_of_10 * 10) / 10,
    improvement_suggestions: parsed.structured_review.improvement_suggestions,
    suggested_ad_keywords: parsed.suggested_ad_keywords,
    verified: verification.verified,
    confidence: parsed.confidence_score,
    source: verification.sourceLabel,
    meal_type: mealType,
  };
}
