import "server-only";
import crypto from "node:crypto";
import { adminDb } from "./firebase-admin";

/**
 * Google Health API integration (the successor to the deprecated Google Fit
 * REST API; docs: https://developers.google.com/health).
 *
 * OAuth web-server flow: /api/health/connect → Google consent →
 * /api/health/callback stores the AES-GCM-encrypted refresh token in the
 * admin-only `private/{uid}` doc → /api/health/sync pulls daily steps.
 */

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
// Adjustable while the Health API rolls out regionally.
const HEALTH_API_BASE = process.env.GOOGLE_HEALTH_API_BASE || "https://health.googleapis.com/v1";
const SCOPES =
  process.env.GOOGLE_HEALTH_SCOPES || "https://www.googleapis.com/auth/health.activity.read";

export function isHealthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_HEALTH_CLIENT_ID && process.env.GOOGLE_HEALTH_CLIENT_SECRET);
}

export function buildConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI!,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

// ── refresh-token encryption (AES-256-GCM with TOKEN_ENCRYPTION_KEY) ──

function encryptionKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes hex (openssl rand -hex 32).");
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptToken(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ── connection storage (admin-only `private/{uid}`) ──

export async function saveConnection(uid: string, refreshToken: string) {
  const db = adminDb();
  if (!db) throw new Error("Firestore admin not configured.");
  await db.collection("private").doc(uid).set(
    {
      healthConnect: {
        status: "connected",
        scopes: SCOPES,
        refreshTokenEnc: encryptToken(refreshToken),
        connectedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );
}

export async function getConnection(uid: string): Promise<string | null> {
  const db = adminDb();
  if (!db) return null;
  const snap = await db.collection("private").doc(uid).get();
  const enc = snap.exists ? snap.data()?.healthConnect?.refreshTokenEnc : null;
  return enc ? decryptToken(enc) : null;
}

export async function disconnect(uid: string) {
  const db = adminDb();
  if (!db) return;
  await db.collection("private").doc(uid).set(
    { healthConnect: { status: "disconnected", refreshTokenEnc: null } },
    { merge: true }
  );
}

// ── data fetch ──

/** Fetches the step total for a local date (YYYY-MM-DD). */
export async function fetchDailySteps(uid: string, dateKey: string): Promise<number | null> {
  const refreshToken = await getConnection(uid);
  if (!refreshToken) return null;

  const { access_token } = await refreshAccessToken(refreshToken);

  // Google Health API daily activity summary. Endpoint shape per
  // https://developers.google.com/health — adjust GOOGLE_HEALTH_API_BASE if
  // your project was onboarded to a different version.
  const res = await fetch(`${HEALTH_API_BASE}/users/me/dailyActivitySummaries/${dateKey}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) {
    console.error(`[google-health] steps fetch failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  const steps = Number(data?.steps ?? data?.summary?.steps ?? data?.activitySummary?.steps);
  return Number.isFinite(steps) ? steps : null;
}
