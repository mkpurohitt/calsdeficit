-- Reference exercise catalog (from free-exercise-db). Prepare exercises.csv
-- with scripts/dataprep/exercises_to_csv.py, then load via db/load/staging.sql
-- + db/load/transform.sql.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT,
  body_part TEXT,
  equipment TEXT,
  gif_url TEXT,
  secondary_muscles TEXT[] DEFAULT '{}',
  instructions JSONB DEFAULT '[]',
  form_reference JSONB
);

CREATE INDEX IF NOT EXISTS exercises_name_trgm ON exercises USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS exercises_muscle ON exercises (muscle_group);
