# Data preparation (food + exercise database)

These standalone scripts turn the free public data dumps into clean CSVs that
match the Cloud SQL staging tables (`db/load/staging.sql`). They are **not**
part of the app build — run them locally (Python 3, standard library only, no
`pip install` needed), inspect the CSVs, then load them into Cloud SQL.

## 1. Generate the CSVs

| Script | Source (download first) | Output |
|---|---|---|
| `exercises_to_csv.py` | auto-downloads [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | `exercises.csv` |
| `usda_to_csv.py --dir <folder>` | [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets) CSV dump (unzip it) | `usda_foods.csv` |
| `off_to_csv.py --file <file.csv.gz>` | [Open Food Facts dump](https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz) (reads `.gz` directly) | `off_foods.csv` |
| `kaggle_to_csv.py --file <file.csv>` | any Kaggle nutrition CSV (edit `COLMAP`) | `kaggle_foods.csv` |

Add `--limit 5000` to the food scripts for a quick preview before the full run.

```bash
python exercises_to_csv.py
python usda_to_csv.py --dir "C:\path\to\usda_folder"
python off_to_csv.py  --file "C:\path\to\en.openfoodfacts.org.products.csv.gz"
```

All food CSVs share the same columns (per 100 g):
`source, external_id, canonical_name, brand, barcode, serving_desc, calories_kcal, protein_g, carbs_g, fat_g, fiber_g`

## 2. Load into Cloud SQL

See **Step 3** of `NEXT_STEPS.md`. In short: run `db/load/staging.sql`, import
the CSVs into the `stg_*` tables (via `gcloud sql import csv` for the big files,
or psql `\copy` for small ones), then run `db/load/transform.sql` followed by
`db/migrations/004_form_reference.sql`.

## 3. Adding MORE free sources (evaluate → append → de-dup)

An additive path for extra sources beyond USDA/OFF/free-exercise-db. Unlike
`transform.sql` (a full rebuild), this **appends** and then de-duplicates, so
your existing rows are kept.

| Script | What it does |
|---|---|
| `fetch_data_sources.py` | Downloads the free English food/exercise sources to `data_eval/<key>/<key>.csv` + a per-source `_preview.txt` + `SUMMARY.csv`, so you can inspect before integrating. `--list`, `--check`, `--only`, `--kind`. |
| `prepare_new_foods.py` | Converts `data_eval/` IFCT + Norway + CNF into one `foods_new.csv` (per-100g; IFCT energy kJ→kcal; non-English filtered). |
| `prepare_new_exercises.py` | Converts `data_eval/` wger + RepDB + Everkinetic into `exercises_new.csv` (source-prefixed ids; RepDB carries difficulty + MET; media URLs resolved). |

```bash
python fetch_data_sources.py                 # downloads to ./data_eval/<source>/<source>.csv
python prepare_new_foods.py     --dir ./data_eval --out foods_new.csv
python prepare_new_exercises.py --dir ./data_eval --out exercises_new.csv
```

`data_eval/` is raw downloaded data — it is NOT committed to git, so on a fresh
clone you must run `fetch_data_sources.py` first (or copy the folder in).
Verify the CSVs are non-empty (`wc -l foods_new.csv`) before loading.

Then load + de-duplicate in Cloud SQL. Run psql **from the directory holding the
two CSVs** (e.g. the repo root) so the relative paths resolve:

```sql
\i db/load/staging.sql                       -- stg_foods
\i db/migrations/005_exercise_enrichment.sql -- adds difficulty+met_value, stg_exercises_ext
\i db/load/append_and_dedup.sql              -- \copy-loads both CSVs, appends, de-dups
\i db/migrations/004_form_reference.sql      -- re-apply form-check angles (matches by name)
```

`append_and_dedup.sql` runs its own `\copy` of `foods_new.csv` /
`exercises_new.csv`, so no manual `\copy` is needed. (Pasting `\copy` at an
interactive prompt gives `syntax error at "\"` — it must be its own line;
running it from inside the `\i`'d script avoids that.)

`append_and_dedup.sql` keeps one row per food name (most-complete macros, India-first
tie-break) and one row per exercise name (prefers rows with a gif, then most
instructions), and backfills RepDB's difficulty/MET onto same-named rows.

> Licence note: `fetch_data_sources.py`'s `SUMMARY.csv` carries each source's
> licence. wger/Everkinetic images are CC-BY-SA (hostable); RepDB is
> attribution-only; the LogPress/ExerciseDB **GIFs are © Gym Visual** and need a
> paid licence before hosting — metadata is fine, the GIF files are not.
