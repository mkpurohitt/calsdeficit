import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { fetchDailySteps, disconnect } from "../../../../lib/server/google-health";
import { adminDb } from "../../../../lib/server/firebase-admin";

export const runtime = "nodejs";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  try {
    const body = await req.json().catch(() => ({}));
    // The client supplies its local date key — the server must not compute
    // it (UTC would mis-bucket the day).
    const dateKey = typeof body.date_key === "string" && DATE_KEY_RE.test(body.date_key)
      ? body.date_key
      : null;
    if (!dateKey) {
      return NextResponse.json({ success: false, error: "date_key (YYYY-MM-DD) required" }, { status: 400 });
    }

    if (body.action === "disconnect") {
      await disconnect(user.uid);
      return NextResponse.json({ success: true, status: "disconnected" });
    }

    const steps = await fetchDailySteps(user.uid, dateKey);
    if (steps === null) {
      return NextResponse.json(
        { success: false, error: "Not connected to Google Health, or no data for this day." },
        { status: 404 }
      );
    }

    const db = adminDb();
    if (db) {
      await db.collection("users").doc(user.uid).collection("days").doc(dateKey).set(
        { date_key: dateKey, steps, steps_source: "google-health", updated_at: new Date().toISOString() },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true, steps, date_key: dateKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    console.error("[Health Sync] failed:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
