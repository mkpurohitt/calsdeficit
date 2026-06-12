-- Food reference catalog — the Calolean food database. Bulk-seeded from the
-- USDA FoodData Central CSV dump via scripts/seed_foods_usda.mjs (no live
-- USDA API at runtime); verifyFood() falls back to Open Food Facts only.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS foods (
  id BIGSERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  search_name TEXT NOT NULL,
  source TEXT NOT NULL,            -- 'USDA' | 'OFF'
  external_id TEXT,
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
CREATE UNIQUE INDEX IF NOT EXISTS foods_source_external ON foods (source, external_id);
