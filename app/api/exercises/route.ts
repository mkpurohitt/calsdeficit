import { NextResponse } from 'next/server';
import { countExercises, expandMuscleFilter, findExercises } from '../../../lib/server/exercise-db';
import { reportError } from '../../../lib/server/api-errors';

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

    // `muscle` is a UI group name ("chest") or a comma-separated list; each is
    // expanded to every spelling the merged catalogue uses for it.
    const muscles = muscle
      ? muscle.split(",").flatMap((m) => expandMuscleFilter(m))
      : undefined;

    const data = await findExercises({
      query: query || undefined,
      muscles: muscles?.length ? muscles : undefined,
      limit,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    // Never echo a provider error to the client — it leaks project ids and
    // reads as gibberish. reportError logs the real one server-side.
    const failure = reportError('Exercises API', error);
    return NextResponse.json({ success: false, error: failure.message }, { status: failure.status });
  }
}
