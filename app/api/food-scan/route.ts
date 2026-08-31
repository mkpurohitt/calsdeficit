import { NextResponse } from "next/server";
import { analyzeFoodImage, analyzeFoodText } from "../../../lib/food-analysis";
import { requireUser } from "../../../lib/server/auth";
import { consumeUsage, usageLimitMessage } from "../../../lib/server/usage";
import { tierConfig } from "../../../lib/entitlements";
import { reportError } from '../../../lib/server/api-errors';

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Structured food scan for the diet scanner. Accepts an image, a text
 * description, or both — text-only lets users log by typing what they ate.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;

    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const mealType = (formData.get("meal_type") as string) || "Snacks";
    const userContext = (formData.get("context") as string) || undefined;

    if (!image && !userContext?.trim()) {
      return NextResponse.json(
        { success: false, error: "Add a photo or describe the food." },
        { status: 400 }
      );
    }

    const usage = await consumeUsage(user.uid, image ? "image" : "text");
    if (!usage.allowed) {
      return NextResponse.json({ success: false, error: usageLimitMessage(usage) }, { status: 429 });
    }

    let data;
    if (image) {
      const arrayBuffer = await image.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString("base64");
      data = await analyzeFoodImage({
        base64Data,
        mimeType: image.type,
        mealType,
        userContext,
      });
    } else {
      data = await analyzeFoodText({ description: userContext as string, mealType });
    }

    const adsEnabled = tierConfig(usage.tier).ads;
    return NextResponse.json({
      success: true,
      data,
      adKeywords: adsEnabled ? data.suggested_ad_keywords : [],
      adsEnabled,
      usage: { used_pct: usage.used_pct, resets_at: usage.resets_at, tier: usage.tier },
    });
  } catch (error) {
    // Never echo a provider error to the client — it leaks project ids and
    // reads as gibberish. reportError logs the real one server-side.
    const failure = reportError('Food Scan API', error);
    return NextResponse.json({ success: false, error: failure.message }, { status: failure.status });
  }
}
