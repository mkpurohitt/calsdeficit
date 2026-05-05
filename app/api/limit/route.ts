import { NextResponse } from "next/server";
import { globalUsage } from "../../../lib/rate-limit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ success: false, error: "User ID required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  const usageMap = globalUsage.promptUsage as Map<string, { date: string; count: number }>;
  const userUsage = usageMap?.get(userId);

  let used = 0;
  if (userUsage && userUsage.date === today) {
    used = userUsage.count;
  }

  return NextResponse.json({
    success: true,
    used,
    limit: 10,
    remaining: Math.max(0, 10 - used),
  });
}
