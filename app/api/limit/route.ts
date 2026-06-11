import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/server/auth";
import { getUsage } from "../../../lib/server/usage";
import { tierConfig } from "../../../lib/entitlements";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const usage = await getUsage(user.uid);
  const config = tierConfig(usage.tier);

  return NextResponse.json({
    success: true,
    used: usage.used,
    limit: usage.limit,
    remaining: Math.max(0, usage.limit - usage.used),
    tier: usage.tier,
    tierLabel: config.label,
    adsEnabled: config.ads,
  });
}
