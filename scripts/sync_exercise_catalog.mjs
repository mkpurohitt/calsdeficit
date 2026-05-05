import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function toGifUrl(gifPath) {
  if (!gifPath) return null;
  if (gifPath.startsWith('http://') || gifPath.startsWith('https://')) return gifPath;
  return `${GITHUB_RAW_BASE}${gifPath.replace(/^\.\//, '')}`;
}

function normalizeInstructions(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
  }
  return [];
}

async function syncExerciseCatalog() {
  console.log('Downloading exercise catalog...');
  const response = await fetch(GITHUB_JSON_URL);
  if (!response.ok) {
    throw new Error(`Exercise dataset HTTP ${response.status}`);
  }

  const dataset = await response.json();
  const datasetByName = new Map(
    dataset.map((entry) => [
      normalizeName(entry.name),
      {
        gif_url: toGifUrl(entry.gifUrl),
        body_part: entry.bodyPart || null,
        equipment: entry.equipment || null,
        muscle_group: entry.target || entry.bodyPart || 'full body',
        secondary_muscles: Array.isArray(entry.secondaryMuscles) ? entry.secondaryMuscles : [],
        instructions: normalizeInstructions(entry.instructions),
      },
    ])
  );

  console.log('Loading existing exercises from Supabase...');
  let selectColumns = 'id, name, gif_url, body_part, equipment, muscle_group, secondary_muscles, instructions';
  let existingExercises;

  let fetchResult = await supabase
    .from('exercises')
    .select(selectColumns)
    .limit(5000);

  if (fetchResult.error?.message?.includes('body_part')) {
    selectColumns = 'id, name, gif_url, equipment, muscle_group';
    fetchResult = await supabase
      .from('exercises')
      .select(selectColumns)
      .limit(5000);
  }

  const { data, error: fetchError } = fetchResult;
  existingExercises = data;

  if (fetchError) {
    throw new Error(`Could not load exercises: ${fetchError.message}`);
  }

  let matched = 0;
  let updated = 0;
  let skipped = 0;

  for (const exercise of existingExercises || []) {
    const match = datasetByName.get(normalizeName(exercise.name));
    if (!match) {
      skipped += 1;
      continue;
    }

    matched += 1;

    const payload = {
      gif_url: exercise.gif_url || match.gif_url,
      equipment: exercise.equipment || match.equipment,
      muscle_group: exercise.muscle_group || match.muscle_group,
    };

    if ('body_part' in exercise) {
      payload.body_part = exercise.body_part || match.body_part;
    }

    if ('secondary_muscles' in exercise) {
      payload.secondary_muscles = Array.isArray(exercise.secondary_muscles) && exercise.secondary_muscles.length > 0
        ? exercise.secondary_muscles
        : match.secondary_muscles;
    }

    if ('instructions' in exercise) {
      payload.instructions = Array.isArray(exercise.instructions) && exercise.instructions.length > 0
        ? exercise.instructions
        : match.instructions;
    }

    const changed =
      payload.gif_url !== exercise.gif_url ||
      payload.equipment !== exercise.equipment ||
      payload.muscle_group !== exercise.muscle_group ||
      (!('body_part' in payload) || payload.body_part !== exercise.body_part) ||
      (!('secondary_muscles' in payload) || JSON.stringify(payload.secondary_muscles || []) !== JSON.stringify(exercise.secondary_muscles || [])) ||
      (!('instructions' in payload) || JSON.stringify(payload.instructions || []) !== JSON.stringify(exercise.instructions || []));

    if (!changed) {
      continue;
    }

    const { error: updateError } = await supabase
      .from('exercises')
      .update(payload)
      .eq('id', exercise.id);

    if (updateError) {
      console.error(`Failed to update "${exercise.name}": ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(`Matched ${matched} exercises`);
  console.log(`Updated ${updated} exercises`);
  console.log(`Skipped ${skipped} unmatched exercises`);
}

syncExerciseCatalog().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
