-- ============================================================================
-- Calolean — append NEW food + exercise sources and de-duplicate.
--
-- Adds IFCT/NORWAY/CNF foods and wger/RepDB/Everkinetic exercises WITHOUT
-- wiping the existing USDA/OFF/free-exercise-db data (unlike transform.sql,
-- which does a full rebuild), then removes duplicates across ALL sources.
--
-- Prereqs (run in this order):
--   1. db/load/staging.sql                 -> creates stg_foods
--   2. db/migrations/005_exercise_enrichment.sql
--        -> adds exercises.difficulty + met_value, creates stg_exercises_ext
--   3. load the two prepared CSVs into staging:
--        \copy stg_foods          FROM 'foods_new.csv'     WITH (FORMAT csv, HEADER true)
--        \copy stg_exercises_ext  FROM 'exercises_new.csv' WITH (FORMAT csv, HEADER true)
--   4. \i append_and_dedup.sql
--
-- Idempotent-ish: appends are guarded so a source isn't added twice.
-- ============================================================================

\set ON_ERROR_STOP on
SET maintenance_work_mem = '512MB';

\echo '=== FOODS: before ==='
SELECT source, count(*) FROM foods GROUP BY source ORDER BY source;

BEGIN;

-- 1) APPEND new-source foods (skip a source that's already present) ----------
INSERT INTO foods (canonical_name, search_name, source, external_id, brand,
                   barcode, serving_desc, calories_kcal, protein_g, carbs_g, fat_g, fiber_g)
SELECT
  canonical_name, lower(canonical_name), upper(source),
  nullif(external_id,''), nullif(brand,''), nullif(barcode,''), nullif(serving_desc,''),
  nullif(calories_kcal,'')::numeric, nullif(protein_g,'')::numeric,
  nullif(carbs_g,'')::numeric, nullif(fat_g,'')::numeric, nullif(fiber_g,'')::numeric
FROM stg_foods s
WHERE canonical_name IS NOT NULL AND canonical_name <> ''
  AND upper(source) IN ('IFCT','NORWAY','CNF')
  AND NOT EXISTS (SELECT 1 FROM foods f WHERE f.source = upper(s.source));

-- 2) DE-DUPLICATE foods across ALL sources ----------------------------------
--    Keep most-complete macros; tie-break by source quality (India first),
--    then lowest id. Then drop macro-less / junk rows.
DELETE FROM foods f USING (
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY search_name
      ORDER BY
        ( (calories_kcal IS NOT NULL)::int + (protein_g IS NOT NULL)::int
        + (carbs_g IS NOT NULL)::int + (fat_g IS NOT NULL)::int
        + (fiber_g IS NOT NULL)::int ) DESC,
        CASE upper(source)
          WHEN 'IFCT' THEN 1 WHEN 'USDA' THEN 2 WHEN 'CNF' THEN 3
          WHEN 'NORWAY' THEN 4 WHEN 'OFF' THEN 5 WHEN 'KAGGLE' THEN 6 ELSE 9 END ASC,
        id ASC
    ) AS rn FROM foods
  ) r WHERE rn > 1
) d WHERE f.id = d.id;

DELETE FROM foods
WHERE COALESCE(calories_kcal,0)=0 AND COALESCE(protein_g,0)=0
  AND COALESCE(carbs_g,0)=0 AND COALESCE(fat_g,0)=0;
DELETE FROM foods WHERE length(btrim(canonical_name)) < 2;

COMMIT;
ANALYZE foods;

\echo '=== FOODS: after append + dedup ==='
SELECT source, count(*) FROM foods GROUP BY source ORDER BY source;
SELECT count(*) AS total_foods FROM foods;

-- ===========================================================================
-- EXERCISES
-- ===========================================================================
\echo '=== EXERCISES: before ==='
SELECT count(*) AS total_exercises FROM exercises;

BEGIN;

-- 3) APPEND new exercises (ids are source-prefixed, so PK collisions can't
--    happen with existing free-exercise-db rows). Skip ids already present.
INSERT INTO exercises (id, name, muscle_group, body_part, equipment, gif_url,
                       secondary_muscles, instructions, difficulty, met_value)
SELECT
  id, name, nullif(muscle_group,''), nullif(body_part,''), nullif(equipment,''),
  nullif(gif_url,''),
  CASE WHEN secondary_muscles ~ '^\s*\['
       THEN ARRAY(SELECT jsonb_array_elements_text(secondary_muscles::jsonb))
       ELSE '{}'::text[] END,
  CASE WHEN instructions ~ '^\s*\[' THEN instructions::jsonb ELSE '[]'::jsonb END,
  nullif(difficulty,''),
  nullif(met_value,'')::numeric
FROM stg_exercises_ext s
WHERE id IS NOT NULL AND id <> '' AND id <> 'id' AND name IS NOT NULL AND name <> ''
ON CONFLICT (id) DO NOTHING;

-- 4) BACKFILL difficulty + MET onto same-named exercises that lack them, using
--    the RepDB rows (they carry both). This way even if dedup later keeps an
--    animated free-exercise-db row, it inherits difficulty/MET.
UPDATE exercises e
SET difficulty = COALESCE(e.difficulty, src.difficulty),
    met_value  = COALESCE(e.met_value,  src.met_value)
FROM (
  SELECT DISTINCT ON (lower(btrim(name))) lower(btrim(name)) AS k, difficulty, met_value
  FROM exercises
  WHERE (difficulty IS NOT NULL OR met_value IS NOT NULL)
  ORDER BY lower(btrim(name)), (met_value IS NOT NULL) DESC
) src
WHERE lower(btrim(e.name)) = src.k
  AND (e.difficulty IS NULL OR e.met_value IS NULL);

-- 5) DE-DUPLICATE exercises by name. Keep the richest row:
--    has a real gif FIRST (animation matters for the UI), then most
--    instructions, then most secondary muscles, then id.
DELETE FROM exercises e USING (
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY lower(btrim(name))
      ORDER BY
        (gif_url IS NOT NULL AND gif_url <> '') DESC,
        COALESCE(jsonb_array_length(instructions),0) DESC,
        COALESCE(array_length(secondary_muscles,1),0) DESC,
        id ASC
    ) AS rn FROM exercises
  ) r WHERE rn > 1
) d WHERE e.id = d.id;

COMMIT;
ANALYZE exercises;

\echo '=== EXERCISES: after append + dedup ==='
SELECT count(*) AS total_exercises,
       count(*) FILTER (WHERE gif_url IS NOT NULL)   AS with_media,
       count(*) FILTER (WHERE difficulty IS NOT NULL) AS with_difficulty,
       count(*) FILTER (WHERE met_value IS NOT NULL)  AS with_met
FROM exercises;

-- Free staging space.
TRUNCATE stg_foods, stg_exercises_ext;
\echo 'Done. Re-run db/migrations/004_form_reference.sql (it matches by name).'
