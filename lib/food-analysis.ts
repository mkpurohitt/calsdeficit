import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const visionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
const liteModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

interface MacroResult {
  foodName: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: string;
}

export interface FoodAnalysisResult {
  food_name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  health_tip: string;
  source: string;
  meal_type: string;
}

const VISION_PROMPT = `You are an expert food identification AI. Identify the food in this image.
Return ONLY a raw JSON object with NO markdown, NO code fences. Just raw JSON:

{
  "searchName": "a clean short lowercase search string optimized for nutrition database lookup, e.g. 'grilled chicken breast', 'masala dosa', 'pepperoni pizza'",
  "fallbackMacros": {
    "calories": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fat_g": 0,
    "fiber_g": 0
  }
}

Rules:
- searchName must be lowercase, short, and generic
- fallbackMacros should estimate values for the visible portion in the image
- calories, protein_g, carbs_g, fat_g, fiber_g must be numbers`;

const HEALTH_TIP_PROMPT = (foodName: string, macros: MacroResult) =>
  `Food: ${foodName} - ${macros.calories} kcal, Protein: ${macros.protein_g}g, Carbs: ${macros.carbs_g}g, Fat: ${macros.fat_g}g, Fiber: ${macros.fiber_g}g.
Give one practical health tip about this food in 1-2 sentences.`;

async function fetchUSDA(query: string): Promise<MacroResult | null> {
  try {
    if (!process.env.USDA_API_KEY) return null;

    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=1&api_key=${process.env.USDA_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = await res.json();
    const food = data?.foods?.[0];
    if (!food?.foodNutrients) return null;

    const getNutrient = (num: number): number => {
      const nutrient = food.foodNutrients?.find((item: { nutrientNumber?: string; value?: number }) => String(item.nutrientNumber) === String(num));
      return nutrient?.value ?? 0;
    };

    const calories = getNutrient(208);
    const protein = getNutrient(203);
    if (calories === 0 && protein === 0) return null;

    return {
      foodName: food.description || query,
      calories: Math.round(calories),
      protein_g: Math.round(protein),
      carbs_g: Math.round(getNutrient(205)),
      fat_g: Math.round(getNutrient(204)),
      fiber_g: Math.round(getNutrient(291)),
      source: "USDA",
    };
  } catch {
    return null;
  }
}

async function fetchOpenFoodFacts(query: string): Promise<MacroResult | null> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = await res.json();
    const product = data?.products?.[0];
    if (!product?.nutriments) return null;

    const nutriments = product.nutriments;
    const calories = Math.round(nutriments["energy-kcal_100g"] || nutriments["energy-kcal"] || 0);
    const protein = Math.round(nutriments.proteins_100g || nutriments.proteins || 0);
    if (calories === 0 && protein === 0) return null;

    return {
      foodName: product.product_name || query,
      calories,
      protein_g: protein,
      carbs_g: Math.round(nutriments.carbohydrates_100g || nutriments.carbohydrates || 0),
      fat_g: Math.round(nutriments.fat_100g || nutriments.fat || 0),
      fiber_g: Math.round(nutriments.fiber_100g || nutriments.fiber || 0),
      source: "Open Data Food Set",
    };
  } catch {
    return null;
  }
}

async function fetchFromNutritionCache(searchKey: string): Promise<MacroResult | null> {
  const { data } = await supabase
    .from("nutrition_cache")
    .select("nutrition_data, source")
    .eq("search_key", searchKey)
    .single();

  if (!data?.nutrition_data) return null;

  return {
    foodName: data.nutrition_data.foodName || searchKey,
    calories: data.nutrition_data.calories || 0,
    protein_g: data.nutrition_data.protein_g || 0,
    carbs_g: data.nutrition_data.carbs_g || 0,
    fat_g: data.nutrition_data.fat_g || 0,
    fiber_g: data.nutrition_data.fiber_g || 0,
    source: data.source || "Database Cache",
  };
}

async function cacheNutrition(searchKey: string, result: MacroResult) {
  await supabase.from("nutrition_cache").upsert({
    search_key: searchKey,
    nutrition_data: {
      foodName: result.foodName,
      calories: result.calories,
      protein_g: result.protein_g,
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      fiber_g: result.fiber_g,
    },
    source: result.source,
  }, { onConflict: "search_key" });
}

async function generateHealthTip(foodName: string, macros: MacroResult) {
  try {
    const result = await liteModel.generateContent(HEALTH_TIP_PROMPT(foodName, macros));
    return result.response.text().trim();
  } catch {
    return "";
  }
}

function toDisplayName(foodName: string) {
  return foodName
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function analyzeFoodImage({
  base64Data,
  mimeType,
  mealType = "Snacks",
}: {
  base64Data: string;
  mimeType: string;
  mealType?: string;
}): Promise<FoodAnalysisResult> {
  const visionResult = await visionModel.generateContent([
    { text: VISION_PROMPT },
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
  ]);

  let cleaned = visionResult.response.text().trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }

  const parsed = JSON.parse(cleaned) as {
    searchName: string;
    fallbackMacros?: {
      calories?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      fiber_g?: number;
    };
  };

  const searchKey = parsed.searchName?.toLowerCase().trim();
  if (!searchKey) {
    throw new Error("AI could not identify a food name. Please try again.");
  }

  let macroResult = await fetchUSDA(searchKey);
  if (!macroResult) macroResult = await fetchOpenFoodFacts(searchKey);
  if (!macroResult) macroResult = await fetchFromNutritionCache(searchKey);

  if (!macroResult) {
    const fallback = parsed.fallbackMacros || {};
    macroResult = {
      foodName: searchKey,
      calories: Math.round(Number(fallback.calories) || 0),
      protein_g: Math.round(Number(fallback.protein_g) || 0),
      carbs_g: Math.round(Number(fallback.carbs_g) || 0),
      fat_g: Math.round(Number(fallback.fat_g) || 0),
      fiber_g: Math.round(Number(fallback.fiber_g) || 0),
      source: "Gemini Estimation",
    };
  }

  await cacheNutrition(searchKey, macroResult);
  const healthTip = await generateHealthTip(macroResult.foodName, macroResult);

  return {
    food_name: toDisplayName(macroResult.foodName),
    portion: "1 serving (estimated)",
    calories: macroResult.calories,
    protein_g: macroResult.protein_g,
    carbs_g: macroResult.carbs_g,
    fat_g: macroResult.fat_g,
    fiber_g: macroResult.fiber_g,
    health_tip: healthTip,
    source: macroResult.source,
    meal_type: mealType,
  };
}
