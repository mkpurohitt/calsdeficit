import { NextResponse } from "next/server";
import { analyzeFoodImage } from "../../../lib/food-analysis";
import { requireUser } from "../../../lib/server/auth";
import { consumeUsage } from "../../../lib/server/usage";
import { tierConfig } from "../../../lib/entitlements";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;

    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const mealType = (formData.get("meal_type") as string) || "Snacks";
    const userContext = (formData.get("context") as string) || undefined;

    if (!image) {
      return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 });
    }

    const usage = await consumeUsage(user.uid);
    if (!usage.allowed) {
      return NextResponse.json(
        { success: false, error: `Daily limit reached (${usage.used}/${usage.limit}). Upgrade or try again tomorrow.` },
        { status: 429 }
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const data = await analyzeFoodImage({
      base64Data,
      mimeType: image.type,
      mealType,
      userContext,
    });

    const adsEnabled = tierConfig(usage.tier).ads;
    return NextResponse.json({
      success: true,
      data,
      adKeywords: adsEnabled ? data.suggested_ad_keywords : [],
      adsEnabled,
      usage: { used: usage.used, limit: usage.limit, tier: usage.tier },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Food scan failed.";
    console.error("[Food Scan API] Fatal error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
