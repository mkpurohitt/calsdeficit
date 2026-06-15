#!/usr/bin/env python3
"""
Build a normalized foods CSV from a USDA FoodData Central CSV download
(any data type: Foundation, SR Legacy, Survey/FNDDS, or Branded).

1. Download a CSV dataset from https://fdc.nal.usda.gov/download-datasets
   ("Full Download of All Data Types" for everything, or the smaller
   Foundation / SR Legacy / Survey sets) and unzip it.
2. Run:
     python usda_to_csv.py --dir "C:\\path\\to\\unzipped_folder"
   Add --limit 5000 for a quick preview.

Output columns (match db/load/staging.sql -> stg_foods, per 100 g):
  source, external_id, canonical_name, brand, barcode, serving_desc,
  calories_kcal, protein_g, carbs_g, fat_g, fiber_g
"""
import argparse
import csv
import os

csv.field_size_limit(2**27)

# nutrient_id -> field. 1008 is preferred kcal; 2047/2048 are Atwater fallbacks.
NUTRIENTS = {
    "1008": "cal", "2047": "cal2", "2048": "cal3",
    "1003": "protein", "1005": "carbs", "1004": "fat", "1079": "fiber",
}


def num(v):
    """Return a clean float string, or '' if not parseable."""
    try:
        if v is None or v == "":
            return ""
        return str(float(v))
    except (ValueError, TypeError):
        return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="folder with food.csv + food_nutrient.csv")
    ap.add_argument("--out", default="usda_foods.csv")
    ap.add_argument("--limit", type=int, default=0, help="0 = all; e.g. 5000 to preview")
    a = ap.parse_args()

    def path(name):
        return os.path.join(a.dir, name)

    print("Reading food.csv (names)...")
    names = {}
    with open(path("food.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            fid = r.get("fdc_id")
            desc = (r.get("description") or "").strip()
            if fid and desc:
                names[fid] = desc
            if a.limit and len(names) >= a.limit:
                break
    print(f"  {len(names)} foods")

    # Optional branded extras (brand / barcode / serving size)
    extras = {}
    if os.path.exists(path("branded_food.csv")):
        print("Reading branded_food.csv (brand/barcode/serving)...")
        with open(path("branded_food.csv"), encoding="utf-8") as f:
            for r in csv.DictReader(f):
                fid = r.get("fdc_id")
                if fid in names:
                    serv = f'{r.get("serving_size", "")} {r.get("serving_size_unit", "")}'.strip()
                    extras[fid] = (r.get("brand_owner", "") or r.get("brand_name", ""),
                                   r.get("gtin_upc", ""), serv)

    print("Streaming food_nutrient.csv (macros) - this is the big file...")
    nutr = {}
    with open(path("food_nutrient.csv"), encoding="utf-8") as f:
        for i, r in enumerate(csv.DictReader(f)):
            fid = r.get("fdc_id")
            key = NUTRIENTS.get(r.get("nutrient_id"))
            if fid in names and key:
                nutr.setdefault(fid, {})[key] = r.get("amount", "")
            if i and i % 2_000_000 == 0:
                print(f"  {i:,} nutrient rows...")

    def cal(d):
        return d.get("cal") or d.get("cal2") or d.get("cal3") or ""

    print(f"Writing {a.out}...")
    written = 0
    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["source", "external_id", "canonical_name", "brand", "barcode",
                    "serving_desc", "calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"])
        for fid, desc in names.items():
            d = nutr.get(fid, {})
            if not cal(d) and not d.get("protein"):
                continue  # no usable macros
            brand, barcode, serv = extras.get(fid, ("", "", ""))
            w.writerow(["USDA", fid, desc, brand, barcode, serv,
                        num(cal(d)), num(d.get("protein")), num(d.get("carbs")),
                        num(d.get("fat")), num(d.get("fiber"))])
            written += 1
    print(f"Done. {written:,} foods written to {a.out}.")


if __name__ == "__main__":
    main()
