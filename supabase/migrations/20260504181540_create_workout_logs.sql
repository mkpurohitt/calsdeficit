create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table if not exists public.users (
  id text primary key,
  email text,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  age integer,
  weight_kg numeric,
  height_cm numeric,
  goal text,
  daily_calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  food_name text not null,
  portion text not null default '1 serving',
  calories integer not null default 0,
  protein_g integer not null default 0,
  carbs_g integer not null default 0,
  fat_g integer not null default 0,
  fiber_g integer not null default 0,
  meal_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_cache (
  id uuid primary key default gen_random_uuid(),
  search_key text not null unique,
  nutrition_data jsonb not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text,
  equipment text,
  gif_url text,
  body_part text,
  secondary_muscles jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists exercises_name_idx on public.exercises using gin (name gin_trgm_ops);
create index if not exists exercises_muscle_group_idx on public.exercises (muscle_group);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  sets integer not null default 0,
  reps integer not null default 0,
  weight_lbs numeric not null default 0,
  logged_at timestamptz not null default now()
);

create table if not exists public.form_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  exercise_name text,
  score numeric,
  feedback jsonb,
  created_at timestamptz not null default now()
);

create index if not exists food_logs_user_created_idx on public.food_logs (user_id, created_at);
create index if not exists workout_logs_user_logged_idx on public.workout_logs (user_id, logged_at);
create index if not exists form_analyses_user_created_idx on public.form_analyses (user_id, created_at);

alter table if exists public.users
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.user_goals
  add column if not exists age integer,
  add column if not exists weight_kg numeric,
  add column if not exists height_cm numeric,
  add column if not exists goal text,
  add column if not exists daily_calories integer,
  add column if not exists protein_g integer,
  add column if not exists carbs_g integer,
  add column if not exists fat_g integer,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.food_logs
  add column if not exists portion text not null default '1 serving',
  add column if not exists fiber_g integer not null default 0,
  add column if not exists meal_type text not null default 'Snacks';

alter table if exists public.nutrition_cache
  add column if not exists source text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.exercises
  add column if not exists muscle_group text,
  add column if not exists equipment text,
  add column if not exists gif_url text,
  add column if not exists body_part text,
  add column if not exists secondary_muscles jsonb not null default '[]'::jsonb,
  add column if not exists instructions jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.workout_logs
  add column if not exists sets integer not null default 0,
  add column if not exists reps integer not null default 0,
  add column if not exists weight_lbs numeric not null default 0,
  add column if not exists logged_at timestamptz not null default now();

alter table if exists public.form_analyses
  add column if not exists exercise_name text,
  add column if not exists score numeric,
  add column if not exists feedback jsonb,
  add column if not exists created_at timestamptz not null default now();
