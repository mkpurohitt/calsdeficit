-- Reference exercise catalog (1,300+ records). Seed with
-- scripts/seed_exercises_cloudsql.mjs after creating the instance.
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
