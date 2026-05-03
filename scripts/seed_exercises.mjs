import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto'; // <-- We added this to generate IDs!

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error("❌ CRITICAL ERROR: Your NEXT_PUBLIC_SUPABASE_URL in .env.local is missing or invalid.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const GITHUB_JSON_URL = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/";

async function seedDatabase() {
  console.log(`🔌 Connecting to Supabase at: ${supabaseUrl.substring(0, 20)}...`);
  console.log("⏳ Downloading 1,324 animated exercises from GitHub...");
  
  try {
    const response = await fetch(GITHUB_JSON_URL);
    const rawExercises = await response.json();

    const formattedExercises = rawExercises.map(ex => {
      let finalGifUrl = null;
      if (ex.gifUrl) {
         const cleanPath = ex.gifUrl.replace(/^\.\//, ''); 
         finalGifUrl = `${GITHUB_RAW_BASE}${cleanPath}`;
      }
      return {
        id: crypto.randomUUID(), // <-- This guarantees a unique ID for Supabase!
        name: ex.name,
        muscle_group: ex.target || ex.bodyPart || 'Full Body',
        equipment: ex.equipment || 'Bodyweight',
        gif_url: finalGifUrl
      };
    });

    console.log(`🚀 Formatted ${formattedExercises.length} exercises. Uploading to Supabase...`);

    const batchSize = 100;
    for (let i = 0; i < formattedExercises.length; i += batchSize) {
      const batch = formattedExercises.slice(i, i + batchSize);
      
      const { error } = await supabase.from('exercises').insert(batch);
      
      if (error) {
        console.error(`❌ Supabase rejected the upload at batch ${i}:`, error.message);
        console.error("Aborting the rest of the upload.");
        return; 
      } else {
        console.log(`✅ Successfully uploaded batch ${i} to ${i + batch.length}`);
      }
    }

    console.log("🎉 SUCCESS! Your Animated Muscle Library is fully populated!");

  } catch (err) {
    console.error("❌ Fatal network or fetch error:", err);
  }
}

seedDatabase();