-- Staging tables for bulk-loading the prepared CSVs (scripts/dataprep/*.py).
-- All columns are TEXT so a CSV header row (kept by `gcloud sql import csv`)
-- imports without type errors; db/load/transform.sql does the real casting
-- and filters the header out. Column ORDER must match the CSV headers exactly.
--
-- Run this BEFORE importing/copying data, then run transform.sql AFTER.

CREATE TABLE IF NOT EXISTS stg_foods (
  source        TEXT,
  external_id   TEXT,
  canonical_name TEXT,
  brand         TEXT,
  barcode       TEXT,
  serving_desc  TEXT,
  calories_kcal TEXT,
  protein_g     TEXT,
  carbs_g       TEXT,
  fat_g         TEXT,
  fiber_g       TEXT
);

CREATE TABLE IF NOT EXISTS stg_exercises (
  id                TEXT,
  name              TEXT,
  muscle_group      TEXT,
  body_part         TEXT,
  equipment         TEXT,
  gif_url           TEXT,
  secondary_muscles TEXT,   -- JSON array string
  instructions      TEXT    -- JSON array string
);

TRUNCATE stg_foods, stg_exercises;
