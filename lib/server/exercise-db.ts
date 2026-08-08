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
  /** beginner | intermediate | advanced (sources that provide it, e.g. RepDB). */
  difficulty?: string | null;
  /** Metabolic equivalent — drives calories-burned math. */
  met_value?: number | null;
}

/**
 * Some catalogue sources publish media over plain http, which browsers block as
 * mixed content on our https origin. Upgrading the scheme is safe for every
 * host we ingest and avoids a full re-import to fix stored rows.
 */
function secureMedia(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http://") ? `https://${url.slice(7)}` : url;
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

interface SupplementIndex {
  /** Exact id match — the original catalogue rows share ids with this dataset. */
  byId: Map<string, SupplementEntry>;
  /** Normalized-name match — the only way newer sources (repdb-/wger-/ek- ids)
   * can inherit the animated frames, since their ids are unrelated. */
  byName: Map<string, SupplementEntry>;
}

/** Loose key so "Barbell Bench Press" and "barbell-bench-press" agree. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

let supplementPromise: Promise<SupplementIndex> | null = null;

async function loadSupplement(): Promise<SupplementIndex> {
  if (!supplementPromise) {
    supplementPromise = fetch(SUPPLEMENT_URL, { next: { revalidate: 86400 } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Supplement dataset HTTP ${res.status}`);
        const raw = (await res.json()) as {
          id?: string;
          name?: string;
          images?: string[];
          secondaryMuscles?: string[];
          instructions?: string[];
        }[];
        const byId = new Map<string, SupplementEntry>();
        const byName = new Map<string, SupplementEntry>();
        for (const entry of raw) {
          const frames = (entry.images || []).map((img) => SUPPLEMENT_IMG_BASE + img);
          const record: SupplementEntry = {
            gif_url: frames[0] || null,
            frames,
            secondary_muscles: entry.secondaryMuscles || [],
            instructions: entry.instructions || [],
          };
          if (entry.id) byId.set(entry.id, record);
          const key = entry.name ? nameKey(entry.name) : "";
          // First writer wins; the dataset is already deduped by name.
          if (key && frames.length > 0 && !byName.has(key)) byName.set(key, record);
        }
        return { byId, byName };
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
  let supplement: SupplementIndex | null = null;
  try {
    supplement = await loadSupplement();
  } catch (error) {
    console.error("[exercise-db] supplement enrichment failed:", error);
  }
  return records.map((r) => {
    // Prefer the id match (original catalogue rows). Rows from the newer
    // sources (repdb-/wger-/ek- ids) can't match by id, so fall back to the
    // name: it restores the two-frame animation for moves the supplement
    // covers, and gives the ~500 wger rows that ship with no media at all
    // something to show.
    const extra = supplement?.byId.get(r.id) ?? supplement?.byName.get(nameKey(r.name));
    // The row's own media wins when it has some — only borrow frames when the
    // supplement genuinely has more than the single image we already hold.
    const ownGif = secureMedia(r.gif_url);
    const supFrames = (extra?.frames ?? []).map(secureMedia).filter((u): u is string => Boolean(u));
    const useSupplementMedia = supFrames.length > (ownGif ? 1 : 0);
    const frames = useSupplementMedia ? supFrames : ownGif ? [ownGif] : [];
    return {
      ...r,
      gif_url: frames[0] ?? null,
      frames,
      met_value: r.met_value != null ? Number(r.met_value) : null,
      instructions: r.instructions?.length ? r.instructions : extra?.instructions ?? [],
      secondary_muscles: r.secondary_muscles?.length ? r.secondary_muscles : extra?.secondary_muscles ?? [],
    };
  });
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
          `SELECT id, name, muscle_group, equipment, gif_url, body_part, secondary_muscles, instructions, form_reference, difficulty, met_value
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
        // Media-first: ~500 catalogue rows (mostly wger) ship without any
        // image, and a grid of placeholders reads as broken. They stay
        // searchable, they just don't lead the list.
        `SELECT id, name, muscle_group, equipment, gif_url, body_part, secondary_muscles, instructions, difficulty, met_value
         FROM exercises ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
         ORDER BY (gif_url IS NOT NULL AND gif_url <> '') DESC, name
         LIMIT $${params.length}`,
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
