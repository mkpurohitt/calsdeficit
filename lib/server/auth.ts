import "server-only";
import { NextResponse } from "next/server";
import { adminAuth, isAdminConfigured } from "./firebase-admin";

export interface AuthedUser {
  uid: string;
  email?: string;
}

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Returns the authenticated user, or a NextResponse error to return as-is.
 *
 * When FIREBASE_SERVICE_ACCOUNT_B64 is not configured (local dev only),
 * falls back to the unverified `x-user-id` header so the app stays usable
 * before credentials are pasted in. In production the admin SDK is required.
 */
export async function requireUser(req: Request): Promise<AuthedUser | NextResponse> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!isAdminConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "Server auth is not configured. Set FIREBASE_SERVICE_ACCOUNT_B64." },
        { status: 503 }
      );
    }
    const devUid = req.headers.get("x-user-id");
    if (devUid) return { uid: devUid };
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  if (!token) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  try {
    const auth = adminAuth();
    if (!auth) throw new Error("admin unavailable");
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return NextResponse.json({ success: false, error: "Session expired. Please sign in again." }, { status: 401 });
  }
}
