"use client";
import { auth } from "./firebase";

/**
 * fetch wrapper that attaches the Firebase ID token so API routes can verify
 * the caller server-side. All calls to /api/* should go through this.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
      // Dev fallback used only when the server has no admin credentials.
      headers.set("x-user-id", user.uid);
    } catch (error) {
      console.error("[api-client] could not get ID token:", error);
    }
  }
  return fetch(input, { ...init, headers });
}
