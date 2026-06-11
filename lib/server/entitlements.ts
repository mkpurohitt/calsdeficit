import "server-only";
import { adminDb } from "./firebase-admin";
import { tierConfig, type Tier, type TierConfig } from "../entitlements";

export interface Entitlement {
  tier: Tier;
  config: TierConfig;
}

/** Reads the user's subscription tier from the admin-only `private/{uid}` doc. Defaults to free. */
export async function getEntitlement(uid: string): Promise<Entitlement> {
  try {
    const db = adminDb();
    if (db) {
      const snap = await db.collection("private").doc(uid).get();
      const tier = (snap.exists ? snap.data()?.subscription?.tier : null) as Tier | null;
      if (tier === "premium") return { tier, config: tierConfig(tier) };
    }
  } catch (error) {
    console.error("[entitlements] read failed:", error);
  }
  return { tier: "free", config: tierConfig("free") };
}
