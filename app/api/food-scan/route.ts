import { NextResponse } from "next/server";
import { analyzeFoodImage } from "../../../lib/food-analysis";
import { checkAndIncrementRateLimit } from "../../../lib/rate-limit";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const mealType = (formData.get("meal_type") as string) || "Snacks";
    const userId = formData.get("user_id") as string;

    if (userId && !checkAndIncrementRateLimit(userId)) {
      return NextResponse.json(
        { success: false, error: "Daily limit reached (10/10). Please try again tomorrow to save credits." },
        { status: 429 }
      );
    }

    if (!image) {
      return NextResponse.json(
        { success: false, error: "No image provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const data = await analyzeFoodImage({
      base64Data,
      mimeType: image.type,
      mealType,
    });

    return NextResponse.json({
      success: true,
      data,
      db_saved: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Food scan failed.";
    console.error("[Food Scan API] Fatal error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

