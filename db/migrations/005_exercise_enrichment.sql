-- Exercise enrichment: add difficulty + MET so richer sources (RepDB, etc.)
-- can be stored. Also creates the enriched staging table used by the append
-- flow in db/load/append_and_dedup.sql (loaded from prepare_new_exercises.py).
--
-- Idempotent — safe to run more than once.

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS difficulty TEXT;      -- beginner|intermediate|advanced
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS met_value NUMERIC;    -- metabolic equivalent (calorie math)

-- Enriched staging table (10 cols) — matches prepare_new_exercises.py output.
-- UNLOGGED = fast bulk import; disposable.
CREATE UNLOGGED TABLE IF NOT EXISTS stg_exercises_ext (
  id                TEXT,
  name              TEXT,
  muscle_group      TEXT,
  body_part         TEXT,
  equipment         TEXT,
  gif_url           TEXT,
  secondary_muscles TEXT,   -- JSON array string
  instructions      TEXT,   -- JSON array string
  difficulty        TEXT,
  met_value         TEXT
);
