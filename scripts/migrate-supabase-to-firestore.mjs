#!/usr/bin/env node
/**
 * One-shot migration of user data from Supabase to Firestore.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   FIREBASE_SERVICE_ACCOUNT_B64=... node scripts/migrate-supabase-to-firestore.mjs
 *
 * Safe to re-run: documents are keyed deterministically where possible and
 * writes are merges.
 */
import { createClient } from "@supabase/supabase-js";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_SERVICE_ACCOUNT_B64 } = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIREBASE_SERVICE_ACCOUNT_B64) {
  console.error("Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_SERVICE_ACCOUNT_B64");
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
initializeApp({ credential: cert(JSON.parse(Buffer.from(FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString())) });
const db = getFirestore();

async function fetchAll(table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) {
      console.warn(`  [${table}] skipped: ${error.message}`);
      return rows;
    }
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function commitInBatches(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const { ref, data } of writes.slice(i, i + 400)) batch.set(ref, data, { merge: true });
    await batch.commit();
  }
}

async function migrate() {
  console.log("→ user_goals");
  const goals = await fetchAll("user_goals");
  await commitInBatches(goals.map((g) => ({
    ref: db.collection("users").doc(g.user_id),
    data: { goal: g },
  })));
  console.log(`  ${goals.length} migrated`);

  console.log("→ food_logs");
  const foodLogs = await fetchAll("food_logs");
  await commitInBatches(foodLogs.map((row) => ({
    ref: db.collection("users").doc(row.user_id).collection("foodLogs").doc(String(row.id)),
    data: row,
  })));
  console.log(`  ${foodLogs.length} migrated`);

  console.log("→ workout_logs");
  const workoutLogs = await fetchAll("workout_logs");
  await commitInBatches(workoutLogs.map((row) => ({
    ref: db.collection("users").doc(row.user_id).collection("workoutLogs").doc(String(row.id)),
    data: row,
  })));
  console.log(`  ${workoutLogs.length} migrated`);

  console.log("→ form_analyses");
  const analyses = await fetchAll("form_analyses");
  await commitInBatches(analyses.map((row) => ({
    ref: db.collection("users").doc(row.user_id).collection("formAnalyses").doc(String(row.id)),
    data: row,
  })));
  console.log(`  ${analyses.length} migrated`);

  console.log("→ step_sync → days");
  const steps = await fetchAll("step_sync");
  await commitInBatches(steps.map((row) => ({
    ref: db.collection("users").doc(row.user_id).collection("days").doc(row.date_key),
    data: {
      date_key: row.date_key,
      steps: row.steps || 0,
      steps_source: row.source || "manual",
      water_ml: row.water_ml || 0,
      updated_at: row.updated_at || new Date().toISOString(),
    },
  })));
  console.log(`  ${steps.length} migrated`);

  console.log("→ notification_preferences");
  const prefs = await fetchAll("notification_preferences");
  await commitInBatches(prefs.map((row) => ({
    ref: db.collection("users").doc(row.user_id),
    data: { notificationPrefs: row },
  })));
  console.log(`  ${prefs.length} migrated`);

  console.log("Done. Flip NEXT_PUBLIC_DATA_BACKEND to 'firestore' (or remove it) and redeploy.");
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
