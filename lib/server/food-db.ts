import "server-only";
import { isCloudSqlConfigured, sql } from "./cloudsql";

export interface FoodMacros {
  foodName: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface FoodVerification {
  verified: boolean;
  match: FoodMacros | null;
  source: "cloudsql" | "off" | "none";
  sourceLabel: string;
}

// Must stay >= pg_trgm's default similarity_threshold (0.3) so the `%`
// operator below safely uses the GIN index as an index-accelerated pre-filter.
const TRIGRAM_THRESHOLD = 0.45;

async function lookupCloudSql(searchName: string): Promise<FoodMacros | null> {
  if (!isCloudSqlConfigured()) return null;
  try {
    const rows = await sql<{
      canonical_name: string;
      calories_kcal: string;
      protein_g: string;
      carbs_g: string;
      fat_g: string;
      fiber_g: string;
    }>(
      // `search_name % $1` is index-accelerated by the GIN trigram index
      // (uses pg_trgm's 0.3 threshold); the similarity() filter then enforces
      // our stricter 0.45 cutoff on the small candidate set. Without `%` this
      // would seq-scan the multi-million-row table on every lookup.
      `SELECT canonical_name, calories_kcal, protein_g, carbs_g, fat_g, fiber_g
       FROM foods
       WHERE search_name % $1
         AND similarity(search_name, $1) >= $2
       ORDER BY similarity(search_name, $1) DESC
       LIMIT 1`,
      [searchName, TRIGRAM_THRESHOLD]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      foodName: row.canonical_name,
      calories: Math.round(Number(row.calories_kcal) || 0),
      protein_g: Math.round(Number(row.protein_g) || 0),
      carbs_g: Math.round(Number(row.carbs_g) || 0),
      fat_g: Math.round(Number(row.fat_g) || 0),
      fiber_g: Math.round(Number(row.fiber_g) || 0),
    };
  } catch (error) {
    console.error("[food-db] Cloud SQL lookup failed:", error);
    return null;
  }
}

async function fetchOpenFoodFacts(query: string): Promise<FoodMacros | null> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const product = data?.products?.[0];
    if (!product?.nutriments) return null;
    const n = product.nutriments;
    const calories = Math.round(n["energy-kcal_100g"] || n["energy-kcal"] || 0);
    const protein = Math.round(n.proteins_100g || n.proteins || 0);
    if (calories === 0 && protein === 0) return null;
    return {
      foodName: product.product_name || query,
      calories,
      protein_g: protein,
      carbs_g: Math.round(n.carbohydrates_100g || n.carbohydrates || 0),
      fat_g: Math.round(n.fat_100g || n.fat || 0),
      fiber_g: Math.round(n.fiber_100g || n.fiber || 0),
    };
  } catch {
    return null;
  }
}

async function readCache(searchKey: string): Promise<{ macros: FoodMacros; source: string } | null> {
  if (!isCloudSqlConfigured()) return null;
  try {
    const rows = await sql<{ payload: FoodMacros; source: string }>(
      `SELECT payload, source FROM nutrition_cache WHERE search_key = $1`,
      [searchKey]
    );
    return rows[0] ? { macros: rows[0].payload, source: rows[0].source } : null;
  } catch {
    return null;
  }
}

async function writeCache(searchKey: string, macros: FoodMacros, source: string) {
  if (!isCloudSqlConfigured()) return;
  try {
    await sql(
      `INSERT INTO nutrition_cache (search_key, payload, source, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (search_key) DO UPDATE SET payload = $2, source = $3, updated_at = now()`,
      [searchKey, JSON.stringify(macros), source]
    );
  } catch (error) {
    console.error("[food-db] cache write failed:", error);
  }
}

/**
 * Blueprint verification rule: a trigram match against the Calolean food
 * database (Cloud SQL, seeded from USDA FoodData Central) — or an Open Food
 * Facts hit as a last resort — counts as a verified match whose macros
 * override AI estimates.
 */
export async function verifyFood(searchName: string): Promise<FoodVerification> {
  const key = searchName.toLowerCase().trim();

  const cached = await readCache(key);
  if (cached) {
    const verified = cached.source !== "gemini";
    // legacy "usda" cache rows fold into the Calolean database source
    const source: FoodVerification["source"] = !verified ? "none" : cached.source === "off" ? "off" : "cloudsql";
    return {
      verified,
      match: cached.macros,
      source,
      sourceLabel: verified ? labelFor(cached.source) : "Gemini Estimation",
    };
  }

  const dbMatch = await lookupCloudSql(key);
  if (dbMatch) {
    await writeCache(key, dbMatch, "cloudsql");
    return { verified: true, match: dbMatch, source: "cloudsql", sourceLabel: "Calolean Database" };
  }

  const off = await fetchOpenFoodFacts(key);
  if (off) {
    await writeCache(key, off, "off");
    return { verified: true, match: off, source: "off", sourceLabel: "Open Food Facts" };
  }

  return { verified: false, match: null, source: "none", sourceLabel: "Gemini Estimation" };
}

function labelFor(source: string): string {
  if (source === "cloudsql") return "Calolean Database";
  // legacy cache rows written before the live-USDA fallback was removed
  if (source === "usda") return "Calolean Database";
  if (source === "off") return "Open Food Facts";
  return "Gemini Estimation";
}
