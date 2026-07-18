import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/server/auth";
import { getUsage } from "../../../lib/server/usage";
import { tierConfig, USAGE_COSTS } from "../../../lib/entitlements";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const usage = await getUsage(user.uid);
  const config = tierConfig(usage.tier);

  return NextResponse.json({
    success: true,
    used_pct: usage.used_pct,
    remaining_pct: Math.max(0, Math.round((100 - usage.used_pct) * 10) / 10),
    window_start: usage.window_start,
    resets_at: usage.resets_at,
    costs: USAGE_COSTS,
    tier: usage.tier,
    tierLabel: config.label,
    adsEnabled: config.ads,
    // legacy fields for older clients
    used: usage.used_pct,
    limit: 100,
    remaining: Math.max(0, 100 - usage.used_pct),
  });
}
