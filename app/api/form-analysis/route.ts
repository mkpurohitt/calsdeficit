import { NextResponse } from "next/server";
import { z } from "zod";
import { Type, type Schema } from "@google/genai";
import { genai, visionModelId } from "../../../lib/server/genai";
import { getFormReference } from "../../../lib/server/exercise-db";
import { requireUser } from "../../../lib/server/auth";
import { consumeUsage, usageLimitMessage } from "../../../lib/server/usage";
import { tierConfig } from "../../../lib/entitlements";
import { adminDb } from "../../../lib/server/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Compact joint telemetry computed on-device by lib/pose — the video itself
// never leaves the user's device.
const telemetrySchema = z.object({
  exercise_hint: z.string().optional(),
  duration_sec: z.number(),
  frames_analyzed: z.number(),
  rep_count: z.number().optional(),
  joints: z.record(
    z.string(),
    z.object({ min: z.number(), max: z.number(), avg: z.number().optional() })
  ),
  torso_lean_max_deg: z.number().optional(),
  notes: z.array(z.string()).optional(),
});

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    exercise_name: { type: Type.STRING, description: "The exercise being performed" },
    score: { type: Type.NUMBER, description: "Form score 0-100" },
    verdict: { type: Type.STRING, description: "One-line overall verdict" },
    positives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 things done well" },
    corrections: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-4 specific form corrections" },
    suggested_ad_keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 generic fitness shopping keywords (e.g. 'lifting belt', 'gym gear'). Never personal data.",
    },
  },
  required: ["exercise_name", "score", "verdict", "positives", "corrections", "suggested_ad_keywords"],
};

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;

    const body = await req.json();
    const telemetry = telemetrySchema.parse(body.telemetry);

    // Form checks analyse a video on-device; charge the video rate.
    const usage = await consumeUsage(user.uid, "video");
    if (!usage.allowed) {
      return NextResponse.json({ success: false, error: usageLimitMessage(usage) }, { status: 429 });
    }

    const reference = telemetry.exercise_hint ? await getFormReference(telemetry.exercise_hint) : null;

    const jointLines = Object.entries(telemetry.joints)
      .map(([name, range]) => `${name}: ROM ${Math.round(range.min)}° → ${Math.round(range.max)}°`)
      .join("\n");

    const prompt = `You are Calolean's biomechanics coach. A user recorded an exercise video; MediaPipe pose tracking ran on their device and produced this joint-angle telemetry:

Exercise hint: ${telemetry.exercise_hint || "unknown"}
Duration: ${telemetry.duration_sec.toFixed(1)}s over ${telemetry.frames_analyzed} analyzed frames
Reps detected: ${telemetry.rep_count ?? "unknown"}
Max torso lean: ${telemetry.torso_lean_max_deg != null ? Math.round(telemetry.torso_lean_max_deg) + "°" : "unknown"}
Joint ranges of motion:
${jointLines}
${telemetry.notes?.length ? `Detector notes: ${telemetry.notes.join("; ")}` : ""}
${reference ? `\nIdeal form reference for this exercise: ${JSON.stringify(reference)}` : ""}

Identify the exercise, score the form 0-100 against ideal biomechanics (depth, range of motion, stability), and give concrete positives and corrections. Be specific about angles where the telemetry supports it.`;

    const result = await genai().models.generateContent({
      model: visionModelId(),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema, temperature: 0.3 },
    });

    const parsed = JSON.parse(result.text ?? "{}") as {
      exercise_name: string;
      score: number;
      verdict: string;
      positives: string[];
      corrections: string[];
      suggested_ad_keywords: string[];
    };
    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    // Persist server-side when admin is configured (client also writes via the store).
    try {
      const db = adminDb();
      if (db) {
        await db.collection("users").doc(user.uid).collection("formAnalyses").add({
          user_id: user.uid,
          exercise_name: parsed.exercise_name,
          score,
          corrections: parsed.corrections,
          telemetry_summary: jointLines,
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("[Form Analysis API] persist failed:", error);
    }

    const adsEnabled = tierConfig(usage.tier).ads;
    return NextResponse.json({
      success: true,
      data: {
        exercise_name: parsed.exercise_name,
        score,
        verdict: parsed.verdict,
        feedback: {
          positive: parsed.positives.join(" "),
          improvement: parsed.corrections.join(" "),
        },
        positives: parsed.positives,
        corrections: parsed.corrections,
      },
      adKeywords: adsEnabled ? parsed.suggested_ad_keywords : [],
      adsEnabled,
      usage: { used_pct: usage.used_pct, resets_at: usage.resets_at, tier: usage.tier },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Form analysis failed.";
    console.error("[Form Analysis API] Fatal error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
