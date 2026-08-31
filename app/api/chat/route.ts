import { NextResponse } from 'next/server';
import { Type, type Schema } from '@google/genai';
import { genai, chatModelId, visionModelId } from '../../../lib/server/genai';
import { findExercises } from '../../../lib/server/exercise-db';
import { analyzeFoodImage, analyzeFoodText } from '../../../lib/food-analysis';
import { findFoodImage } from '../../../lib/server/food-image';
import { parseWorkout } from '../../../lib/server/workout-parse';
import { requireUser } from '../../../lib/server/auth';
import { getUserContext, describeUserContext, healthSafetyRider } from '../../../lib/server/user-profile';
import { consumeUsage, usageLimitMessage, type UsageKind } from '../../../lib/server/usage';
import { tierConfig } from '../../../lib/entitlements';
import { reportError } from '../../../lib/server/api-errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

const muscleMap: Record<string, string[]> = {
  chest: ['pectorals'], back: ['lats', 'upper back', 'traps'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'], arms: ['biceps', 'triceps', 'forearms'],
  shoulders: ['delts'], abs: ['abs'], core: ['abs'], biceps: ['biceps'], triceps: ['triceps'],
  glutes: ['glutes'], quads: ['quads'], hamstrings: ['hamstrings'], calves: ['calves'],
};

function detectMuscles(message: string) {
  const msgLower = message.toLowerCase();
  const detected = new Set<string>();
  for (const [userWord, dbWords] of Object.entries(muscleMap)) {
    if (msgLower.includes(userWord)) dbWords.forEach((word) => detected.add(word));
  }
  return [...detected];
}

async function fetchExerciseMatches(message: string) {
  const muscles = detectMuscles(message);
  const tokens = message.toLowerCase().split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !['best', 'exercise', 'exercises', 'for', 'with', 'and', 'the', 'workout'].includes(t));
  try {
    if (muscles.length > 0) return await findExercises({ muscles, limit: 6 });
    if (tokens.length > 0) return await findExercises({ query: tokens[0], limit: 6 });
  } catch (error) {
    console.error('[Chat API] Exercise lookup error:', error);
  }
  return [];
}

/** Flattened prior turns for prompts that take plain text context. */
function historyText(turns: { role: 'user' | 'ai'; text: string }[]): string {
  return turns.map((t) => `${t.role === 'ai' ? 'Calolean' : 'User'}: ${t.text}`).join('\n');
}

/** AI intent router: decides how a text message should be answered. */
type Category = 'food' | 'workout_log' | 'exercise_search' | 'fitness_advice' | 'off_topic';

const classifySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    category: {
      type: Type.STRING,
      enum: ['food', 'workout_log', 'exercise_search', 'fitness_advice', 'off_topic'],
      description:
        "food = the user names/describes a food or drink or asks its calories/macros/nutrition (incl. 'i ate X', and follow-ups like 'what about 2 of them?'); workout_log = the user reports HAVING DONE an exercise to log it (e.g. 'i did bench 4x8'); exercise_search = asks which exercises to do or how to do a movement; fitness_advice = other diet/training/nutrition/wellness/health question, INCLUDING follow-up questions about a previous answer; off_topic = anything NOT about food, nutrition, exercise, fitness, or health.",
    },
    food_query: {
      type: Type.STRING,
      description:
        "If category=food, a self-contained food description with the quantity the user means, resolving pronouns from the conversation (e.g. prior 'roti' + 'what about 3?' -> '3 rotis'). Else empty.",
    },
    is_follow_up: {
      type: Type.BOOLEAN,
      description: 'True when this message only makes sense in the context of the previous turns.',
    },
  },
  required: ['category'],
};

async function classify(
  message: string,
  priorTurns: { role: 'user' | 'ai'; text: string }[]
): Promise<{ category: Category; food_query: string; is_follow_up: boolean }> {
  try {
    const context = priorTurns.length
      ? `Conversation so far:\n${historyText(priorTurns.slice(-6))}\n\n`
      : '';
    const res = await genai().models.generateContent({
      model: visionModelId(),
      contents: [{
        role: 'user',
        parts: [{ text: `${context}Classify this new message from a diet & fitness app user. Message: "${message}"` }],
      }],
      config: { responseMimeType: 'application/json', responseSchema: classifySchema, temperature: 0 },
    });
    const parsed = JSON.parse(res.text || '{}');
    const category = (['food', 'workout_log', 'exercise_search', 'fitness_advice', 'off_topic'].includes(parsed.category)
      ? parsed.category : 'fitness_advice') as Category;
    return {
      category,
      food_query: typeof parsed.food_query === 'string' ? parsed.food_query : '',
      is_follow_up: Boolean(parsed.is_follow_up),
    };
  } catch (error) {
    console.error('[Chat API] classify failed, defaulting to advice:', error);
    return { category: 'fitness_advice', food_query: '', is_follow_up: false };
  }
}

const OFF_TOPIC_REPLY =
  "I'm **Calolean**, your diet & fitness coach 💪 — I can help with food, nutrition, calories, workouts, and exercise form. I can't help with that one, but ask me anything about your training or diet!";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;

    const { message, fileData, mimeType, history } = await req.json();
    const priorTurns: { role: 'user' | 'ai'; text: string }[] = Array.isArray(history)
      ? history
          .filter((h) => h && typeof h.text === 'string' && h.text.trim() && (h.role === 'user' || h.role === 'ai'))
          .slice(-10)
          .map((h) => ({ role: h.role, text: String(h.text).slice(0, 1200) }))
      : [];
    const isImage = Boolean(fileData && typeof mimeType === 'string' && mimeType.startsWith('image/'));
    const isVideo = Boolean(fileData && typeof mimeType === 'string' && mimeType.startsWith('video/'));

    // ── Text-only: classify first (unmetered) so off-topic refusals are free ──
    if (!fileData && message) {
      const { category, food_query } = await classify(message, priorTurns);

      if (category === 'off_topic') {
        return NextResponse.json({
          success: true, kind: 'text', data: OFF_TOPIC_REPLY, exercises: [],
          adKeywords: [], adsEnabled: false, usage: null,
        });
      }

      const usage = await consumeUsage(user.uid, 'text');
      if (!usage.allowed) return NextResponse.json({ success: false, error: usageLimitMessage(usage) }, { status: 429 });
      const adsEnabled = tierConfig(usage.tier).ads;
      const usagePayload = { used_pct: usage.used_pct, resets_at: usage.resets_at, tier: usage.tier };

      if (category === 'food') {
        try {
          // The quantity lives in the raw message ("32 g of oats"), so pass it
          // through as well — the portion resolver reads it directly.
          const data = await analyzeFoodText({
            description: food_query || message,
            userText: message,
            mealType: 'Snacks',
            history: priorTurns.length ? historyText(priorTurns.slice(-6)) : undefined,
          });
          // No photo was uploaded, so give the card a hero image of the dish.
          const image = await findFoodImage(data.food_name);
          return NextResponse.json({
            success: true,
            kind: 'food-scan',
            scan: { ...data, image_url: image?.url ?? null, image_attribution: image?.attribution ?? null },
            adKeywords: adsEnabled ? data.suggested_ad_keywords : [], adsEnabled, exercises: [], usage: usagePayload,
          });
        } catch (error) {
          console.error('[Chat API] food text scan failed, falling back to chat:', error);
        }
      }

      if (category === 'workout_log') {
        try {
          const workout = await parseWorkout({ message });
          return NextResponse.json({
            success: true, kind: 'workout-log', workout,
            data: `Nice work — **${workout.exercise_name}**, ${workout.sets}×${workout.reps}${workout.weight_kg ? ` at ${workout.weight_kg} kg` : ''}. Log it to your Exercise diary below.`,
            adKeywords: adsEnabled ? ['gym gear', 'fitness equipment', 'sports nutrition'] : [], adsEnabled, exercises: [], usage: usagePayload,
          });
        } catch (error) {
          console.error('[Chat API] workout parse failed, falling back to chat:', error);
        }
      }

      const exerciseMatches = category === 'exercise_search' ? await fetchExerciseMatches(message) : [];
      const text = await answerChat(message, exerciseMatches, priorTurns, user.uid);
      return NextResponse.json({
        success: true, kind: 'text', data: text,
        exercises: exerciseMatches.map((ex) => ({ id: ex.id, name: ex.name, muscle_group: ex.muscle_group, equipment: ex.equipment, gif_url: ex.gif_url, difficulty: ex.difficulty, met_value: ex.met_value })),
        adKeywords: adsEnabled ? deriveChatAdKeywords(false, exerciseMatches.map((e) => e.muscle_group)) : [], adsEnabled, usage: usagePayload,
      });
    }

    // ── With a file: image → food scan, video → gym coach ──
    const usageKind: UsageKind = isVideo ? 'video' : 'image';
    const usage = await consumeUsage(user.uid, usageKind);
    if (!usage.allowed) return NextResponse.json({ success: false, error: usageLimitMessage(usage) }, { status: 429 });
    const adsEnabled = tierConfig(usage.tier).ads;
    const usagePayload = { used_pct: usage.used_pct, resets_at: usage.resets_at, tier: usage.tier };

    if (isImage) {
      const data = await analyzeFoodImage({
        base64Data: String(fileData).split(',').pop() as string,
        mimeType,
        mealType: 'Snacks',
        userContext: message || undefined,
        history: priorTurns.length ? historyText(priorTurns.slice(-4)) : undefined,
      });
      return NextResponse.json({
        success: true, kind: 'food-scan', scan: data,
        adKeywords: adsEnabled ? data.suggested_ad_keywords : [], adsEnabled, exercises: [], usage: usagePayload,
      });
    }

    // video → gym coach
    const gymPrompt = `You are Calolean's Gym Coach AI. The user uploaded a workout/exercise video. Identify the exercise, rate their form (1-10), and give specific corrections. Output Markdown. End with: SEARCH_QUERY: [Exercise Name] correct form.`;
    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
      { text: gymPrompt },
      ...(message ? [{ text: `User: ${message}` }] : []),
      { inlineData: { mimeType, data: String(fileData).split(',').pop() as string } },
    ];
    const result = await genai().models.generateContent({ model: chatModelId(), contents: [{ role: 'user', parts }] });
    return NextResponse.json({
      success: true, kind: 'text', data: result.text ?? '', exercises: [],
      adKeywords: adsEnabled ? deriveChatAdKeywords(true, []) : [], adsEnabled, usage: usagePayload,
    });
  } catch (error) {
    // Never echo a provider error to the client — it leaks project ids and
    // reads as gibberish. reportError logs the real one server-side.
    const failure = reportError('Chat API', error);
    return NextResponse.json({ success: false, error: failure.message }, { status: failure.status });
  }
}

async function answerChat(
  message: string,
  exerciseMatches: Awaited<ReturnType<typeof fetchExerciseMatches>>,
  priorTurns: { role: 'user' | 'ai'; text: string }[] = [],
  uid?: string
) {
  const ctx = uid ? await getUserContext(uid) : null;

  let systemInstruction = `You are Calolean, an expert diet & fitness coach. ONLY answer questions about food, nutrition, calories, exercise, training, and health/wellness.

HOW TO ANSWER
- Be decisive and concrete. Never say "it varies widely" — commit to a number or a recommendation, then note the one variable that would change it.
- Treat the conversation as continuous: resolve "it", "that", "instead" against earlier turns, and don't re-ask what the user already told you.
- Lead with the answer, then the reasoning. Keep it tight, practical Markdown.
- When asked calories/macros of a food, ALWAYS lead with one concrete number for a stated serving plus the macro split (e.g. "**Masala chai (1 cup, 240 ml) ≈ 120 kcal** — 3g protein, 16g carbs, 4g fat"). If the user names a weight, do the arithmetic for THAT weight.
- End with one specific next step or a question that moves them forward — never a generic "let me know if you have questions".`;

  systemInstruction += describeUserContext(ctx);
  systemInstruction += healthSafetyRider(ctx);

  if (exerciseMatches.length > 0) {
    const dbResults = exerciseMatches
      .map((ex, i) =>
        `${i + 1}. ${ex.name} | muscle: ${ex.muscle_group} | equipment: ${ex.equipment || 'Bodyweight'}` +
        `${ex.difficulty ? ` | difficulty: ${ex.difficulty}` : ''}${ex.met_value ? ` | MET: ${ex.met_value}` : ''} | app_url: /exercise/${ex.id}`
      )
      .join('\n');
    systemInstruction += `\n\nRecommend ONLY exercises from this official database list; highlight the best 3-5, don't invent names. Match the difficulty to the user's experience where known. The UI renders linked cards.\n${dbResults}`;
  }

  const contents = [
    { role: 'user' as const, parts: [{ text: systemInstruction }] },
    ...priorTurns.map((t) => ({ role: t.role === 'ai' ? ('model' as const) : ('user' as const), parts: [{ text: t.text }] })),
    { role: 'user' as const, parts: [{ text: message }] },
  ];
  const result = await genai().models.generateContent({ model: chatModelId(), contents });
  return result.text ?? '';
}

// Context isolation: only database-derived category keywords reach the ad layer.
function deriveChatAdKeywords(isVideo: boolean, muscleGroups: string[]): string[] {
  if (isVideo) return ['gym gear', 'fitness equipment', 'sports nutrition'];
  if (muscleGroups.length > 0) return [...new Set(['home workout', 'gym gear', ...muscleGroups.slice(0, 2).map((m) => `${m} training`)])];
  return ['healthy eating', 'fitness'];
}
