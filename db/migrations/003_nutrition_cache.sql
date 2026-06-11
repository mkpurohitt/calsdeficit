-- Cache of resolved nutrition lookups (Cloud SQL match, USDA, OFF).
CREATE TABLE IF NOT EXISTS nutrition_cache (
  search_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  source TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
