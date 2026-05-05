const GITHUB_JSON_URL = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/";

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

export interface EnrichedExercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment?: string | null;
  gif_url?: string | null;
  body_part?: string | null;
  secondary_muscles?: string[];
  instructions?: string[];
}

let datasetPromise: Promise<RawExercise[]> | null = null;

function coerceInstructions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (value && typeof value === "object") {
    const english = (value as { en?: unknown }).en;
    if (Array.isArray(english)) {
      return english.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
    if (typeof english === "string" && english.trim().length > 0) {
      return english
        .split(/\.\s+/)
        .map((step) => step.trim())
        .filter(Boolean)
        .map((step) => (step.endsWith(".") ? step : `${step}.`));
    }
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(/\.\s+/)
      .map((step) => step.trim())
      .filter(Boolean)
      .map((step) => (step.endsWith(".") ? step : `${step}.`));
  }

  return [];
}

function normalizeExerciseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildGifUrl(gifPath?: string) {
  if (!gifPath) return null;
  if (gifPath.startsWith("http://") || gifPath.startsWith("https://")) return gifPath;
  return `${GITHUB_RAW_BASE}${gifPath.replace(/^\.\//, "")}`;
}

async function loadDataset() {
  if (!datasetPromise) {
    datasetPromise = fetch(GITHUB_JSON_URL, { next: { revalidate: 86400 } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Exercise dataset HTTP ${response.status}`);
        return response.json() as Promise<RawExercise[]>;
      })
      .catch((error) => {
        datasetPromise = null;
        throw error;
      });
  }

  return datasetPromise;
}

export async function enrichExerciseRecord<T extends EnrichedExercise>(exercise: T): Promise<T> {
  const normalizedInstructions = coerceInstructions((exercise as T & { instructions?: unknown }).instructions);
  const normalizedExercise = {
    ...exercise,
    instructions: normalizedInstructions,
  };

  if (normalizedExercise.gif_url && normalizedExercise.instructions.length) return normalizedExercise as T;

  try {
    const dataset = await loadDataset();
    const match = dataset.find((entry) => normalizeExerciseName(entry.name) === normalizeExerciseName(exercise.name));
    if (!match) return normalizedExercise as T;

    return {
      ...normalizedExercise,
      gif_url: normalizedExercise.gif_url || buildGifUrl(match.gifUrl),
      body_part: normalizedExercise.body_part || match.bodyPart || null,
      equipment: normalizedExercise.equipment || match.equipment || null,
      muscle_group: normalizedExercise.muscle_group || match.target || match.bodyPart || "full body",
      secondary_muscles: normalizedExercise.secondary_muscles?.length ? normalizedExercise.secondary_muscles : (match.secondaryMuscles || []),
      instructions: normalizedExercise.instructions.length ? normalizedExercise.instructions : (match.instructions || []),
    };
  } catch (error) {
    console.error("[Exercise Catalog] Enrichment failed:", error);
    return normalizedExercise as T;
  }
}

export async function enrichExerciseList<T extends EnrichedExercise>(exercises: T[]) {
  return Promise.all(exercises.map((exercise) => enrichExerciseRecord(exercise)));
}
