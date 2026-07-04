import { NextResponse } from 'next/server';
import { countExercises, findExercises } from '../../../lib/server/exercise-db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim();
    const query = searchParams.get('query')?.trim();
    const muscle = searchParams.get('muscle')?.trim();
    const counts = searchParams.get('counts');
    const limitParam = Number(searchParams.get('limit'));

    // Real library stats (total + per-muscle-group counts)
    if (counts) {
      const data = await countExercises();
      return NextResponse.json({ success: true, data });
    }

    if (id) {
      const [exercise] = await findExercises({ id });
      if (!exercise) {
        return NextResponse.json({ success: false, error: 'Exercise not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: exercise });
    }

    // Explicit limit (capped) supports the full library grid; defaults unchanged
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 200)
      : query || muscle ? 15 : 10;

    const data = await findExercises({
      query: query || undefined,
      muscles: muscle ? [muscle] : undefined,
      limit,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Exercise lookup failed.';
    console.error('[Exercises API] Fatal error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
