import "server-only";
import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;

function loadCredentials() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch (error) {
    console.error("[firebase-admin] FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64 JSON:", error);
    return null;
  }
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64);
}

function getAdminApp(): App | null {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const credentials = loadCredentials();
  if (!credentials) return null;
  app = initializeApp({ credential: cert(credentials) });
  return app;
}

export function adminAuth(): Auth | null {
  const instance = getAdminApp();
  return instance ? getAuth(instance) : null;
}

export function adminDb(): Firestore | null {
  const instance = getAdminApp();
  return instance ? getFirestore(instance) : null;
}
