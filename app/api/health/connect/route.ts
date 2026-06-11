import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { buildConsentUrl, isHealthConfigured } from "../../../../lib/server/google-health";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  if (!isHealthConfigured()) {
    return NextResponse.json(
      { success: false, error: "Google Health is not configured yet. Set GOOGLE_HEALTH_CLIENT_ID/SECRET." },
      { status: 503 }
    );
  }

  // uid travels in OAuth state so the callback can attribute the tokens.
  const state = Buffer.from(JSON.stringify({ uid: user.uid, t: Date.now() })).toString("base64url");
  return NextResponse.json({ success: true, url: buildConsentUrl(state) });
}
