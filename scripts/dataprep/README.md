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
