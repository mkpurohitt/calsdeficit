#!/usr/bin/env python3
"""
Convert the downloaded evaluation CSVs (data_eval/) into ONE Calolean-format
exercise CSV for the Cloud SQL staging table (enriched variant).

Sources (all free, commercial-safe metadata):
    wger        -> 'wger-<id>'  CC-BY-SA, images/videos hostable
    RepDB       -> 'repdb-<id>' carries difficulty + MET (no gif; webp via GitHub raw)
    Everkinetic -> 'ek-<id>'    CC-BY-SA, illustration images

Output columns (extends db/load/staging.sql's stg_exercises with 2 new fields):
    id, name, muscle_group, body_part, equipment, gif_url,
    secondary_muscles (JSON array string), instructions (JSON array string),
    difficulty, met_value

Load target needs db/migrations/005_exercise_enrichment.sql applied first
(adds difficulty + met_value columns to the exercises table).

Standard library only. Usage:
    python prepare_new_exercises.py --dir ./data_eval --out exercises_new.csv
    python prepare_new_exercises.py --dir ./data_eval --only wger repdb
"""
import argparse
import ast
import csv
import json
import os
import re

csv.field_size_limit(2**27)

OUT_COLS = ["id", "name", "muscle_group", "body_part", "equipment", "gif_url",
            "secondary_muscles", "instructions", "difficulty", "met_value"]

REPDB_RAW = "https://raw.githubusercontent.com/sergei-argutin/exercise-dataset/main/"


def read_csv(path):
    for enc in ("utf-8-sig", "latin-1"):
        try:
            with open(path, encoding=enc, newline="") as f:
                return list(csv.DictReader(f))
        except (UnicodeDecodeError, UnicodeError):
            continue
    with open(path, encoding="utf-8", errors="replace", newline="") as f:
        return list(csv.DictReader(f))


def pretty(s):
    """rectus_abdominis / bench-press -> 'Rectus Abdominis' / 'Bench Press'."""
    return re.sub(r"\s+", " ", str(s or "").replace("_", " ").replace("-", " ")).strip().title()


def split_pipe(v):
    return [x.strip() for x in str(v or "").split("|") if x.strip()]


def json_arr(items):
    """JSON array string, or '[]'. Strips HTML tags from each item."""
    clean = [re.sub(r"<[^>]+>", "", str(x)).strip() for x in items]
    clean = [c for c in clean if c]
    return json.dumps(clean, ensure_ascii=False)


def sentences_from_html(html):
    """Turn an HTML/paragraph description into a list of instruction steps."""
    text = re.sub(r"<[^>]+>", " ", str(html or ""))
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if len(p.strip()) > 3]


def norm_equipment(v):
    parts = split_pipe(v)
    parts = [p for p in parts if "none" not in p.lower()]
    return pretty(" | ".join(parts)) if parts else "Bodyweight"


def conv_wger(rows):
    out = []
    for r in rows:
        if not (r.get("name") or "").strip():
            continue
        muscles = split_pipe(r.get("muscles"))
        images = split_pipe(r.get("images"))
        out.append({
            "id": f"wger-{r.get('id')}",
            "name": r["name"].strip(),
            "muscle_group": muscles[0] if muscles else "",
            "body_part": (r.get("category") or "").strip(),
            "equipment": norm_equipment(r.get("equipment")),
            "gif_url": images[0] if images else "",
            "secondary_muscles": json_arr(split_pipe(r.get("muscles_secondary"))),
            "instructions": json_arr(sentences_from_html(r.get("description_html"))),
            "difficulty": "",
            "met_value": "",
        })
    return out


def conv_repdb(rows):
    out = []
    for r in rows:
        name = (r.get("name_en") or "").strip()
        if not name:
            continue
        # images is a python-dict string: {'start': 'images/..', 'peak': 'images/..'}
        gif = ""
        try:
            d = ast.literal_eval(r.get("images") or "{}")
            path = d.get("peak") or d.get("start") or next(iter(d.values()), "")
            if path:
                gif = REPDB_RAW + str(path).lstrip("/")
        except (ValueError, SyntaxError):
            pass
        prim = split_pipe(r.get("primary_muscles"))
        out.append({
            "id": f"repdb-{r.get('id')}",
            "name": name,
            "muscle_group": pretty(prim[0]) if prim else "",
            "body_part": pretty(r.get("body_part")),
            "equipment": pretty(r.get("equipment")),
            "gif_url": gif,
            "secondary_muscles": json_arr([pretty(x) for x in split_pipe(r.get("secondary_muscles"))]),
            "instructions": json_arr(split_pipe(r.get("instructions_en"))),
            "difficulty": (r.get("difficulty") or "").strip().lower(),
            "met_value": (r.get("met") or "").strip(),
        })
    return out


def conv_everkinetic(rows):
    out = []
    for r in rows:
        name = pretty(r.get("name"))
        if not name:
            continue
        images = split_pipe(r.get("images"))
        prim = split_pipe(r.get("primary"))
        out.append({
            "id": f"ek-{r.get('id')}",
            "name": name,
            "muscle_group": pretty(prim[0]) if prim else "",
            "body_part": "",
            "equipment": norm_equipment(r.get("equipment")),
            "gif_url": images[0] if images else "",
            "secondary_muscles": json_arr([pretty(x) for x in split_pipe(r.get("secondary"))]),
            "instructions": json_arr(split_pipe(r.get("steps"))),
            "difficulty": "",
            "met_value": "",
        })
    return out


CONVERTERS = {"wger": conv_wger, "repdb": conv_repdb, "everkinetic": conv_everkinetic}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="./data_eval")
    ap.add_argument("--out", default="exercises_new.csv")
    ap.add_argument("--only", nargs="*", choices=list(CONVERTERS))
    a = ap.parse_args()

    keys = a.only or list(CONVERTERS)
    total = 0
    with open(a.out, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=OUT_COLS)
        w.writeheader()
        for k in keys:
            path = os.path.join(a.dir, k, f"{k}.csv")
            if not os.path.exists(path):
                print(f"[skip] {k}: {path} not found")
                continue
            rows = CONVERTERS[k](read_csv(path))
            w.writerows(rows)
            withgif = sum(1 for r in rows if r["gif_url"])
            withmet = sum(1 for r in rows if r["met_value"])
            print(f"[ok] {k}: {len(rows):,} rows ({withgif:,} with media, {withmet:,} with MET)")
            total += len(rows)

    print(f"\nWrote {total:,} rows -> {os.path.abspath(a.out)}")
    print("Columns:", ", ".join(OUT_COLS))


if __name__ == "__main__":
    main()
