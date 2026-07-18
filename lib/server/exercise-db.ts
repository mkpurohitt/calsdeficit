import "server-only";
import { isCloudSqlConfigured, sql } from "./cloudsql";

export interface ExerciseRecord {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
  gif_url: string | null;
  /** All animation frames (start/end positions) — cycled client-side to
   * simulate the exercise motion, since the source has stills, not GIFs. */
  frames?: string[];
  body_part: string | null;
  secondary_muscles: string[];
  instructions: string[];
  form_reference?: Record<string, unknown> | null;
}

// Open dataset used as a zero-infra fallback until Cloud SQL is loaded
// (scripts/dataprep/exercises_to_csv.py + db/load/* bake the catalog into Postgres).
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

// Supplement source: the same free-exercise-db dataset the Cloud SQL catalog
// was built from (identical ids). Used to fill in gif_url/instructions when a
// DB row is missing them (e.g. an incomplete bulk load) so the library always
// shows real images + steps without needing a database reload.
const SUPPLEMENT_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const SUPPLEMENT_IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

interface SupplementEntry {
  gif_url: string | null;
  frames: string[];
  secondary_muscles: string[];
  instructions: string[];
}

let supplementPromise: Promise<Map<string, SupplementEntry>> | null = null;

async function loadSupplement(): Promise<Map<string, SupplementEntry>> {
  if (!supplementPromise) {
    supplementPromise = fetch(SUPPLEMENT_URL, { next: { revalidate: 86400 } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Supplement dataset HTTP ${res.status}`);
        const raw = (await res.json()) as {
          id?: string;
          images?: string[];
          secondaryMuscles?: string[];
          instructions?: string[];
        }[];
        const map = new Map<string, SupplementEntry>();
        for (const entry of raw) {
          if (!entry.id) continue;
          const frames = (entry.images || []).map((img) => SUPPLEMENT_IMG_BASE + img);
          map.set(entry.id, {
            gif_url: frames[0] || null,
            frames,
            secondary_muscles: entry.secondaryMuscles || [],
            instructions: entry.instructions || [],
          });
        }
        return map;
      })
      .catch((error) => {
        supplementPromise = null;
        throw error;
      });
  }
  return supplementPromise;
}

/**
 * Merges gif_url/instructions/secondary_muscles from the source dataset.
 * The supplement is the source of truth for media + instructions (the bulk
 * load stored these unreliably), the DB stays canonical for names/muscles.
 */
async function enrich(records: ExerciseRecord[]): Promise<ExerciseRecord[]> {
  if (records.length === 0) return records;
  try {
    const supplement = await loadSupplement();
    return records.map((r) => {
      const extra = supplement.get(r.id);
      if (!extra) return r;
      return {
        ...r,
        gif_url: extra.gif_url || r.gif_url,
        frames: extra.frames.length > 0 ? extra.frames : r.gif_url ? [r.gif_url] : [],
        instructions: extra.instructions.length > 0 ? extra.instructions : r.instructions,
        secondary_muscles:
          extra.secondary_muscles.length > 0 ? extra.secondary_muscles : r.secondary_muscles,
      };
    });
  } catch (error) {
    console.error("[exercise-db] supplement enrichment failed:", error);
    return records;
  }
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
        const rows = await sql<ExerciseRecord>(
          `SELECT id, name, muscle_group, equipment, gif_url, body_part, secondary_muscles, instructions, form_reference
           FROM exercises WHERE id = $1 LIMIT 1`,
          [id]
        );
        return await enrich(rows);
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
      const rows = await sql<ExerciseRecord>(
        `SELECT id, name, muscle_group, equipment, gif_url, body_part, secondary_muscles, instructions
         FROM exercises ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
         ORDER BY name LIMIT $${params.length}`,
        params
      );
      return await enrich(rows);
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

export interface MuscleGroupCount {
  muscle_group: string;
  count: number;
}

/** Real per-muscle-group counts + total for the Muscle Library UI. */
export async function countExercises(): Promise<{ total: number; groups: MuscleGroupCount[] }> {
  if (isCloudSqlConfigured()) {
    try {
      const rows = await sql<{ muscle_group: string | null; count: string }>(
        `SELECT muscle_group, count(*)::text AS count
         FROM exercises
         GROUP BY muscle_group
         ORDER BY count(*) DESC`
      );
      const groups = rows
        .filter((r) => r.muscle_group)
        .map((r) => ({ muscle_group: r.muscle_group as string, count: Number(r.count) }));
      const total = rows.reduce((a, r) => a + Number(r.count), 0);
      return { total, groups };
    } catch (error) {
      console.error("[exercise-db] count query failed, falling back to dataset:", error);
    }
  }
  const dataset = await loadDataset();
  const map = new Map<string, number>();
  for (const entry of dataset) {
    map.set(entry.muscle_group, (map.get(entry.muscle_group) || 0) + 1);
  }
  const groups = [...map.entries()]
    .map(([muscle_group, count]) => ({ muscle_group, count }))
    .sort((a, b) => b.count - a.count);
  return { total: dataset.length, groups };
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
