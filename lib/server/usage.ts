import "server-only";
import { adminDb } from "./firebase-admin";
import { getEntitlement } from "./entitlements";

export interface UsageResult {
  allowed: boolean;
  used: number;
  limit: number;
  tier: string;
}

// Dev fallback when Firestore admin is not configured. Serverless instances
// reset this, which is fine for local development only.
const memoryUsage = (globalThis as unknown as {
  __calolean_usage?: Map<string, { date: string; count: number }>;
}).__calolean_usage ??= new Map();

function utcDateKey() {
  return new Date().toISOString().split("T")[0];
}

/** Reads today's usage without incrementing. */
export async function getUsage(uid: string): Promise<UsageResult> {
  const { tier, config } = await getEntitlement(uid);
  const dateKey = utcDateKey();
  const db = adminDb();

  if (!db) {
    const entry = memoryUsage.get(uid);
    const used = entry && entry.date === dateKey ? entry.count : 0;
    return { allowed: used < config.dailyPrompts, used, limit: config.dailyPrompts, tier };
  }

  const snap = await db.collection("users").doc(uid).collection("usage").doc(dateKey).get();
  const used = snap.exists ? Number(snap.data()?.count) || 0 : 0;
  return { allowed: used < config.dailyPrompts, used, limit: config.dailyPrompts, tier };
}

/**
 * Atomically increments today's prompt counter for the user.
 * Returns { allowed: false } when the daily tier limit is reached.
 */
export async function consumeUsage(uid: string): Promise<UsageResult> {
  const { tier, config } = await getEntitlement(uid);
  const dateKey = utcDateKey();
  const db = adminDb();

  if (!db) {
    const entry = memoryUsage.get(uid);
    if (entry && entry.date === dateKey) {
      if (entry.count >= config.dailyPrompts) {
        return { allowed: false, used: entry.count, limit: config.dailyPrompts, tier };
      }
      entry.count += 1;
      return { allowed: true, used: entry.count, limit: config.dailyPrompts, tier };
    }
    memoryUsage.set(uid, { date: dateKey, count: 1 });
    return { allowed: true, used: 1, limit: config.dailyPrompts, tier };
  }

  const ref = db.collection("users").doc(uid).collection("usage").doc(dateKey);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? Number(snap.data()?.count) || 0 : 0;
    if (used >= config.dailyPrompts) {
      return { allowed: false, used, limit: config.dailyPrompts, tier };
    }
    tx.set(ref, { count: used + 1, limit: config.dailyPrompts, updatedAt: new Date().toISOString() }, { merge: true });
    return { allowed: true, used: used + 1, limit: config.dailyPrompts, tier };
  });
}
