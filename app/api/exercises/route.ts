import { NextResponse } from 'next/server';
import { findExercises } from '../../../lib/server/exercise-db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim();
    const query = searchParams.get('query')?.trim();
    const muscle = searchParams.get('muscle')?.trim();

    if (id) {
      const [exercise] = await findExercises({ id });
      if (!exercise) {
        return NextResponse.json({ success: false, error: 'Exercise not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: exercise });
    }

    const data = await findExercises({
      query: query || undefined,
      muscles: muscle ? [muscle] : undefined,
      limit: query || muscle ? 15 : 10,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Exercise lookup failed.';
    console.error('[Exercises API] Fatal error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
