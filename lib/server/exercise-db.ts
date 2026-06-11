import "server-only";
import { isCloudSqlConfigured, sql } from "./cloudsql";

export interface ExerciseRecord {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
  gif_url: string | null;
  body_part: string | null;
  secondary_muscles: string[];
  instructions: string[];
  form_reference?: Record<string, unknown> | null;
}

// Open dataset used as a zero-infra fallback until Cloud SQL is seeded
// (scripts/seed_exercises_cloudsql.mjs bakes the same data into Postgres).
const DATASET_URL = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";
const DATASET_RAW_BASE = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/";

interface RawExercise {
  bodyPart?: string;
  equipment?: string;
  gifUrl?: string;
  id?: string;
  instructions?: string[];
  name: string;
  secondaryMuscles?: string[];
  target?: string;
}

let datasetPromise: Promise<ExerciseRecord[]> | null = null;

function gifUrl(path?: string): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${DATASET_RAW_BASE}${path.replace(/^\.\//, "")}`;
}

async function loadDataset(): Promise<ExerciseRecord[]> {
  if (!datasetPromise) {
    datasetPromise = fetch(DATASET_URL, { next: { revalidate: 86400 } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Exercise dataset HTTP ${res.status}`);
        const raw = (await res.json()) as RawExercise[];
        return raw.map((entry, index) => ({
          id: entry.id || String(index),
          name: entry.name,
          muscle_group: entry.target || entry.bodyPart || "full body",
          equipment: entry.equipment || null,
          gif_url: gifUrl(entry.gifUrl),
          body_part: entry.bodyPart || null,
          secondary_muscles: entry.secondaryMuscles || [],
          instructions: entry.instructions || [],
        }));
      })
      .catch((error) => {
        datasetPromise = null;
        throw error;
      });
  }
  return datasetPromise;
}

export interface ExerciseQuery {
  id?: string;
  query?: string;
  muscles?: string[];
  limit?: number;
}

export async function findExercises({ id, query, muscles, limit = 10 }: ExerciseQuery): Promise<ExerciseRecord[]> {
  if (isCloudSqlConfigured()) {
    try {
      if (id) {
        return await sql<ExerciseRecord>(
          `SELECT id, name, muscle_group, equipment, gif_url, body_part, secondary_muscles, instructions, form_reference
           FROM exercises WHERE id = $1 LIMIT 1`,
          [id]
        );
      }
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (query) {
        params.push(`%${query}%`);
        conditions.push(`name ILIKE $${params.length}`);
      }
      if (muscles && muscles.length > 0) {
        params.push(muscles.map((m) => `%${m}%`));
        conditions.push(`muscle_group ILIKE ANY($${params.length})`);
      }
      params.push(limit);
      return await sql<ExerciseRecord>(
        `SELECT id, name, muscle_group, equipment, gif_url, body_part, secondary_muscles, instructions
         FROM exercises ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
         ORDER BY name LIMIT $${params.length}`,
        params
      );
    } catch (error) {
      console.error("[exercise-db] Cloud SQL query failed, falling back to dataset:", error);
    }
  }

  const dataset = await loadDataset();
  if (id) {
    const match = dataset.find((entry) => entry.id === id);
    return match ? [match] : [];
  }
  let results = dataset;
  if (muscles && muscles.length > 0) {
    const lowered = muscles.map((m) => m.toLowerCase());
    results = results.filter((entry) =>
      lowered.some((m) => entry.muscle_group.toLowerCase().includes(m) || (entry.body_part || "").toLowerCase().includes(m))
    );
  }
  if (query) {
    const q = query.toLowerCase();
    results = results.filter((entry) => entry.name.toLowerCase().includes(q));
  }
  return results.slice(0, limit);
}

/** Reference form cues for AI form scoring (Cloud SQL `form_reference`, else generic). */
export async function getFormReference(exerciseName: string): Promise<Record<string, unknown> | null> {
  if (!isCloudSqlConfigured()) return null;
  try {
    const rows = await sql<{ form_reference: Record<string, unknown> | null }>(
      `SELECT form_reference FROM exercises
       WHERE form_reference IS NOT NULL AND name ILIKE $1
       LIMIT 1`,
      [`%${exerciseName}%`]
    );
    return rows[0]?.form_reference || null;
  } catch (error) {
    console.error("[exercise-db] form_reference lookup failed:", error);
    return null;
  }
}
