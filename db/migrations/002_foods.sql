-- Food reference catalog — the Calolean food database. Bulk-loaded from the
-- USDA FoodData Central + Open Food Facts (+ optional Kaggle) data dumps:
-- prepare CSVs with scripts/dataprep/*.py, then db/load/staging.sql +
-- db/load/transform.sql. verifyFood() falls back to live Open Food Facts only.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS foods (
  id BIGSERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  search_name TEXT NOT NULL,
  source TEXT NOT NULL,            -- 'USDA' | 'OFF' | 'KAGGLE'
  external_id TEXT,
  brand TEXT,
  barcode TEXT,
  calories_kcal NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  serving_desc TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS foods_search_trgm ON foods USING gin (search_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS foods_barcode ON foods (barcode);
CREATE INDEX IF NOT EXISTS foods_source_external ON foods (source, external_id);
