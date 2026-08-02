import { z } from "zod";
import { Type, type Schema } from "@google/genai";

/** Zod schema for validating Gemini's structured food-scan output. */
export const foodScanAiSchema = z.object({
  food_identified: z.string(),
  search_name: z.string(),
  confidence_score: z.number().min(0).max(1).catch(0.5),
  suggested_ad_keywords: z.array(z.string()).max(8).catch([]),
  structured_review: z.object({
    rating_out_of_10: z.number().min(0).max(10).catch(5),
    summary: z.string().catch(""),
    improvement_suggestions: z
      .array(
        z.object({
          tip: z.string(),
          product_keyword: z.string().optional().nullable(),
        })
      )
      .max(4)
      .catch([]),
  }),
  nutrition: z.object({
    calories: z.number().catch(0),
    protein_g: z.number().catch(0),
    carbs_g: z.number().catch(0),
    fat_g: z.number().catch(0),
    fiber_g: z.number().catch(0),
    portion: z.string().catch("1 serving (estimated)"),
    /** Numeric weight of `portion` in grams — what the per-100g DB scaling uses. */
    portion_grams: z.number().nullable().optional().catch(null),
  }),
});

export type FoodScanAiOutput = z.infer<typeof foodScanAiSchema>;

/** Gemini responseSchema mirroring foodScanAiSchema (blueprint §C). */
export const foodScanResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    food_identified: { type: Type.STRING, description: "Display name of the identified food" },
    search_name: {
      type: Type.STRING,
      description: "Short lowercase generic name for nutrition database lookup, e.g. 'grilled chicken breast'",
    },
    confidence_score: { type: Type.NUMBER, description: "Identification confidence 0-1" },
    suggested_ad_keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-6 generic health/fitness shopping keywords related to this food (never personal data)",
    },
    structured_review: {
      type: Type.OBJECT,
      properties: {
        rating_out_of_10: { type: Type.NUMBER, description: "Health rating of this food 0-10" },
        summary: { type: Type.STRING, description: "2-3 sentence expert review of the food's nutrition profile" },
        improvement_suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              tip: { type: Type.STRING, description: "How to make this meal healthier" },
              product_keyword: {
                type: Type.STRING,
                description:
                  "Optional single generic grocery product that implements the tip, e.g. 'paneer', 'olive oil', 'whey protein'",
              },
            },
            required: ["tip"],
          },
        },
      },
      required: ["rating_out_of_10", "summary", "improvement_suggestions"],
    },
    nutrition: {
      type: Type.OBJECT,
      properties: {
        calories: { type: Type.NUMBER },
        protein_g: { type: Type.NUMBER },
        carbs_g: { type: Type.NUMBER },
        fat_g: { type: Type.NUMBER },
        fiber_g: { type: Type.NUMBER },
        portion: { type: Type.STRING, description: "Human portion phrase, e.g. '1 plate (~350g)' or '2 rotis'" },
        portion_grams: {
          type: Type.NUMBER,
          description:
            "The portion's total edible weight in GRAMS (millilitres for liquids). Always give your best numeric estimate — e.g. 2 rotis = 90, 1 katori dal = 150, 1 plate biryani = 350. Never 0.",
        },
      },
      required: ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "portion", "portion_grams"],
    },
  },
  required: ["food_identified", "search_name", "suggested_ad_keywords", "structured_review", "nutrition"],
};

/** Final shape returned to the client and saved into food logs. */
export interface FoodScanResult {
  food_name: string;
  portion: string;
  /** Resolved portion weight the macros below correspond to. */
  portion_grams?: number;
  /** Where the weight came from — "default" means we assumed a standard serving. */
  portion_source?: "user" | "ai" | "default";
  /** Reference macros per 100 g (present when a database match was scaled). */
  per_100g?: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } | null;
  /** Hero image for text-only scans (no user photo). */
  image_url?: string | null;
  image_attribution?: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  health_tip: string;
  rating_out_of_10: number;
  improvement_suggestions: { tip: string; product_keyword?: string | null }[];
  suggested_ad_keywords: string[];
  verified: boolean;
  confidence: number;
  source: string;
  meal_type: string;
}
