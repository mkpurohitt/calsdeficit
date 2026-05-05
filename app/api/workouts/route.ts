import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, exercise_id, sets, reps, weight_lbs } = body;

    if (!user_id || !exercise_id) {
      return NextResponse.json(
        { success: false, error: 'user_id and exercise_id are required' },
        { status: 400 }
      );
    }

    await supabase.from('users').upsert({
      id: user_id,
      name: user_id === 'guest' ? 'Guest' : 'Athlete',
    }, { onConflict: 'id' });

    const { error } = await supabase.from('workout_logs').insert({
      user_id,
      exercise_id,
      sets: Number(sets) || 0,
      reps: Number(reps) || 0,
      weight_lbs: Number(weight_lbs) || 0,
      logged_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[Workouts API] Supabase insert error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Workouts API] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
