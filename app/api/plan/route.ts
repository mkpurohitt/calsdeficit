import { NextResponse } from 'next/server';
import { genai, chatModelId } from '../../../lib/server/genai';
import { requireUser } from '../../../lib/server/auth';
import { templateWeeklyPlan, type GoalType } from '../../../lib/plan';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Generates a short personalized weekly exercise plan for onboarding/goal
 * updates. Falls back to a solid template if the AI is unavailable so the
 * flow never blocks.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;

    const { gender, age, height_cm, weight_kg, goal, activity_level, daily_calories, protein_g } = await req.json();
    const goalType = (['Lose Weight', 'Maintain Weight', 'Gain Muscle'].includes(goal) ? goal : 'Maintain Weight') as GoalType;

    try {
      const prompt = `Create a 7-day weekly exercise plan for this user. Output ONLY the plan as 7 markdown lines, one per day, format: "**Mon** — <workout>". No intro, no outro.
User: ${gender}, ${age}y, ${height_cm}cm, ${weight_kg}kg, goal: ${goalType}, activity: ${activity_level}, target ${daily_calories} kcal/day, ${protein_g}g protein.
Make it specific (muscle groups / activity + duration), realistic for their activity level, with adequate rest days.`;

      const result = await genai().models.generateContent({
        model: chatModelId(),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      const text = (result.text ?? '').trim();
      // Sanity check: a real plan has several day lines
      if (text && text.split('\n').filter((l) => l.includes('**')).length >= 5) {
        return NextResponse.json({ success: true, plan: text, source: 'ai' });
      }
      return NextResponse.json({ success: true, plan: templateWeeklyPlan(goalType), source: 'template' });
    } catch (aiError) {
      console.error('[Plan API] AI generation failed, using template:', aiError);
      return NextResponse.json({ success: true, plan: templateWeeklyPlan(goalType), source: 'template' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plan generation failed.';
    console.error('[Plan API] Fatal error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
