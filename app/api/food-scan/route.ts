import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// ── Clients ──
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Models ──
// Gemini 2.5 Flash — best vision accuracy for food identification
const visionModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-preview' });
// Gemini 2.5 Flash-Lite — ultra-low cost for text-only health tips
const liteModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// ── Types ──
interface MacroResult {
  foodName: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: string;
}

// ── Prompts ──
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
- searchName must be lowercase, short, and generic (no brand names)
- fallbackMacros should estimate values for the visible portion in the image
- Be accurate with Indian foods, fast food, and home-cooked meals
- If multiple items visible, pick the primary dish for searchName but combine totals for fallbackMacros
- calories, protein_g, carbs_g, fat_g, fiber_g must be NUMBERS`;

const HEALTH_TIP_PROMPT = (foodName: string, macros: MacroResult) =>
  `Food: ${foodName} — ${macros.calories} kcal, Protein: ${macros.protein_g}g, Carbs: ${macros.carbs_g}g, Fat: ${macros.fat_g}g, Fiber: ${macros.fiber_g}g.
Give ONE practical health tip about this food in 1-2 sentences. Be specific and actionable. No preamble.`;

// ────────────────────────────────────────
// TIER 2: USDA FoodData Central
// ────────────────────────────────────────
async function fetchUSDA(query: string): Promise<MacroResult | null> {
  try {
    if (!process.env.USDA_API_KEY) {
      console.log('[Waterfall] USDA: No API key configured, skipping');
      return null;
    }

    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=1&api_key=${process.env.USDA_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      console.log(`[Waterfall] USDA: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const food = data?.foods?.[0];

    if (!food || !food.foodNutrients) {
      console.log('[Waterfall] USDA: No results found');
      return null;
    }

    // Nutrient number mapping: 208=Energy(kcal), 203=Protein, 205=Carbs, 204=Fat, 291=Fiber
    const getNutrient = (num: number): number => {
      const nutrient = food.foodNutrients?.find(
        (n: any) => String(n.nutrientNumber) === String(num)
      );
      return nutrient?.value ?? 0;
    };

    const calories = getNutrient(208);
    const protein = getNutrient(203);

    // Basic validation: skip if no meaningful data
    if (calories === 0 && protein === 0) {
      console.log('[Waterfall] USDA: Data found but no meaningful nutrients');
      return null;
    }

    console.log(`[Waterfall] USDA: ✓ Found "${food.description}"`);
    return {
      foodName: food.description || query,
      calories: Math.round(calories),
      protein_g: Math.round(protein),
      carbs_g: Math.round(getNutrient(205)),
      fat_g: Math.round(getNutrient(204)),
      fiber_g: Math.round(getNutrient(291)),
      source: 'USDA',
    };
  } catch (err: any) {
    console.log(`[Waterfall] USDA: Error — ${err.message}`);
    return null;
  }
}

// ────────────────────────────────────────
// TIER 3: OpenFoodFacts
// ────────────────────────────────────────
async function fetchOpenFoodFacts(query: string): Promise<MacroResult | null> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      console.log(`[Waterfall] OpenFoodFacts: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const product = data?.products?.[0];

    if (!product?.nutriments) {
      console.log('[Waterfall] OpenFoodFacts: No results found');
      return null;
    }

    const n = product.nutriments;
    const calories = Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0);
    const protein = Math.round(n.proteins_100g || n.proteins || 0);

    // Basic validation
    if (calories === 0 && protein === 0) {
      console.log('[Waterfall] OpenFoodFacts: Data found but no meaningful nutrients');
      return null;
    }

    console.log(`[Waterfall] OpenFoodFacts: ✓ Found "${product.product_name || query}"`);
    return {
      foodName: product.product_name || query,
      calories,
      protein_g: protein,
      carbs_g: Math.round(n.carbohydrates_100g || n.carbohydrates || 0),
      fat_g: Math.round(n.fat_100g || n.fat || 0),
      fiber_g: Math.round(n.fiber_100g || n.fiber || 0),
      source: 'OpenFoodFacts',
    };
  } catch (err: any) {
    console.log(`[Waterfall] OpenFoodFacts: Error — ${err.message}`);
    return null;
  }
}

// ────────────────────────────────────────
// HEALTH TIP via Gemini 2.5 Flash-Lite
// ────────────────────────────────────────
async function generateHealthTip(foodName: string, macros: MacroResult): Promise<string> {
  try {
    const result = await liteModel.generateContent(HEALTH_TIP_PROMPT(foodName, macros));
    const tip = result.response.text().trim();
    return tip || '';
  } catch (err: any) {
    console.log(`[Waterfall] Health tip generation failed: ${err.message}`);
    return '';
  }
}

// ────────────────────────────────────────
// MAIN ROUTE HANDLER
// ────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const userId = formData.get('user_id') as string | null;
    const mealType = (formData.get('meal_type') as string) || 'Snacks';

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400 }
      );
    }

    // ── Convert image for Gemini ──
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    const imageParts = [{
      inlineData: {
        data: base64Data,
        mimeType: image.type,
      }
    }];

    // ══════════════════════════════════════
    // STEP 1: GEMINI VISION (identify food)
    // ══════════════════════════════════════
    console.log('[Waterfall] Step 1: Gemini Vision — identifying food...');

    const visionResult = await visionModel.generateContent([
      { text: VISION_PROMPT },
      ...imageParts,
    ]);

    const responseText = visionResult.response.text();

    // Parse JSON (strip markdown fences if present)
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    }

    let geminiResult: { searchName: string; fallbackMacros: any };
    try {
      geminiResult = JSON.parse(cleaned);
    } catch {
      console.error('[Waterfall] Gemini returned non-JSON:', responseText);
      return NextResponse.json(
        { success: false, error: 'AI could not identify the food. Please try a clearer image.' },
        { status: 422 }
      );
    }

    const searchKey = geminiResult.searchName?.toLowerCase().trim();
    if (!searchKey) {
      return NextResponse.json(
        { success: false, error: 'AI could not identify a food name. Please try again.' },
        { status: 422 }
      );
    }

    console.log(`[Waterfall] Identified food: "${searchKey}"`);

    // ══════════════════════════════════════
    // STEP 2: SUPABASE CACHE CHECK
    // ══════════════════════════════════════
    console.log('[Waterfall] Step 2: Checking cache...');

    const { data: cached } = await supabase
      .from('nutrition_cache')
      .select('nutrition_data, source')
      .eq('search_key', searchKey)
      .single();

    let macroResult: MacroResult;

    if (cached && cached.nutrition_data) {
      console.log(`[Waterfall] ✓ Cache HIT — source: ${cached.source}`);
      macroResult = {
        foodName: cached.nutrition_data.foodName || searchKey,
        calories: cached.nutrition_data.calories || 0,
        protein_g: cached.nutrition_data.protein_g || 0,
        carbs_g: cached.nutrition_data.carbs_g || 0,
        fat_g: cached.nutrition_data.fat_g || 0,
        fiber_g: cached.nutrition_data.fiber_g || 0,
        source: cached.source,
      };
    } else {
      console.log('[Waterfall] Cache MISS — querying external APIs...');

      // ══════════════════════════════════════
      // STEP 3: USDA FoodData Central
      // ══════════════════════════════════════
      console.log('[Waterfall] Step 3: Trying USDA...');
      let result = await fetchUSDA(searchKey);

      // ══════════════════════════════════════
      // STEP 4: OpenFoodFacts
      // ══════════════════════════════════════
      if (!result) {
        console.log('[Waterfall] Step 4: Trying OpenFoodFacts...');
        result = await fetchOpenFoodFacts(searchKey);
      }

      // ══════════════════════════════════════
      // STEP 5: AI FALLBACK (Gemini estimation)
      // ══════════════════════════════════════
      if (!result) {
        console.log('[Waterfall] Step 5: Using Gemini fallback estimation');
        const fb = geminiResult.fallbackMacros || {};
        result = {
          foodName: searchKey,
          calories: Math.round(Number(fb.calories) || 0),
          protein_g: Math.round(Number(fb.protein_g) || 0),
          carbs_g: Math.round(Number(fb.carbs_g) || 0),
          fat_g: Math.round(Number(fb.fat_g) || 0),
          fiber_g: Math.round(Number(fb.fiber_g) || 0),
          source: 'Gemini Estimation',
        };
      }

      macroResult = result;

      // ══════════════════════════════════════
      // STEP 7a: CACHE the result
      // ══════════════════════════════════════
      console.log(`[Waterfall] Step 7a: Caching result (source: ${macroResult.source})...`);
      const { error: cacheError } = await supabase
        .from('nutrition_cache')
        .upsert({
          search_key: searchKey,
          nutrition_data: {
            foodName: macroResult.foodName,
            calories: macroResult.calories,
            protein_g: macroResult.protein_g,
            carbs_g: macroResult.carbs_g,
            fat_g: macroResult.fat_g,
            fiber_g: macroResult.fiber_g,
          },
          source: macroResult.source,
        }, { onConflict: 'search_key' });

      if (cacheError) {
        console.error('[Waterfall] Cache insert error:', cacheError.message);
      } else {
        console.log('[Waterfall] ✓ Cached successfully');
      }
    }

    // ══════════════════════════════════════
    // STEP 7b: HEALTH TIP via Flash-Lite
    // ══════════════════════════════════════
    console.log('[Waterfall] Step 7b: Generating health tip (Flash-Lite)...');
    const healthTip = await generateHealthTip(macroResult.foodName, macroResult);

    // ── Format display name ──
    const displayName = macroResult.foodName
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // ── Build response entry ──
    const entry = {
      food_name: displayName,
      portion: '1 serving (estimated)',
      calories: macroResult.calories,
      protein_g: macroResult.protein_g,
      carbs_g: macroResult.carbs_g,
      fat_g: macroResult.fat_g,
      fiber_g: macroResult.fiber_g,
      health_tip: healthTip,
      source: macroResult.source,
      meal_type: mealType,
      user_id: userId,
    };

    // ── Save to food_logs if user is logged in ──
    if (userId) {
      const { error: dbError } = await supabase
        .from('food_logs')
        .insert({
          user_id: entry.user_id,
          food_name: entry.food_name,
          portion: entry.portion,
          calories: entry.calories,
          protein_g: entry.protein_g,
          carbs_g: entry.carbs_g,
          fat_g: entry.fat_g,
          fiber_g: entry.fiber_g,
          meal_type: entry.meal_type,
        });

      if (dbError) {
        console.error('[Waterfall] Food log insert error:', dbError.message);
        return NextResponse.json({
          success: true,
          data: entry,
          db_saved: false,
          db_error: dbError.message,
        });
      }
    }

    console.log(`[Waterfall] ✅ Complete — ${displayName} (${macroResult.source})`);

    return NextResponse.json({
      success: true,
      data: entry,
      db_saved: !!userId,
    });

  } catch (error: any) {
    console.error('[Waterfall] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
