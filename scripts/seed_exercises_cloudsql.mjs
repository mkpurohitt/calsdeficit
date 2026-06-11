#!/usr/bin/env node
/**
 * Seeds the Cloud SQL `exercises` table with the fully enriched open dataset
 * (gif URLs, instructions, secondary muscles baked in — no runtime fetch).
 *
 * Run migrations in db/migrations/ first, then:
 *   CLOUD_SQL_CONNECTION_NAME=project:region:instance CLOUD_SQL_DB=calolean \
 *   CLOUD_SQL_USER=... CLOUD_SQL_PASSWORD=... GCP_SERVICE_ACCOUNT_B64=... \
 *   node scripts/seed_exercises_cloudsql.mjs
 *
 * For a direct (non-connector) connection, set PGHOST/PGPORT instead and the
 * script will use plain pg.
 */
import pg from "pg";

const DATASET_URL = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";
const RAW_BASE = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/";

function gifUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${RAW_BASE}${path.replace(/^\.\//, "")}`;
}

async function getPool() {
  if (process.env.PGHOST) {
    return new pg.Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.CLOUD_SQL_DB,
      user: process.env.CLOUD_SQL_USER,
      password: process.env.CLOUD_SQL_PASSWORD,
    });
  }
  const { Connector } = await import("@google-cloud/cloud-sql-connector");
  const { GoogleAuth } = await import("google-auth-library");
  const b64 = process.env.GCP_SERVICE_ACCOUNT_B64;
  const connector = new Connector(
    b64
      ? {
          auth: new GoogleAuth({
            credentials: JSON.parse(Buffer.from(b64, "base64").toString("utf8")),
            scopes: ["https://www.googleapis.com/auth/sqlservice.admin"],
          }),
        }
      : undefined
  );
  const opts = await connector.getOptions({
    instanceConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME,
  });
  return new pg.Pool({
    ...opts,
    database: process.env.CLOUD_SQL_DB,
    user: process.env.CLOUD_SQL_USER,
    password: process.env.CLOUD_SQL_PASSWORD,
  });
}

async function seed() {
  console.log("Fetching dataset…");
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`Dataset HTTP ${res.status}`);
  const raw = await res.json();
  console.log(`${raw.length} exercises fetched. Seeding…`);

  const pool = await getPool();
  let count = 0;
  for (const entry of raw) {
    const id = entry.id || String(count);
    await pool.query(
      `INSERT INTO exercises (id, name, muscle_group, body_part, equipment, gif_url, secondary_muscles, instructions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, muscle_group = $3, body_part = $4, equipment = $5,
         gif_url = $6, secondary_muscles = $7, instructions = $8`,
      [
        id,
        entry.name,
        entry.target || entry.bodyPart || "full body",
        entry.bodyPart || null,
        entry.equipment || null,
        gifUrl(entry.gifUrl),
        entry.secondaryMuscles || [],
        JSON.stringify(entry.instructions || []),
      ]
    );
    count += 1;
    if (count % 200 === 0) console.log(`  ${count}/${raw.length}`);
  }

  console.log(`Done: ${count} exercises seeded. Now run db/migrations/004_form_reference.sql.`);
  await pool.end();
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
