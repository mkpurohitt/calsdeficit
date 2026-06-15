#!/usr/bin/env python3
"""
Normalize a manually-downloaded Kaggle nutrition CSV into the Calolean
foods format. Kaggle datasets all use different column names, so edit the
COLMAP below to match YOUR file's headers (the script prints them on run).

Run:
    python kaggle_to_csv.py --file "C:\\path\\nutrition.csv"

Output columns (match db/load/staging.sql -> stg_foods, per 100 g):
  source, external_id, canonical_name, brand, barcode, serving_desc,
  calories_kcal, protein_g, carbs_g, fat_g, fiber_g
"""
import argparse
import csv

csv.field_size_limit(2**27)

# left = OUR column, right = the header name in YOUR Kaggle file (edit these!)
COLMAP = {
    "canonical_name": "name",
    "calories_kcal": "calories",
    "protein_g": "protein",
    "carbs_g": "carbohydrate",
    "fat_g": "total_fat",
    "fiber_g": "fiber",
}


def num(v):
    try:
        if v is None or v == "":
            return ""
        return str(float(str(v).replace("g", "").strip()))
    except (ValueError, TypeError):
        return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--out", default="kaggle_foods.csv")
    a = ap.parse_args()

    with open(a.file, encoding="utf-8", errors="replace", newline="") as fin, \
            open(a.out, "w", newline="", encoding="utf-8") as fout:
        reader = csv.DictReader(fin)
        print("Detected columns:", reader.fieldnames)  # <-- shows the real headers
        w = csv.writer(fout)
        w.writerow(["source", "external_id", "canonical_name", "brand", "barcode",
                    "serving_desc", "calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"])
        written = 0
        for i, r in enumerate(reader):
            def g(col):
                return r.get(COLMAP.get(col, ""), "")
            name = (g("canonical_name") or "").strip()
            if not name:
                continue
            w.writerow(["KAGGLE", i, name, "", "", "",
                        num(g("calories_kcal")), num(g("protein_g")), num(g("carbs_g")),
                        num(g("fat_g")), num(g("fiber_g"))])
            written += 1
    print(f"Done. {written} foods -> {a.out}")


if __name__ == "__main__":
    main()
