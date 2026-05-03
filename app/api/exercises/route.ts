import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query')?.trim();

    let result;

    if (query) {
      // Fuzzy search by exercise name
      result = await supabase
        .from('exercises')
        .select('id, name, muscle_group, equipment, gif_url')
        .ilike('name', `%${query}%`)
        .limit(15);
    } else {
      // No query — return 10 default/popular exercises
      result = await supabase
        .from('exercises')
        .select('id, name, muscle_group, equipment, gif_url')
        .limit(10);
    }

    if (result.error) {
      console.error('[Exercises API] Supabase error:', result.error.message);
      return NextResponse.json(
        { success: false, error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('[Exercises API] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
