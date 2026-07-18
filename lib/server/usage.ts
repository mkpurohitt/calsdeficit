import "server-only";
import { adminDb } from "./firebase-admin";
import { getEntitlement } from "./entitlements";
import { USAGE_COSTS, type UsageKind } from "../entitlements";

export type { UsageKind };

export interface UsageResult {
  allowed: boolean;
  /** Percent of the window used AFTER this call (0–100). */
  used_pct: number;
  /** Cost charged for this call (percent points). */
  cost: number;
  tier: string;
  /** ISO time the current window started; null when no window is open. */
  window_start: string | null;
  /** ISO time the current window resets; null when no window is open. */
  resets_at: string | null;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

interface WindowState {
  window_start: string;
  used_pct: number;
}

// Dev fallback when Firestore admin is not configured. Serverless instances
// reset this, which is fine for local development only.
const memoryUsage = (globalThis as unknown as {
  __calolean_usage_v2?: Map<string, WindowState>;
}).__calolean_usage_v2 ??= new Map();

function effectiveCost(kind: UsageKind, usageDivisor: number): number {
  return USAGE_COSTS[kind] / Math.max(1, usageDivisor);
}

function windowIsLive(state: WindowState | null | undefined, now: number): state is WindowState {
  if (!state?.window_start) return false;
  return now - new Date(state.window_start).getTime() < WINDOW_MS;
}

function resetsAt(state: WindowState): string {
  return new Date(new Date(state.window_start).getTime() + WINDOW_MS).toISOString();
}

/** Reads the current usage window without charging anything. */
export async function getUsage(uid: string): Promise<UsageResult> {
  const { tier } = await getEntitlement(uid);
  const now = Date.now();
  const db = adminDb();

  let state: WindowState | null = null;
  if (!db) {
    state = memoryUsage.get(uid) ?? null;
  } else {
    const snap = await db.collection("users").doc(uid).collection("usage").doc("window").get();
    state = snap.exists ? (snap.data() as WindowState) : null;
  }

  if (!windowIsLive(state, now)) {
    return { allowed: true, used_pct: 0, cost: 0, tier, window_start: null, resets_at: null };
  }
  return {
    allowed: state.used_pct < 100,
    used_pct: Math.round(state.used_pct * 10) / 10,
    cost: 0,
    tier,
    window_start: state.window_start,
    resets_at: resetsAt(state),
  };
}

/**
 * Charges one prompt against the user's rolling 24-hour usage window
 * (Claude-style): the window opens on the user's first prompt and fully
 * resets 24 h after that first prompt. Costs are percent points per prompt
 * kind (USAGE_COSTS: text 8, image 10, video 20); premium divides costs by
 * its usageDivisor. Returns { allowed: false } when the charge would exceed
 * 100%.
 */
export async function consumeUsage(uid: string, kind: UsageKind = "text"): Promise<UsageResult> {
  const { tier, config } = await getEntitlement(uid);
  const cost = effectiveCost(kind, config.usageDivisor);
  const now = Date.now();
  const db = adminDb();

  const apply = (state: WindowState | null): { next: WindowState; allowed: boolean } => {
    if (!windowIsLive(state, now)) {
      // First prompt opens a fresh window, charged immediately.
      return { next: { window_start: new Date(now).toISOString(), used_pct: cost }, allowed: true };
    }
    if (state.used_pct + cost > 100) {
      return { next: state, allowed: false };
    }
    return { next: { window_start: state.window_start, used_pct: state.used_pct + cost }, allowed: true };
  };

  const toResult = (state: WindowState, allowed: boolean): UsageResult => ({
    allowed,
    used_pct: Math.round(state.used_pct * 10) / 10,
    cost: allowed ? cost : 0,
    tier,
    window_start: state.window_start,
    resets_at: resetsAt(state),
  });

  if (!db) {
    const result = apply(memoryUsage.get(uid) ?? null);
    if (result.allowed) memoryUsage.set(uid, result.next);
    return toResult(result.next, result.allowed);
  }

  const ref = db.collection("users").doc(uid).collection("usage").doc("window");
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const state = snap.exists ? (snap.data() as WindowState) : null;
    const result = apply(state);
    if (result.allowed) {
      tx.set(ref, { ...result.next, updatedAt: new Date(now).toISOString() }, { merge: true });
    }
    return toResult(result.next, result.allowed);
  });
}

/** Human message for a 429 when the window is exhausted. */
export function usageLimitMessage(usage: UsageResult): string {
  if (usage.resets_at) {
    const at = new Date(usage.resets_at);
    const hh = at.getUTCHours().toString().padStart(2, "0");
    const mm = at.getUTCMinutes().toString().padStart(2, "0");
    return `You've used 100% of your AI usage for now. It resets at ${hh}:${mm} UTC.`;
  }
  return "You've used 100% of your AI usage for now. Try again later.";
}
