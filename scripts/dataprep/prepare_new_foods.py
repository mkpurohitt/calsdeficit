#!/usr/bin/env python3
"""
Convert the downloaded evaluation CSVs (data_eval/) into ONE Calolean-format
food CSV ready for the Cloud SQL staging table.

Handles the three verified, commercial-safe, English food sources:
    IFCT 2017 (India)   -> source tag 'IFCT'    (energy is kJ -> converted to kcal)
    Norway Matvaretabellen -> 'NORWAY'
    Canada Nutrient File   -> 'CNF'

Output columns (match db/load/staging.sql -> stg_foods, values per 100 g):
    source, external_id, canonical_name, brand, barcode, serving_desc,
    calories_kcal, protein_g, carbs_g, fat_g, fiber_g

Standard library only. Usage:
    python prepare_new_foods.py --dir ./data_eval --out foods_new.csv
    python prepare_new_foods.py --dir ./data_eval --only ifct norway
"""
import argparse
import csv
import os
import re

csv.field_size_limit(2**27)

OUT_COLS = ["source", "external_id", "canonical_name", "brand", "barcode",
            "serving_desc", "calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"]

ASCII_ONLY = re.compile(r"^[ -~]+$")     # printable ASCII → English-ish names only


def num(v):
    """Clean numeric string, or '' if not parseable. Strips '<', ranges, units."""
    if v is None:
        return ""
    s = str(v).strip().replace(",", ".")
    if not s or s.lower() in ("nan", "tr", "trace", "-", "n/a", "na"):
        return ""
    m = re.search(r"-?\d+(\.\d+)?", s)      # first number in things like "< 0.1"
    if not m:
        return ""
    try:
        return str(round(float(m.group()), 3))
    except ValueError:
        return ""


def clean_name(v):
    return re.sub(r"\s+", " ", str(v or "").strip())


def read_csv(path):
    for enc in ("utf-8-sig", "latin-1"):
        try:
            with open(path, encoding=enc, newline="") as f:
                return list(csv.DictReader(f))
        except (UnicodeDecodeError, UnicodeError):
            continue
    with open(path, encoding="utf-8", errors="replace", newline="") as f:
        return list(csv.DictReader(f))


def emit(rows, w, stats, key):
    """Filter + write rows; skip non-English and macro-less rows."""
    for r in rows:
        name = r["canonical_name"]
        if not name or len(name) < 2:
            stats[key + "_skip_name"] += 1
            continue
        if not ASCII_ONLY.match(name):
            stats[key + "_skip_nonascii"] += 1
            continue
        if not any(r[c] for c in ("calories_kcal", "protein_g", "carbs_g", "fat_g")):
            stats[key + "_skip_nomacros"] += 1
            continue
        w.writerow([r.get(c, "") for c in OUT_COLS])
        stats[key + "_written"] += 1


def conv_ifct(path):
    """IFCT 2017 — columns are 'Label; code'. Energy is kJ → convert to kcal."""
    out = []
    for r in read_csv(path):
        # column keys carry a '; code' suffix
        def col(sub):
            for k in r:
                if k.lower().startswith(sub):
                    return r[k]
            return ""
        kj = num(col("energy; enerc"))
        kcal = str(round(float(kj) / 4.184, 1)) if kj else ""
        out.append({
            "source": "IFCT",
            "external_id": clean_name(col("food code")),
            "canonical_name": clean_name(col("food name")),
            "brand": "", "barcode": "", "serving_desc": "",
            "calories_kcal": kcal,
            "protein_g": num(col("protein; protcnt")),
            "carbs_g": num(col("carbohydrate; choavldf")),
            "fat_g": num(col("total fat; fatce")),
            "fiber_g": num(col("dietary fiber; fibtg")),
        })
    return out


def conv_norway(path):
    out = []
    for r in read_csv(path):
        out.append({
            "source": "NORWAY",
            "external_id": clean_name(r.get("id")),
            "canonical_name": clean_name(r.get("name")),
            "brand": "", "barcode": "", "serving_desc": "",
            "calories_kcal": num(r.get("energy_kcal")),
            "protein_g": num(r.get("Protein")),
            "carbs_g": num(r.get("Karbo")),
            "fat_g": num(r.get("Fett")),
            "fiber_g": num(r.get("Fiber")),
        })
    return out


def conv_cnf(path):
    out = []
    for r in read_csv(path):
        out.append({
            "source": "CNF",
            "external_id": clean_name(r.get("FoodID")),
            "canonical_name": clean_name(r.get("FoodDescription")),
            "brand": "", "barcode": "", "serving_desc": "",
            "calories_kcal": num(r.get("KCAL")),
            "protein_g": num(r.get("PROT")),
            "carbs_g": num(r.get("CARB")),
            "fat_g": num(r.get("FAT")),
            "fiber_g": num(r.get("FIBTG") or r.get("FIBC") or ""),
        })
    return out


CONVERTERS = {"ifct": conv_ifct, "norway": conv_norway, "cnf": conv_cnf}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="./data_eval", help="folder with <key>/<key>.csv")
    ap.add_argument("--out", default="foods_new.csv")
    ap.add_argument("--only", nargs="*", choices=list(CONVERTERS))
    a = ap.parse_args()

    keys = a.only or list(CONVERTERS)
    stats = {}
    for k in keys:
        for s in ("written", "skip_name", "skip_nonascii", "skip_nomacros"):
            stats[f"{k}_{s}"] = 0

    with open(a.out, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(OUT_COLS)
        for k in keys:
            path = os.path.join(a.dir, k, f"{k}.csv")
            if not os.path.exists(path):
                print(f"[skip] {k}: {path} not found")
                continue
            print(f"[..] {k}: reading {path}")
            emit(CONVERTERS[k](path), w, stats, k)
            print(f"[ok] {k}: {stats[k+'_written']:,} written "
                  f"(skipped {stats[k+'_skip_nonascii']:,} non-English, "
                  f"{stats[k+'_skip_nomacros']:,} no-macros, "
                  f"{stats[k+'_skip_name']:,} bad-name)")

    total = sum(stats[f"{k}_written"] for k in keys)
    print(f"\nWrote {total:,} rows -> {os.path.abspath(a.out)}")
    print("Columns:", ", ".join(OUT_COLS))


if __name__ == "__main__":
    main()
