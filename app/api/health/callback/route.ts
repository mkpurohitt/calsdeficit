import { NextResponse } from "next/server";
import { exchangeCode, saveConnection } from "../../../../lib/server/google-health";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const redirect = (status: string) =>
    NextResponse.redirect(`${origin}/profile/google-fit?status=${status}`);

  if (errorParam) return redirect("denied");
  if (!code || !state) return redirect("error");

  try {
    const { uid } = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { uid: string };
    if (!uid) return redirect("error");

    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return redirect("no-refresh-token");

    await saveConnection(uid, tokens.refresh_token);
    return redirect("connected");
  } catch (error) {
    console.error("[Health Callback] failed:", error);
    return redirect("error");
  }
}
