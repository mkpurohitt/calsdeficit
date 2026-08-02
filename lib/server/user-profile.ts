import "server-only";
import { adminDb } from "./firebase-admin";

/**
 * Server-side read of the profile the onboarding wizard saved
 * (`users/{uid}.goal`), so AI answers can be grounded in the user's real
 * targets, training volume and health context instead of generic advice.
 *
 * Every failure path returns null — personalization is an enhancement and must
 * never block a chat turn.
 */

export interface AiUserContext {
  age?: number;
  gender?: string;
  weight_kg?: number;
  height_cm?: number;
  goal?: string;
  goal_weight_kg?: number;
  activity_level?: string;
  workout_days?: number;
  daily_calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  health_conditions?: string[];
  dietary_preference?: string;
  allergies?: string[];
  health_notes?: string;
}

export async function getUserContext(uid: string): Promise<AiUserContext | null> {
  try {
    const db = adminDb();
    if (!db) return null;
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return null;
    const goal = snap.data()?.goal as AiUserContext | undefined;
    return goal ?? null;
  } catch (error) {
    console.error("[user-profile] context read failed:", error);
    return null;
  }
}

/**
 * Compact prompt block. Kept terse on purpose: it rides along on every turn, so
 * it must be cheap, and only carries what changes an answer.
 */
export function describeUserContext(ctx: AiUserContext | null): string {
  if (!ctx) return "";
  const bits: string[] = [];

  const body = [
    ctx.age ? `${ctx.age}y` : "",
    ctx.gender || "",
    ctx.weight_kg ? `${ctx.weight_kg}kg` : "",
    ctx.height_cm ? `${ctx.height_cm}cm` : "",
  ].filter(Boolean).join(" · ");
  if (body) bits.push(`Body: ${body}`);

  if (ctx.goal) {
    bits.push(`Goal: ${ctx.goal}${ctx.goal_weight_kg ? ` (target ${ctx.goal_weight_kg}kg)` : ""}`);
  }
  if (ctx.daily_calories) {
    bits.push(
      `Daily targets: ${ctx.daily_calories} kcal` +
        [ctx.protein_g ? `, ${ctx.protein_g}g protein` : "", ctx.carbs_g ? `, ${ctx.carbs_g}g carbs` : "", ctx.fat_g ? `, ${ctx.fat_g}g fat` : ""].join("")
    );
  }
  if (ctx.activity_level || ctx.workout_days) {
    bits.push(`Training: ${ctx.activity_level || "unspecified"}${ctx.workout_days ? `, ${ctx.workout_days} days/week` : ""}`);
  }
  if (ctx.dietary_preference) bits.push(`Diet: ${ctx.dietary_preference}`);
  if (ctx.allergies?.length) bits.push(`Allergies (never suggest these): ${ctx.allergies.join(", ")}`);
  if (ctx.health_conditions?.length) bits.push(`Health conditions: ${ctx.health_conditions.join(", ")}`);
  if (ctx.health_notes) bits.push(`Notes: ${String(ctx.health_notes).slice(0, 300)}`);

  if (!bits.length) return "";
  return `\n\nABOUT THIS USER (tailor every answer to it; never repeat it back verbatim):\n${bits.map((b) => `- ${b}`).join("\n")}`;
}

/**
 * Safety rider for the conditions where generic fitness advice can do harm.
 * Only added when the user actually reported something.
 */
export function healthSafetyRider(ctx: AiUserContext | null): string {
  if (!ctx?.health_conditions?.length) return "";
  const c = ctx.health_conditions.map((x) => x.toLowerCase()).join(" ");
  const rules: string[] = [];
  if (/diabet/.test(c)) rules.push("flag high-glycaemic foods and prefer low-GI swaps");
  if (/hypertension|blood pressure/.test(c)) rules.push("flag high-sodium foods");
  if (/kidney|renal/.test(c)) rules.push("avoid recommending high-protein loads without a caveat");
  if (/heart|cardiac|cholesterol/.test(c)) rules.push("flag saturated fat and prefer heart-healthy swaps");
  if (/pcos|thyroid/.test(c)) rules.push("prefer whole foods and steady blood-sugar choices");
  if (/celiac|gluten/.test(c)) rules.push("never suggest gluten-containing foods");
  if (/lactose/.test(c)) rules.push("never suggest dairy without a lactose-free alternative");
  if (/pregnan/.test(c)) rules.push("avoid foods unsafe in pregnancy and never suggest aggressive deficits");

  const base =
    "\n\nHEALTH SAFETY: The user reported health conditions. Give practical guidance, " +
    "and where it genuinely matters add ONE short line telling them to confirm with their doctor — " +
    "do not caveat every sentence, and never refuse ordinary nutrition questions.";
  return rules.length ? `${base} Specifically: ${rules.join("; ")}.` : base;
}
