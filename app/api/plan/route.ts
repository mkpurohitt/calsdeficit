import { NextResponse } from 'next/server';
import { genai, chatModelId } from '../../../lib/server/genai';
import { requireUser } from '../../../lib/server/auth';
import { templateWeeklyPlan, type GoalType } from '../../../lib/plan';
import { reportError } from '../../../lib/server/api-errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface MealTargets { breakfast: number; lunch: number; dinner: number; snacks: number }

/** Health context shared by both prompts so neither can contradict the other. */
function healthBlock(body: {
  health_conditions?: unknown;
  allergies?: unknown;
  dietary_preference?: unknown;
  health_notes?: unknown;
}): string {
  const conditions = Array.isArray(body.health_conditions) ? body.health_conditions.filter(Boolean).map(String) : [];
  const allergies = Array.isArray(body.allergies) ? body.allergies.filter(Boolean).map(String) : [];
  const diet = typeof body.dietary_preference === 'string' ? body.dietary_preference : '';
  const notes = typeof body.health_notes === 'string' ? body.health_notes.slice(0, 400) : '';

  const lines: string[] = [];
  if (diet) lines.push(`Diet: ${diet} — every food suggested MUST fit this.`);
  if (allergies.length) lines.push(`Allergies — NEVER suggest: ${allergies.join(', ')}.`);
  if (conditions.length) lines.push(`Health conditions: ${conditions.join(', ')}. Adapt choices accordingly.`);
  if (notes) lines.push(`User notes: ${notes}`);
  return lines.length ? `\nIMPORTANT CONSTRAINTS:\n${lines.map((l) => `- ${l}`).join('\n')}` : '';
}

/** Simple, safe day-of-eating used when the AI is unavailable. */
function templateDietPlan(targets: MealTargets | null, kcal: number, protein: number, diet: string): string {
  const t = targets || {
    breakfast: Math.round(kcal * 0.25),
    lunch: Math.round(kcal * 0.35),
    dinner: Math.round(kcal * 0.3),
    snacks: Math.round(kcal * 0.1),
  };
  const veg = /veg|jain/i.test(diet) && !/non/i.test(diet);
  const p1 = veg ? 'paneer bhurji or besan chilla' : 'eggs or chicken sausage';
  const p2 = veg ? 'rajma / chole with curd' : 'grilled chicken or fish';
  const p3 = veg ? 'dal + paneer' : 'dal + chicken or fish';
  return [
    `**Breakfast (~${t.breakfast} kcal)** · Oats or poha with ${p1} · fruit`,
    `**Lunch (~${t.lunch} kcal)** · 2 rotis + ${p2} + salad`,
    `**Snack (~${t.snacks} kcal)** · Greek yogurt or a handful of nuts`,
    `**Dinner (~${t.dinner} kcal)** · ${p3} + sabzi + small portion of rice`,
    ``,
    `Aim for **${protein}g protein** across the day and 2.5-3 L of water.`,
  ].join('\n');
}

/**
 * Generates the personalized weekly training plan and a matching day-of-eating
 * plan for onboarding/goal updates. Both fall back to solid templates so the
 * flow never blocks on the AI.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;

    const body = await req.json();
    const {
      gender, age, height_cm, weight_kg, goal, activity_level,
      daily_calories, protein_g, workout_days, meal_targets,
    } = body;
    const goalType = (['Lose Weight', 'Maintain Weight', 'Gain Muscle'].includes(goal) ? goal : 'Maintain Weight') as GoalType;
    const days = Math.min(7, Math.max(2, Number(workout_days) || 4));
    const constraints = healthBlock(body);
    const targets = (meal_targets ?? null) as MealTargets | null;
    const kcal = Number(daily_calories) || 2000;
    const protein = Number(protein_g) || 120;
    const dietPref = typeof body.dietary_preference === 'string' ? body.dietary_preference : '';

    const profile = `User: ${gender}, ${age}y, ${height_cm}cm, ${weight_kg}kg, goal: ${goalType}, activity: ${activity_level}, target ${kcal} kcal/day, ${protein}g protein.`;

    const workoutPrompt = `Create a detailed 7-day training plan for this user, who can do ${days} workout days per week (the rest are rest/active-recovery days). Output ONLY the plan as exactly 7 markdown lines, one per day, format: "**Mon — <focus>** · <Exercise> <sets>×<reps> · <Exercise> <sets>×<reps> · ..." (3-5 exercises with sets×reps on training days; short activity note on rest days). No intro, no outro.
${profile}
Use well-known gym exercises, a sensible split for ${days} days (full-body / upper-lower / push-pull-legs as appropriate), and adequate recovery.${constraints}
If a listed health condition or injury makes a movement unwise, pick a safer alternative instead — do not name the condition in the output.`;

    const dietPrompt = `Create a realistic one-day eating plan for this user. Output ONLY 4-5 markdown lines, one per meal, format: "**Breakfast (~450 kcal)** · <food> · <food>". No intro, no outro, no disclaimers.
${profile}
Per-meal calorie targets: breakfast ~${targets?.breakfast ?? Math.round(kcal * 0.25)}, lunch ~${targets?.lunch ?? Math.round(kcal * 0.35)}, dinner ~${targets?.dinner ?? Math.round(kcal * 0.3)}, snacks ~${targets?.snacks ?? Math.round(kcal * 0.1)} kcal.
Use everyday Indian and Western foods people can actually buy. Hit the protein target.${constraints}
End with one final line starting "Aim for" summarizing the daily protein and water target.`;

    // Both generations are independent — run them together to keep onboarding snappy.
    const [weekly, diet] = await Promise.all([
      generate(workoutPrompt, (t) => t.split('\n').filter((l) => l.includes('**')).length >= 5),
      generate(dietPrompt, (t) => t.split('\n').filter((l) => l.includes('**')).length >= 3),
    ]);

    return NextResponse.json({
      success: true,
      plan: weekly ?? templateWeeklyPlan(goalType, days),
      diet_plan: diet ?? templateDietPlan(targets, kcal, protein, dietPref),
      source: weekly ? 'ai' : 'template',
    });
  } catch (error) {
    // Never echo a provider error to the client — it leaks project ids and
    // reads as gibberish. reportError logs the real one server-side.
    const failure = reportError('Plan API', error);
    return NextResponse.json({ success: false, error: failure.message }, { status: failure.status });
  }
}

/** One generation with a sanity check; null tells the caller to use its template. */
async function generate(prompt: string, isValid: (text: string) => boolean): Promise<string | null> {
  try {
    const result = await genai().models.generateContent({
      model: chatModelId(),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const text = (result.text ?? '').trim();
    return text && isValid(text) ? text : null;
  } catch (error) {
    console.error('[Plan API] AI generation failed, using template:', error);
    return null;
  }
}
