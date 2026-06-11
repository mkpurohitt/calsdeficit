-- Food reference catalog. Bulk-seeded from USDA FoodData Central /
-- Open Food Facts dumps in a later phase; verifyFood() falls back to live
-- API lookups until then.
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
