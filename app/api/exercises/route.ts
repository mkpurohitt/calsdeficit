import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { enrichExerciseList, enrichExerciseRecord } from '../../../lib/exercise-catalog';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim();
    const query = searchParams.get('query')?.trim();
    const muscle = searchParams.get('muscle')?.trim();

    if (id) {
      const result = await supabase
        .from('exercises')
        .select('id, name, muscle_group, equipment, gif_url')
        .eq('id', id)
        .single();

      if (result.error) {
        return NextResponse.json(
          { success: false, error: result.error.message },
          { status: 404 }
        );
      }

      const enriched = await enrichExerciseRecord(result.data);
      return NextResponse.json({ success: true, data: sanitizeExercise(enriched) });
    }

    let result;
    let queryBuilder = supabase.from('exercises').select('id, name, muscle_group, equipment, gif_url');

    if (query) {
      queryBuilder = queryBuilder.ilike('name', `%${query}%`);
    }
    
    if (muscle) {
      queryBuilder = queryBuilder.ilike('muscle_group', `%${muscle}%`);
    }

    result = await queryBuilder.limit(query || muscle ? 15 : 10);

    if (result.error) {
      console.error('[Exercises API] Supabase error:', result.error.message);
      return NextResponse.json(
        { success: false, error: result.error.message },
        { status: 500 }
      );
    }

    const enrichedList = await enrichExerciseList(result.data || []);
    return NextResponse.json({ success: true, data: enrichedList.map(sanitizeExercise) });
  } catch (error: any) {
    console.error('[Exercises API] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
