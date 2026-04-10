import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const FOOD_SCAN_PROMPT = `You are an expert nutritionist AI. Analyze this food image carefully.

Return ONLY a valid JSON object with NO extra text, NO markdown, NO code fences. Just raw JSON:

{
  "food_name": "Name of the food/dish",
  "portion": "Estimated portion size (e.g. '1 bowl, ~300g')",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "fiber_g": 0,
  "health_tip": "One practical health tip about this food"
}

Rules:
- calories, protein_g, carbs_g, fat_g, fiber_g must be NUMBERS (not strings)
- Be accurate with Indian foods, fast food, and home-cooked meals
- If multiple items are visible, combine their totals
- Estimate portions conservatively`;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const userId = formData.get('user_id') as string | null;
    const mealType = formData.get('meal_type') as string || 'Snacks';

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400 }
      );
    }

    // Convert File → ArrayBuffer → Buffer → base64
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    // Format for Gemini
    const imageParts = [{
      inlineData: {
        data: base64Data,
        mimeType: image.type,
      }
    }];

    // Call Gemini 1.5 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    const result = await model.generateContent([
      { text: FOOD_SCAN_PROMPT },
      ...imageParts,
    ]);

    const responseText = result.response.text();

    // Parse JSON from Gemini response (strip markdown fences if present)
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    }

    let foodData;
    try {
      foodData = JSON.parse(cleaned);
    } catch {
      console.error('Gemini returned non-JSON:', responseText);
      return NextResponse.json(
        { success: false, error: 'AI returned invalid data. Please try again.', raw: responseText },
        { status: 422 }
      );
    }

    // Validate required fields
    const entry = {
      food_name: foodData.food_name || 'Unknown Food',
      portion: foodData.portion || 'Unknown',
      calories: Number(foodData.calories) || 0,
      protein_g: Number(foodData.protein_g) || 0,
      carbs_g: Number(foodData.carbs_g) || 0,
      fat_g: Number(foodData.fat_g) || 0,
      fiber_g: Number(foodData.fiber_g) || 0,
      health_tip: foodData.health_tip || '',
      meal_type: mealType,
      user_id: userId,
    };

    // Save to Supabase if user_id provided
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
        console.error('Supabase insert error:', dbError);
        // Still return the AI result even if DB save fails
        return NextResponse.json({
          success: true,
          data: entry,
          db_saved: false,
          db_error: dbError.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: entry,
      db_saved: !!userId,
    });

  } catch (error: any) {
    console.error('Food scan error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
