-- Transform staged CSV rows into the real foods/exercises tables.
-- Run AFTER staging.sql + loading data into the stg_* tables. This does a
-- full rebuild (TRUNCATE + INSERT), so re-run it any time you refresh the
-- source data. Header rows and malformed numbers are filtered/cast safely.
--
-- After this, run db/migrations/004_form_reference.sql to (re)apply the
-- form-check reference angles (it matches exercises by name).

\set ON_ERROR_STOP on

-- More memory for the trigram index rebuild below = much faster on millions of
-- rows. Lower this if your instance has < 8 GB RAM (e.g. '256MB').
SET maintenance_work_mem = '1GB';

BEGIN;

-- Drop the heavy foods indexes so the multi-million-row INSERT is fast; they're
-- rebuilt in bulk after the load (far cheaper than maintaining them per row).
DROP INDEX IF EXISTS foods_search_trgm;
DROP INDEX IF EXISTS foods_barcode;

-- ---- FOODS -----------------------------------------------------------------
TRUNCATE foods;
INSERT INTO foods (canonical_name, search_name, source, external_id, brand,
                   barcode, serving_desc, calories_kcal, protein_g, carbs_g, fat_g, fiber_g)
SELECT
  canonical_name,
  lower(canonical_name),
  upper(source),
  nullif(external_id, ''),
  nullif(brand, ''),
  nullif(barcode, ''),
  nullif(serving_desc, ''),
  nullif(calories_kcal, '')::numeric,
  nullif(protein_g, '')::numeric,
  nullif(carbs_g, '')::numeric,
  nullif(fat_g, '')::numeric,
  nullif(fiber_g, '')::numeric
FROM (
  SELECT * FROM stg_foods
  WHERE canonical_name IS NOT NULL AND canonical_name <> ''
    AND upper(source) IN ('USDA', 'OFF', 'KAGGLE')   -- also drops the header row
) s;

-- ---- EXERCISES -------------------------------------------------------------
TRUNCATE exercises;
INSERT INTO exercises (id, name, muscle_group, body_part, equipment, gif_url,
                       secondary_muscles, instructions)
SELECT
  id,
  name,
  nullif(muscle_group, ''),
  nullif(body_part, ''),
  nullif(equipment, ''),
  nullif(gif_url, ''),
  CASE WHEN secondary_muscles ~ '^\s*\['
       THEN ARRAY(SELECT jsonb_array_elements_text(secondary_muscles::jsonb))
       ELSE '{}'::text[] END,
  CASE WHEN instructions ~ '^\s*\['
       THEN instructions::jsonb
       ELSE '[]'::jsonb END
FROM (
  SELECT * FROM stg_exercises
  WHERE id IS NOT NULL AND id <> '' AND id <> 'id'   -- drops the header row
    AND name IS NOT NULL AND name <> ''
) s;

COMMIT;

-- Rebuild the foods indexes in bulk now that the data is loaded.
CREATE INDEX foods_search_trgm ON foods USING gin (search_name gin_trgm_ops);
CREATE INDEX foods_barcode ON foods (barcode);

ANALYZE foods;
ANALYZE exercises;

-- Free the staging space
TRUNCATE stg_foods, stg_exercises;

\echo 'Loaded row counts:'
SELECT 'foods' AS tbl, source, count(*) FROM foods GROUP BY source
UNION ALL
SELECT 'exercises', NULL, count(*) FROM exercises;
