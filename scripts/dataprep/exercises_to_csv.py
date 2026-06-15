#!/usr/bin/env python3
"""
Build the exercises CSV from the free-exercise-db dataset
(name, muscles, equipment, instructions, images - no API key needed).

Run:
    python exercises_to_csv.py

Output columns (match db/load/staging.sql -> stg_exercises). The
secondary_muscles and instructions columns are JSON arrays so they load
cleanly into the TEXT[]/JSONB columns of the exercises table:
  id, name, muscle_group, body_part, equipment, gif_url,
  secondary_muscles (JSON array), instructions (JSON array)
"""
import csv
import json
import urllib.request

SRC = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"
OUT = "exercises.csv"


def main():
    print("Downloading exercise dataset...")
    data = json.loads(urllib.request.urlopen(SRC).read().decode("utf-8"))
    print(f"{len(data)} exercises fetched.")

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "muscle_group", "body_part", "equipment",
                    "gif_url", "secondary_muscles", "instructions"])
        for e in data:
            primary = e.get("primaryMuscles") or []
            images = e.get("images") or []
            w.writerow([
                e.get("id") or e.get("name", "").lower().replace(" ", "_"),
                e.get("name", ""),
                primary[0] if primary else "",
                e.get("category", ""),
                e.get("equipment", ""),
                (IMG_BASE + images[0]) if images else "",
                json.dumps(e.get("secondaryMuscles") or []),
                json.dumps(e.get("instructions") or []),
            ])
    print(f"Wrote {OUT} ({len(data)} rows).")


if __name__ == "__main__":
    main()
