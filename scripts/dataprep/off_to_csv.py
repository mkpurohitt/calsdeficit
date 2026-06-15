#!/usr/bin/env python3
"""
Build a normalized foods CSV from the Open Food Facts data dump.

1. Download the dump (no need to unzip - this reads .gz directly):
     https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
2. Run:
     python off_to_csv.py --file "C:\\path\\en.openfoodfacts.org.products.csv.gz"
   Add --limit 5000 for a quick preview.

Output columns (match db/load/staging.sql -> stg_foods, per 100 g):
  source, external_id, canonical_name, brand, barcode, serving_desc,
  calories_kcal, protein_g, carbs_g, fat_g, fiber_g
"""
import argparse
import csv
import gzip

csv.field_size_limit(2**27)


def num(v):
    try:
        if v is None or v == "":
            return ""
        return str(float(v))
    except (ValueError, TypeError):
        return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="the downloaded OFF .csv.gz (or .csv)")
    ap.add_argument("--out", default="off_foods.csv")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    opener = gzip.open if a.file.endswith(".gz") else open
    written = total = 0
    with opener(a.file, "rt", encoding="utf-8", errors="replace", newline="") as fin, \
            open(a.out, "w", newline="", encoding="utf-8") as fout:
        reader = csv.DictReader(fin, delimiter="\t")
        w = csv.writer(fout)
        w.writerow(["source", "external_id", "canonical_name", "brand", "barcode",
                    "serving_desc", "calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"])
        for r in reader:
            total += 1
            name = (r.get("product_name") or "").strip()
            kcal = num(r.get("energy-kcal_100g"))
            prot = num(r.get("proteins_100g"))
            if not name or (not kcal and not prot):
                continue
            w.writerow(["OFF", r.get("code", ""), name, r.get("brands", ""),
                        r.get("code", ""), r.get("serving_size", ""),
                        kcal, prot, num(r.get("carbohydrates_100g")),
                        num(r.get("fat_100g")), num(r.get("fiber_100g"))])
            written += 1
            if total % 500_000 == 0:
                print(f"  scanned {total:,}, kept {written:,}")
            if a.limit and written >= a.limit:
                break
    print(f"Done. Kept {written:,} of {total:,} products -> {a.out}")


if __name__ == "__main__":
    main()
