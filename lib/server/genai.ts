import "server-only";
import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";

let client: GoogleGenAI | null = null;

/**
 * Unified Gemini client. Uses Vertex AI when GCP credentials are configured
 * (production), otherwise falls back to the Gemini API key (local dev).
 */
export function genai(): GoogleGenAI {
  if (client) return client;

  const project = process.env.GCP_PROJECT_ID;
  const b64 = process.env.GCP_SERVICE_ACCOUNT_B64;

  if (project && b64) {
    client = new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env.VERTEX_LOCATION || "global",
      googleAuthOptions: {
        credentials: JSON.parse(Buffer.from(b64, "base64").toString("utf8")),
      },
    });
    return client;
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini is not configured. Set GCP_PROJECT_ID + GCP_SERVICE_ACCOUNT_B64 (Vertex AI) or GOOGLE_API_KEY (dev)."
    );
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

/** Conversational model — stronger flash for chat quality. */
export function chatModelId(): string {
  return process.env.GEMINI_CHAT_MODEL || "gemini-3.1-flash";
}

/** Vision / scan / form model — cost-optimized flash-lite per the blueprint. */
export function visionModelId(): string {
  return process.env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite";
}

/**
 * Gemini's flash models think by default on a dynamic budget, and that default
 * turned out to be the single most expensive thing we do. August 2026 billing:
 * 46,871 thinking tokens produced 2,435 output tokens — 19 thinking tokens per
 * useful one, and 63% of the entire Vertex bill.
 *
 * Cost is only half of it. Thinking runs BEFORE the first output token, so the
 * user waits through all of it with an empty screen. Turning it off where it
 * earns nothing is a latency win as much as a billing one.
 *
 * Use this for recall and extraction — answering a nutrition question, routing
 * an intent, pulling "4x8 at 60kg" out of a sentence. Genuine multi-step
 * reasoning (building a week's plan, scoring lifting form) keeps its thinking
 * and should call `generateContent` directly.
 */

/**
 * Not every model lets thinking be switched off, and which ones do changes
 * between releases. Rather than hard-code that knowledge and have chat 400 the
 * day a model id moves, we ask once per model and remember the answer for the
 * life of the container.
 */
const thinkingOptOutUnsupported = new Set<string>();

function rejectsThinkingOptOut(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return (
    /thinking|thought|budget/i.test(raw) &&
    /invalid|unsupported|not supported|cannot be disabled|must be|400/i.test(raw)
  );
}

export async function generateContentFast(
  params: GenerateContentParameters
): Promise<GenerateContentResponse> {
  const ai = genai();
  if (thinkingOptOutUnsupported.has(params.model)) {
    return ai.models.generateContent(params);
  }

  try {
    return await ai.models.generateContent({
      ...params,
      config: { ...params.config, thinkingConfig: { thinkingBudget: 0 } },
    });
  } catch (error) {
    if (!rejectsThinkingOptOut(error)) throw error;
    // The model wants to think. Fine — take the default rather than fail the
    // request, and stop paying for the rejected attempt on every later call.
    console.warn(
      `[genai] ${params.model} rejected thinkingBudget:0 — using default thinking for this container.`
    );
    thinkingOptOutUnsupported.add(params.model);
    return ai.models.generateContent(params);
  }
}

/** Test seam: forget which models rejected the opt-out. */
export function __resetThinkingOptOutCache(): void {
  thinkingOptOutUnsupported.clear();
}
