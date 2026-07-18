import "server-only";
import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { genai, visionModelId } from "./genai";

/** Structured workout parsed from a text prompt and/or a short video. */
export const workoutParseZod = z.object({
  exercise_name: z.string(),
  muscle_group: z.string().catch(""),
  sets: z.number().int().min(1).max(20).catch(3),
  reps: z.number().int().min(1).max(100).catch(10),
  weight_kg: z.number().min(0).max(500).catch(0),
  confidence: z.number().min(0).max(1).catch(0.5),
});
export type WorkoutParse = z.infer<typeof workoutParseZod>;

const workoutParseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    exercise_name: { type: Type.STRING, description: "Common gym name of the exercise, e.g. 'Barbell Bench Press'" },
    muscle_group: { type: Type.STRING, description: "Primary muscle worked, e.g. 'chest'" },
    sets: { type: Type.NUMBER, description: "Number of sets (default 3 when unstated)" },
    reps: { type: Type.NUMBER, description: "Reps per set (default 10 when unstated)" },
    weight_kg: { type: Type.NUMBER, description: "Weight in kg (0 for bodyweight or unstated)" },
    confidence: { type: Type.NUMBER, description: "0-1 confidence in the identification" },
  },
  required: ["exercise_name", "sets", "reps", "weight_kg"],
};

const PROMPT = `You are Calolean's gym logging AI. From the user's message (and video, if provided), identify the ONE exercise they performed and the sets/reps/weight. Defaults: 3 sets, 10 reps, 0 kg when unstated. Convert lbs to kg if the user used lbs.`;

/**
 * Parses "bench press 4x8 60kg"-style prompts (optionally with a workout
 * video) into a loggable structured workout.
 */
export async function parseWorkout({
  message,
  base64Data,
  mimeType,
}: {
  message?: string;
  base64Data?: string;
  mimeType?: string;
}): Promise<WorkoutParse> {
  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
    { text: message ? `${PROMPT}\n\nUser: ${message}` : PROMPT },
  ];
  if (base64Data && mimeType) {
    parts.push({ inlineData: { data: base64Data, mimeType } });
  }

  const response = await genai().models.generateContent({
    model: visionModelId(),
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: workoutParseSchema,
      temperature: 0.1,
    },
  });

  const text = response.text;
  if (!text) throw new Error("AI returned an empty response. Please try again.");
  const parsed = workoutParseZod.parse(JSON.parse(text));
  if (!parsed.exercise_name.trim()) throw new Error("Could not identify the exercise. Please try again.");
  return parsed;
}
