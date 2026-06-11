import "server-only";
import { GoogleGenAI } from "@google/genai";

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
