#!/usr/bin/env node
/**
 * Builds the Calolean food database: seeds the Cloud SQL `foods` table from a
 * USDA FoodData Central bulk CSV dump (no live USDA API at runtime).
 *
 * 1. Download a CSV dataset from https://fdc.nal.usda.gov/download-datasets
 *    (recommended: "SR Legacy" — ~7,800 generic foods with per-100 g values;
 *    "Foundation Foods" also works) and unzip it.
 * 2. Run migrations in db/migrations/ first, then:
 *
 *   CLOUD_SQL_CONNECTION_NAME=project:region:instance CLOUD_SQL_DB=calolean \
 *   CLOUD_SQL_USER=... CLOUD_SQL_PASSWORD=... GCP_SERVICE_ACCOUNT_B64=... \
 *   node scripts/seed_foods_usda.mjs --dir path/to/extracted-csv-folder
 *
 * The folder must contain food.csv and food_nutrient.csv. Values are stored
 * per 100 g. Re-running upserts (keyed on source + external_id).
 *
 * For a direct (non-connector) connection, set PGHOST/PGPORT instead.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import pg from "pg";

// FDC nutrient ids (nutrient.csv): kcal, protein, carbs by difference, fat, fiber
const NUTRIENT_IDS = { 1008: "calories", 1003: "protein", 1005: "carbs", 1004: "fat", 1079: "fiber" };

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
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

/** Streaming CSV reader that handles quoted fields (incl. embedded commas/newlines). */
async function* csvRecords(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, "utf8"),
    crlfDelay: Infinity,
  });
  let fields = [];
  let field = "";
  let inQuotes = false;
  for await (const line of rl) {
    let i = 0;
    if (inQuotes) field += "\n"; // record continued across a newline inside quotes
    while (i < line.length) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(field);
        field = "";
      } else {
        field += ch;
      }
      i++;
    }
    if (!inQuotes) {
      fields.push(field);
      yield fields;
      fields = [];
      field = "";
    }
  }
}

async function loadFoods(dir) {
  // food.csv: fdc_id, data_type, description, ...
  const foods = new Map();
  let header = null;
  for await (const rec of csvRecords(path.join(dir, "food.csv"))) {
    if (!header) {
      header = rec;
      continue;
    }
    const row = Object.fromEntries(header.map((h, i) => [h, rec[i]]));
    const name = (row.description || "").trim();
    if (!row.fdc_id || !name) continue;
    foods.set(row.fdc_id, { name, nutrients: {} });
  }
  console.log(`food.csv: ${foods.size} foods`);

  // food_nutrient.csv: id, fdc_id, nutrient_id, amount, ... (amount per 100 g)
  header = null;
  let idx = null;
  for await (const rec of csvRecords(path.join(dir, "food_nutrient.csv"))) {
    if (!header) {
      header = rec;
      idx = {
        fdc_id: header.indexOf("fdc_id"),
        nutrient_id: header.indexOf("nutrient_id"),
        amount: header.indexOf("amount"),
      };
      continue;
    }
    const key = NUTRIENT_IDS[rec[idx.nutrient_id]];
    if (!key) continue;
    const food = foods.get(rec[idx.fdc_id]);
    if (!food) continue;
    const amount = Number(rec[idx.amount]);
    if (Number.isFinite(amount)) food.nutrients[key] = amount;
  }
  return foods;
}

async function seed() {
  const dir = argValue("--dir");
  if (!dir || !fs.existsSync(path.join(dir, "food.csv"))) {
    console.error(
      "Usage: node scripts/seed_foods_usda.mjs --dir <folder containing food.csv + food_nutrient.csv>\n" +
        "Download + unzip a CSV dataset from https://fdc.nal.usda.gov/download-datasets first."
    );
    process.exit(1);
  }

  const foods = await loadFoods(dir);
  const pool = await getPool();
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS foods_source_external ON foods (source, external_id)`
  );

  let count = 0;
  let skipped = 0;
  const batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const values = [];
    const params = [];
    batch.forEach((f, i) => {
      const o = i * 9;
      values.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9})`);
      params.push(f.name, f.name.toLowerCase(), "USDA", f.fdcId, f.calories, f.protein, f.carbs, f.fat, f.fiber);
    });
    await pool.query(
      `INSERT INTO foods (canonical_name, search_name, source, external_id,
                          calories_kcal, protein_g, carbs_g, fat_g, fiber_g)
       VALUES ${values.join(",")}
       ON CONFLICT (source, external_id) DO UPDATE SET
         canonical_name = EXCLUDED.canonical_name, search_name = EXCLUDED.search_name,
         calories_kcal = EXCLUDED.calories_kcal, protein_g = EXCLUDED.protein_g,
         carbs_g = EXCLUDED.carbs_g, fat_g = EXCLUDED.fat_g,
         fiber_g = EXCLUDED.fiber_g, updated_at = now()`,
      params
    );
    count += batch.length;
    batch.length = 0;
  };

  for (const [fdcId, food] of foods) {
    const n = food.nutrients;
    if (!n.calories && !n.protein) {
      skipped++;
      continue; // no usable macro data
    }
    batch.push({
      fdcId,
      name: food.name,
      calories: n.calories ?? 0,
      protein: n.protein ?? 0,
      carbs: n.carbs ?? 0,
      fat: n.fat ?? 0,
      fiber: n.fiber ?? 0,
    });
    if (batch.length >= 500) await flush();
  }
  await flush();

  console.log(`Seeded ${count} foods (${skipped} skipped for missing macros).`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
