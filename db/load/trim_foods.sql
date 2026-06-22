-- One-time cleanup to shrink the foods table so it runs cheaply on a small
-- Cloud SQL tier (db-f1-micro). Removes:
--   1. rows with no usable nutrition at all,
--   2. non-English names (anything outside printable ASCII),
--   3. junk / too-short names,
--   4. duplicates (same lowercased name) — keeping the single most complete
--      row, preferring USDA.
--
-- Run this on the CURRENT (8 GB) instance BEFORE downgrading the tier, then
-- run VACUUM FULL (see db/load/README or NEXT_STEPS) to reclaim the disk.
-- It does NOT touch exercises.

\set ON_ERROR_STOP on
SET maintenance_work_mem = '512MB';

\echo 'Before cleanup:'
SELECT count(*) AS total_foods FROM foods;

-- 1) No usable macros at all.
DELETE FROM foods
WHERE COALESCE(calories_kcal, 0) = 0
  AND COALESCE(protein_g,  0) = 0
  AND COALESCE(carbs_g,    0) = 0
  AND COALESCE(fat_g,      0) = 0;

-- 2) Non-English: drop names containing any character outside printable ASCII
--    (space 0x20 .. tilde 0x7E). Removes Cyrillic/Arabic/CJK/etc. product names.
DELETE FROM foods
WHERE canonical_name !~ '^[ -~]+$';

-- 3) Junk / too-short names.
DELETE FROM foods
WHERE length(btrim(canonical_name)) < 2;

-- 4) De-duplicate by lowercased name. Keep the one row per search_name with the
--    most non-null macros; ties prefer USDA, then the lowest id.
DELETE FROM foods f
USING (
  SELECT id FROM (
    SELECT id,
      row_number() OVER (
        PARTITION BY search_name
        ORDER BY
          ( (calories_kcal IS NOT NULL)::int
          + (protein_g    IS NOT NULL)::int
          + (carbs_g      IS NOT NULL)::int
          + (fat_g        IS NOT NULL)::int
          + (fiber_g      IS NOT NULL)::int ) DESC,
          (source = 'USDA') DESC,
          id ASC
      ) AS rn
    FROM foods
  ) ranked
  WHERE rn > 1
) dupes
WHERE f.id = dupes.id;

ANALYZE foods;

\echo 'After cleanup, remaining foods by source:'
SELECT source, count(*) FROM foods GROUP BY source ORDER BY source;
SELECT count(*) AS total_foods FROM foods;

\echo 'Next: run  VACUUM FULL foods;  to reclaim disk, then downgrade the tier.'
