import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { enrichExerciseList } from '../../../lib/exercise-catalog';
import { analyzeFoodImage } from '../../../lib/food-analysis';
import { checkAndIncrementRateLimit } from '../../../lib/rate-limit';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const model = genAI.getGenerativeModel({ model: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash' });

const muscleMap: Record<string, string[]> = {
  chest: ['pectorals'],
  back: ['lats', 'upper back', 'traps'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  arms: ['biceps', 'triceps', 'forearms'],
  shoulders: ['delts'],
  abs: ['abs'],
  core: ['abs'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  glutes: ['glutes'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  calves: ['calves'],
};

const exerciseIntentWords = [
  'exercise',
  'exercises',
  'workout',
  'workouts',
  'movement',
  'movements',
  'lift',
  'training',
  'best',
];

function normalizeInstructions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (value && typeof value === 'object' && typeof (value as { en?: unknown }).en === 'string') {
    return (value as { en: string }).en
      .split(/\.\s+/)
      .map((step) => step.trim())
      .filter(Boolean)
      .map((step) => (step.endsWith('.') ? step : `${step}.`));
  }

  if (typeof value === 'string') {
    return value
      .split(/\.\s+/)
      .map((step) => step.trim())
      .filter(Boolean)
      .map((step) => (step.endsWith('.') ? step : `${step}.`));
  }

  return [];
}

function sanitizeExercise(exercise: any) {
  return {
    id: exercise.id,
    name: exercise.name,
    muscle_group: exercise.muscle_group,
    equipment: exercise.equipment || null,
    gif_url: exercise.gif_url || null,
    body_part: exercise.body_part || null,
    secondary_muscles: Array.isArray(exercise.secondary_muscles) ? exercise.secondary_muscles : [],
    instructions: normalizeInstructions(exercise.instructions),
  };
}

function detectMuscles(message: string) {
  const msgLower = message.toLowerCase();
  const detected = new Set<string>();

  for (const [userWord, dbWords] of Object.entries(muscleMap)) {
    if (msgLower.includes(userWord)) {
      dbWords.forEach((word) => detected.add(word));
    }
  }

  return [...detected];
}

function isExerciseRequest(message: string) {
  const msgLower = message.toLowerCase();
  return exerciseIntentWords.some((word) => msgLower.includes(word)) || detectMuscles(message).length > 0;
}

async function fetchExerciseMatches(message: string) {
  if (!message || !isExerciseRequest(message)) return [];

  const muscles = detectMuscles(message);
  const lowered = message.toLowerCase();
  const tokens = lowered
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !['best', 'exercise', 'exercises', 'for', 'with', 'and', 'the', 'workout'].includes(token));
  let query = supabase
    .from('exercises')
    .select('id, name, muscle_group, equipment, gif_url')
    .limit(6);

  if (muscles.length > 0) {
    const filters = muscles.map((muscle) => `muscle_group.ilike.%${muscle}%`).join(',');
    query = query.or(filters);
  } else if (tokens.length > 0) {
    const filters = tokens.slice(0, 3).map((token) => `name.ilike.%${token}%`).join(',');
    query = query.or(filters);
  }

  const { data, error } = await query.limit(6);
  if (error) {
    console.error('[Chat API] Exercise lookup error:', error.message);
    return [];
  }

  const enriched = await enrichExerciseList(data || []);
  return enriched.map(sanitizeExercise);
}

export async function POST(req: Request) {
  try {
    const { message, fileData, mimeType, mode, user_id } = await req.json();

    if (user_id && !checkAndIncrementRateLimit(user_id)) {
      return NextResponse.json(
        { success: false, error: "Daily limit reached (10/10). Please try again tomorrow to save credits." },
        { status: 429 }
      );
    }

    if (mode === 'food' && fileData && mimeType) {
      const data = await analyzeFoodImage({
        base64Data: fileData.split(",")[1],
        mimeType,
        mealType: "Snacks",
      });

      return NextResponse.json({
        success: true,
        data: JSON.stringify({
          food_name: data.food_name,
          calories: data.calories,
          macros: {
            protein: `${data.protein_g}g`,
            carbs: `${data.carbs_g}g`,
            fats: `${data.fat_g}g`,
          },
          health_tip: data.health_tip,
          source: data.source,
        }),
        exercises: [],
      });
    }

    const exerciseMatches = mode === 'chat' ? await fetchExerciseMatches(message || '') : [];

    let systemInstruction = "";
    if (mode === 'food') {
      systemInstruction = `You are a Nutritionist AI. The user has uploaded a food photo and may provide additional details about it. Analyze the food image carefully. Output a JSON object: { "food_name": "...", "calories": 000, "macros": { "protein": "0g", "carbs": "0g", "fats": "0g" }, "health_tip": "..." }. If the user provides extra context (e.g. portion size, ingredients), use it to refine your analysis.`;
    } else if (mode === 'gym') {
      systemInstruction = `You are a Gym Coach AI. The user has uploaded a workout/exercise video and may provide additional details about their exercise. Identify the exercise, rate their form (1-10), and give specific corrections. Output Markdown. End with: SEARCH_QUERY: [Exercise Name] correct form. If the user provides extra context (e.g. how long they've been training, any injuries), factor it into your advice.`;
    } else {
      systemInstruction = `You are CalAI, an expert fitness and nutrition assistant. Help users with diet questions, workout advice, and general wellness tips. Be concise and practical.`;
    }

    if (exerciseMatches.length > 0) {
      const dbResults = exerciseMatches.map((ex, idx) => (
        `${idx + 1}. ${ex.name} | muscle: ${ex.muscle_group} | equipment: ${ex.equipment || 'Bodyweight'} | app_url: /exercise/${ex.id} | gif_url: ${ex.gif_url}`
      )).join('\n');

      systemInstruction += `\n\nThe user is asking for exercise advice. Recommend ONLY exercises from this official database list. Keep the answer short and practical, highlight the best 3-5 options, and do not invent exercise names. The UI will render linked exercise cards from the same database.\n${dbResults}`;
    }

    const parts: any[] = [{ text: systemInstruction }];
    if (message) parts.push({ text: `User: ${message}` });

    if (fileData) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: fileData.split(",")[1]
        }
      });
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }]
    });

    const responseText = result.response.text();
    
    return NextResponse.json({ success: true, data: responseText, exercises: exerciseMatches });

  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
