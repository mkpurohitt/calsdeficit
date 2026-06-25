import { NextResponse } from 'next/server';
import { genai, chatModelId } from '../../../lib/server/genai';
import { findExercises } from '../../../lib/server/exercise-db';
import { analyzeFoodImage } from '../../../lib/food-analysis';
import { requireUser } from '../../../lib/server/auth';
import { consumeUsage } from '../../../lib/server/usage';
import { tierConfig } from '../../../lib/entitlements';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
  'exercise', 'exercises', 'workout', 'workouts', 'movement', 'movements', 'lift', 'training', 'best',
];

function detectMuscles(message: string) {
  const msgLower = message.toLowerCase();
  const detected = new Set<string>();
  for (const [userWord, dbWords] of Object.entries(muscleMap)) {
    if (msgLower.includes(userWord)) dbWords.forEach((word) => detected.add(word));
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
  const tokens = message
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !['best', 'exercise', 'exercises', 'for', 'with', 'and', 'the', 'workout'].includes(token));

  try {
    if (muscles.length > 0) {
      return await findExercises({ muscles, limit: 6 });
    }
    if (tokens.length > 0) {
      return await findExercises({ query: tokens[0], limit: 6 });
    }
  } catch (error) {
    console.error('[Chat API] Exercise lookup error:', error);
  }
  return [];
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;

    const { message, fileData, mimeType, mode } = await req.json();

    const usage = await consumeUsage(user.uid);
    if (!usage.allowed) {
      return NextResponse.json(
        { success: false, error: `Daily limit reached (${usage.used}/${usage.limit}). Upgrade or try again tomorrow.` },
        { status: 429 }
      );
    }
    const adsEnabled = tierConfig(usage.tier).ads;

    // Food photo → structured scan pipeline (verified card + ad keywords)
    if (mode === 'food' && fileData && mimeType) {
      const data = await analyzeFoodImage({
        base64Data: fileData.split(',')[1],
        mimeType,
        mealType: 'Snacks',
        userContext: message || undefined,
      });
      return NextResponse.json({
        success: true,
        kind: 'food-scan',
        scan: data,
        adKeywords: adsEnabled ? data.suggested_ad_keywords : [],
        adsEnabled,
        exercises: [],
        usage: { used: usage.used, limit: usage.limit, tier: usage.tier },
      });
    }

    const exerciseMatches = mode === 'chat' ? await fetchExerciseMatches(message || '') : [];

    let systemInstruction = '';
    if (mode === 'food') {
      systemInstruction = `You are Calolean's Nutritionist AI. Answer the user's food question directly and decisively in Markdown — never reply with vague non-answers like "it varies" or "it depends".

If they ask how many calories or macros a food/drink has, LEAD with a single concrete number for one standard serving, then the macro split. Example: "**Masala chai (1 cup, 240 ml, with milk + sugar) ≈ 120 kcal** — 3g protein, 16g carbs, 4g fat." Always state the serving size you assumed. Give your best specific estimate rather than a wide range; you may add at most ONE short line about a common variant. Be concise — no filler.`;
    } else if (mode === 'gym') {
      systemInstruction = `You are Calolean's Gym Coach AI. The user has uploaded a workout/exercise video and may provide additional details. Identify the exercise, rate their form (1-10), and give specific corrections. Output Markdown. End with: SEARCH_QUERY: [Exercise Name] correct form.`;
    } else {
      systemInstruction = `You are Calolean, an expert fitness and nutrition coach. Answer directly and decisively — never give vague non-answers like "it varies widely" or "it depends".

When asked how many calories or macros a food/drink has, ALWAYS lead with a single concrete number for one standard serving, then the macro split, and state the serving you assumed. Example: "**Masala chai (1 cup, 240 ml, with milk + sugar) ≈ 120 kcal** — 3g protein, 16g carbs, 4g fat." Prefer one best estimate over a wide range; at most one short line on a common variant. For other questions, give a clear, actionable answer. Keep it tight and practical in Markdown — no filler.`;
    }

    if (exerciseMatches.length > 0) {
      const dbResults = exerciseMatches
        .map((ex, idx) =>
          `${idx + 1}. ${ex.name} | muscle: ${ex.muscle_group} | equipment: ${ex.equipment || 'Bodyweight'} | app_url: /exercise/${ex.id} | gif_url: ${ex.gif_url}`)
        .join('\n');
      systemInstruction += `\n\nThe user is asking for exercise advice. Recommend ONLY exercises from this official database list. Keep the answer short and practical, highlight the best 3-5 options, and do not invent exercise names. The UI will render linked exercise cards from the same database.\n${dbResults}`;
    }

    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
      { text: systemInstruction },
    ];
    if (message) parts.push({ text: `User: ${message}` });
    if (fileData) {
      parts.push({ inlineData: { mimeType, data: fileData.split(',')[1] } });
    }

    const result = await genai().models.generateContent({
      model: chatModelId(),
      contents: [{ role: 'user', parts }],
    });

    return NextResponse.json({
      success: true,
      kind: 'text',
      data: result.text ?? '',
      exercises: exerciseMatches.map((ex) => ({
        id: ex.id,
        name: ex.name,
        muscle_group: ex.muscle_group,
        equipment: ex.equipment,
        gif_url: ex.gif_url,
      })),
      adKeywords: adsEnabled ? deriveChatAdKeywords(mode, exerciseMatches.map((e) => e.muscle_group)) : [],
      adsEnabled,
      usage: { used: usage.used, limit: usage.limit, tier: usage.tier },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed.';
    console.error('Gemini AI Error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Context isolation (blueprint §B): only database-derived category keywords go
// to the ad layer — never the user's raw chat text.
function deriveChatAdKeywords(mode: string, muscleGroups: string[]): string[] {
  if (mode === 'gym') return ['gym gear', 'fitness equipment', 'sports nutrition'];
  if (muscleGroups.length > 0) {
    return [...new Set(['home workout', 'gym gear', ...muscleGroups.slice(0, 2).map((m) => `${m} training`)])];
  }
  return ['healthy eating', 'fitness'];
}
