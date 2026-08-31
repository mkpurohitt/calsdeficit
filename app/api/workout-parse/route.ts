import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/server/auth";
import { consumeUsage, usageLimitMessage } from "../../../lib/server/usage";
import { parseWorkout } from "../../../lib/server/workout-parse";
import { reportError } from '../../../lib/server/api-errors';

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Parses a workout from a text prompt and/or short video into a structured
 * { exercise_name, sets, reps, weight_kg } the client saves as a workout log.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;

    const { message, fileData, mimeType } = await req.json();
    if (!message && !fileData) {
      return NextResponse.json({ success: false, error: "Describe the exercise or attach a video." }, { status: 400 });
    }

    const isVideo = typeof mimeType === "string" && mimeType.startsWith("video/");
    const usage = await consumeUsage(user.uid, isVideo ? "video" : "text");
    if (!usage.allowed) {
      return NextResponse.json({ success: false, error: usageLimitMessage(usage) }, { status: 429 });
    }

    const workout = await parseWorkout({
      message: message || undefined,
      base64Data: typeof fileData === "string" ? fileData.split(",").pop() : undefined,
      mimeType: mimeType || undefined,
    });

    return NextResponse.json({ success: true, workout, usage: { used_pct: usage.used_pct, resets_at: usage.resets_at } });
  } catch (error) {
    // Never echo a provider error to the client — it leaks project ids and
    // reads as gibberish. reportError logs the real one server-side.
    const failure = reportError('Workout Parse API', error);
    return NextResponse.json({ success: false, error: failure.message }, { status: failure.status });
  }
}
