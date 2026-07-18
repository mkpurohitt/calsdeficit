import { NextResponse } from 'next/server';
import { genai, chatModelId } from '../../../lib/server/genai';
import { findExercises } from '../../../lib/server/exercise-db';
import { analyzeFoodImage, analyzeFoodText } from '../../../lib/food-analysis';
import { parseWorkout } from '../../../lib/server/workout-parse';
import { requireUser } from '../../../lib/server/auth';
import { consumeUsage, usageLimitMessage, type UsageKind } from '../../../lib/server/usage';
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

/** "I ate…", "calories in…", "I had X for lunch" → structured food card. */
function isFoodLogIntent(message: string) {
  return /(\bi (just )?(ate|had|drank)\b|\bfor (breakfast|lunch|dinner|snacks?)\b|\bcalories? in\b|\bhow (many|much) calories\b|\bkcal in\b|\bnutrition (of|in)\b|\bmacros (of|in|for)\b|\blog (my )?(food|meal)\b)/i.test(message);
}

/** "I did bench 4x8", "log squats 3 sets of 10" → structured workout log. */
function isWorkoutLogIntent(message: string) {
  const didSomething = /\b(i (just )?(did|done|completed|finished|trained|performed)|log (my )?(workout|exercise|set|lift))\b/i.test(message);
  const setsReps = /(\d+\s*[x×]\s*\d+|\b\d+\s*sets?\b|\b\d+\s*reps?\b)/i.test(message);
  return (didSomething && !/\?\s*$/.test(message)) || (setsReps && didSomething) || (setsReps && /\b(bench|squat|deadlift|press|curl|row|pull[- ]?up|push[- ]?up|lunge|raise|extension|pushdown|fly|dip|crunch|plank)\b/i.test(message));
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

    const { message, fileData, mimeType } = await req.json();

    const isImage = Boolean(fileData && typeof mimeType === 'string' && mimeType.startsWith('image/'));
    const isVideo = Boolean(fileData && typeof mimeType === 'string' && mimeType.startsWith('video/'));
    const usageKind: UsageKind = isVideo ? 'video' : isImage ? 'image' : 'text';

    const usage = await consumeUsage(user.uid, usageKind);
    if (!usage.allowed) {
      return NextResponse.json({ success: false, error: usageLimitMessage(usage) }, { status: 429 });
    }
    const adsEnabled = tierConfig(usage.tier).ads;
    const usagePayload = { used_pct: usage.used_pct, resets_at: usage.resets_at, tier: usage.tier };

    // ── Food photo → structured scan card (verified against our database) ──
    if (isImage) {
      const data = await analyzeFoodImage({
        base64Data: String(fileData).split(',').pop() as string,
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
        usage: usagePayload,
      });
    }

    // ── Text-only intents: structured food card / structured workout log ──
    if (!fileData && message) {
      if (isWorkoutLogIntent(message)) {
        try {
          const workout = await parseWorkout({ message });
          return NextResponse.json({
            success: true,
            kind: 'workout-log',
            workout,
            data: `Nice work — **${workout.exercise_name}**, ${workout.sets}×${workout.reps}${workout.weight_kg ? ` at ${workout.weight_kg} kg` : ''}. Log it to your Exercise diary below.`,
            adKeywords: adsEnabled ? ['gym gear', 'fitness equipment', 'sports nutrition'] : [],
            adsEnabled,
            exercises: [],
            usage: usagePayload,
          });
        } catch (error) {
          console.error('[Chat API] workout parse failed, falling through to chat:', error);
        }
      }
      if (isFoodLogIntent(message)) {
        try {
          const data = await analyzeFoodText({ description: message, mealType: 'Snacks' });
          return NextResponse.json({
            success: true,
            kind: 'food-scan',
            scan: data,
            adKeywords: adsEnabled ? data.suggested_ad_keywords : [],
            adsEnabled,
            exercises: [],
            usage: usagePayload,
          });
        } catch (error) {
          console.error('[Chat API] text food scan failed, falling through to chat:', error);
        }
      }
    }

    const exerciseMatches = !fileData ? await fetchExerciseMatches(message || '') : [];

    let systemInstruction = '';
    if (isVideo) {
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
      parts.push({ inlineData: { mimeType, data: String(fileData).split(',').pop() as string } });
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
      adKeywords: adsEnabled ? deriveChatAdKeywords(isVideo, exerciseMatches.map((e) => e.muscle_group)) : [],
      adsEnabled,
      usage: usagePayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed.';
    console.error('Gemini AI Error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Context isolation (blueprint §B): only database-derived category keywords go
// to the ad layer — never the user's raw chat text.
function deriveChatAdKeywords(isVideo: boolean, muscleGroups: string[]): string[] {
  if (isVideo) return ['gym gear', 'fitness equipment', 'sports nutrition'];
  if (muscleGroups.length > 0) {
    return [...new Set(['home workout', 'gym gear', ...muscleGroups.slice(0, 2).map((m) => `${m} training`)])];
  }
  return ['healthy eating', 'fitness'];
}
