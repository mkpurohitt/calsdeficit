#!/usr/bin/env python3
"""
Calolean — free food & exercise data-source evaluator.

Downloads the FREE, English data sources from docs/DATA_SOURCES.md, converts
each to a flat CSV, and writes a preview + summary so you can eyeball what
each source actually contains before deciding to integrate it.

This is an EVALUATION tool: it does NOT touch the Calolean database and does
not reshape anything into our `foods` / `exercises` schema. One CSV per source,
raw columns preserved.

Usage
-----
    pip install pandas requests openpyxl xlrd

    python3 fetch_data_sources.py --list           # show the catalog
    python3 fetch_data_sources.py --check          # test which URLs are reachable
    python3 fetch_data_sources.py                  # download everything automatable
    python3 fetch_data_sources.py --only wger everkinetic cofid
    python3 fetch_data_sources.py --kind exercise  # only exercise sources
    python3 fetch_data_sources.py --out ./eval     # output dir (default ./data_eval)

Output
------
    <out>/<key>/<key>.csv        flat CSV of the source
    <out>/<key>/_preview.txt     columns + first rows, human readable
    <out>/SUMMARY.csv            one row per source: rows, cols, license, status
    <out>/SUMMARY.txt            same, printed as a readable table

Sources needing a manual download or an API key are listed by --list with the
exact page to visit; they are skipped by the downloader (never silently).

Verification status
-------------------
Confirmed working end-to-end (real row counts observed):
    logpress     1,324 exercises x 15 cols   (10-language instructions, EN extracted)
    repdb          400 exercises x 28 cols   (has met + difficulty + instructions_en)
    everkinetic    293 exercises x 15 cols   (steps, tips, multi-pose images)
    ifct           542 Indian foods x 421 cols

Not yet verified — the URLs are researched but were unreachable from the machine
this script was written on (an egress proxy blocked every non-GitHub host).
They should work on a normal connection such as Cloud Shell:
    wger, wrkout (needs codeload.github.com), norway, menustat, cnf, cofid, ciqual
If one fails, the run continues and SUMMARY.csv records the exact error.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import tarfile
import zipfile
from dataclasses import dataclass, field
from typing import Callable, Optional

import requests

try:
    import pandas as pd
except ImportError:
    sys.exit("Missing deps. Run:  pip install pandas requests openpyxl xlrd")

UA = {"User-Agent": "Mozilla/5.0 (compatible; CaloleanDataEval/1.0)"}
TIMEOUT = 120


# ───────────────────────── helpers ─────────────────────────

def get(url: str, **kw) -> requests.Response:
    r = requests.get(url, headers=UA, timeout=TIMEOUT, **kw)
    r.raise_for_status()
    return r


def github_raw(repo: str, path: str, refs=("main", "master")) -> bytes:
    """Fetch one file straight from raw.githubusercontent.com (most reliable)."""
    last = None
    for ref in refs:
        try:
            return get(f"https://raw.githubusercontent.com/{repo}/{ref}/{path}").content
        except Exception as exc:
            last = exc
    raise RuntimeError(f"raw fetch failed for {repo}/{path}: {last}")


def github_tarball(repo: str, refs=("main", "master")) -> tarfile.TarFile:
    """Download a whole GitHub repo tarball — used when we must enumerate files.
    Note: needs codeload.github.com (some corporate proxies block it)."""
    last = None
    for ref in refs:
        url = f"https://codeload.github.com/{repo}/tar.gz/refs/heads/{ref}"
        try:
            r = get(url)
            return tarfile.open(fileobj=io.BytesIO(r.content), mode="r:gz")
        except Exception as exc:  # try next ref
            last = exc
    raise RuntimeError(f"could not fetch {repo} tarball: {last}")


def npm_tarball(package: str) -> tarfile.TarFile:
    """Download the latest npm package tarball (used for the IFCT India data)."""
    meta = get(f"https://registry.npmjs.org/{package}").json()
    url = meta["versions"][meta["dist-tags"]["latest"]]["dist"]["tarball"]
    return tarfile.open(fileobj=io.BytesIO(get(url).content), mode="r:gz")


def tar_find(tf: tarfile.TarFile, *, endswith=None, contains=None, biggest=False):
    """Find member(s) in a tarball by suffix/substring."""
    hits = []
    for m in tf.getmembers():
        if not m.isfile():
            continue
        name = m.name
        if endswith and not name.endswith(endswith):
            continue
        if contains and contains not in name:
            continue
        hits.append(m)
    if not hits:
        return None
    if biggest:
        hits.sort(key=lambda m: m.size, reverse=True)
    return hits[0] if (endswith or contains) else hits


def tar_json(tf: tarfile.TarFile, member) -> object:
    return json.loads(tf.extractfile(member).read().decode("utf-8", "replace"))


def flatten(obj, prefix="") -> dict:
    """Flatten nested dict/list into scalar columns (lists → ' | ' joined)."""
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.update(flatten(v, f"{prefix}{k}."))
    elif isinstance(obj, list):
        if all(not isinstance(x, (dict, list)) for x in obj):
            out[prefix[:-1]] = " | ".join("" if x is None else str(x) for x in obj)
        else:
            for i, x in enumerate(obj[:6]):
                out.update(flatten(x, f"{prefix}{i}."))
    else:
        out[prefix[:-1]] = obj
    return out


def df_from_records(records: list) -> pd.DataFrame:
    return pd.DataFrame([flatten(r) for r in records])


def read_tabular(content: bytes, name: str) -> pd.DataFrame:
    """Read csv/xlsx/xls bytes into a DataFrame, trying a few encodings."""
    low = name.lower()
    if low.endswith((".xlsx", ".xlsm")):
        return pd.read_excel(io.BytesIO(content), engine="openpyxl")
    if low.endswith(".xls"):
        try:
            return pd.read_excel(io.BytesIO(content))
        except Exception:
            return pd.read_excel(io.BytesIO(content), engine="openpyxl")
    for enc in ("utf-8-sig", "latin-1"):
        for sep in (",", ";", "\t"):
            try:
                df = pd.read_csv(io.BytesIO(content), encoding=enc, sep=sep,
                                 low_memory=False, on_bad_lines="skip")
                if df.shape[1] > 1:
                    return df
            except Exception:
                continue
    raise RuntimeError(f"could not parse {name} as a table")


# ───────────────────────── fetchers: EXERCISE ─────────────────────────

def fetch_wger() -> pd.DataFrame:
    """wger — CC-BY-SA, commercial + image hosting OK. English only (language=2)."""
    rows, url = [], "https://wger.de/api/v2/exerciseinfo/?limit=100&format=json"
    while url:
        data = get(url).json()
        for ex in data.get("results", []):
            en = next((t for t in ex.get("translations", [])
                       if t.get("language") == 2), None)
            if not en:
                continue
            rows.append({
                "id": ex.get("id"),
                "uuid": ex.get("uuid"),
                "name": en.get("name"),
                "description_html": en.get("description"),
                "category": (ex.get("category") or {}).get("name"),
                "muscles": " | ".join(m.get("name", "") for m in ex.get("muscles", [])),
                "muscles_secondary": " | ".join(m.get("name", "") for m in ex.get("muscles_secondary", [])),
                "equipment": " | ".join(e.get("name", "") for e in ex.get("equipment", [])),
                "images": " | ".join(i.get("image", "") for i in ex.get("images", [])),
                "image_count": len(ex.get("images", [])),
                "videos": " | ".join(str(v.get("video", "")) for v in ex.get("videos", [])),
                "video_count": len(ex.get("videos", [])),
                "license_author": en.get("license_author"),
            })
        url = data.get("next")
    return pd.DataFrame(rows)


def fetch_everkinetic() -> pd.DataFrame:
    """Everkinetic — CC-BY-SA 4.0, commercial OK. Still illustrations."""
    try:
        data = json.loads(github_raw("everkinetic/data", "exercises.json"))
    except Exception:
        tf = github_tarball("everkinetic/data")
        m = tar_find(tf, endswith="exercises.json")
        if not m:
            raise RuntimeError("exercises.json not found in everkinetic/data")
        data = tar_json(tf, m)
    return df_from_records(data if isinstance(data, list) else [data])


def fetch_wrkout() -> pd.DataFrame:
    """wrkout/exercises.json — Unlicense (public domain). Metadata only."""
    tf = github_tarball("wrkout/exercises.json")
    members = [m for m in tf.getmembers()
               if m.isfile() and m.name.endswith(".json") and "/exercises/" in m.name]
    records = []
    if members:
        for m in members:
            try:
                records.append(tar_json(tf, m))
            except Exception:
                pass
    else:  # fall back to a single combined json
        m = tar_find(tf, endswith=".json", biggest=True)
        data = tar_json(tf, m)
        records = data if isinstance(data, list) else [data]
    return df_from_records(records)


def fetch_logpress() -> pd.DataFrame:
    """hasaneyldrm/exercises-dataset — metadata+text MIT; GIFs (c) Gym Visual.
    English instructions only."""
    data = None
    for ref in ("main", "master"):
        try:
            data = get(f"https://raw.githubusercontent.com/hasaneyldrm/"
                       f"exercises-dataset/{ref}/data/exercises.json").json()
            break
        except Exception:
            continue
    if data is None:  # path moved — search the tarball
        tf = github_tarball("hasaneyldrm/exercises-dataset")
        m = tar_find(tf, endswith="exercises.json", biggest=True)
        if not m:
            raise RuntimeError("exercises.json not found")
        data = tar_json(tf, m)
    records = data if isinstance(data, list) else data.get("exercises", data)

    rows = []
    for ex in records:
        r = {k: v for k, v in ex.items() if not isinstance(v, (dict, list))}
        instr = ex.get("instructions")
        if isinstance(instr, dict):  # multilingual → keep English
            en = instr.get("en") or instr.get("english") or []
            r["instructions_en"] = " ".join(en) if isinstance(en, list) else str(en)
            r["languages_available"] = " | ".join(instr.keys())
        elif isinstance(instr, list):
            r["instructions_en"] = " ".join(map(str, instr))
        name = ex.get("name")
        if isinstance(name, dict):
            r["name"] = name.get("en") or next(iter(name.values()), "")
        for key in ("secondaryMuscles", "secondary_muscles"):
            if isinstance(ex.get(key), list):
                r[key] = " | ".join(map(str, ex[key]))
        rows.append(r)
    return pd.DataFrame(rows)


def fetch_repdb() -> pd.DataFrame:
    """RepDB free — commercial in-app OK w/ attribution. Has MET + difficulty."""
    try:
        data = json.loads(github_raw("sergei-argutin/exercise-dataset", "exercises.json"))
    except Exception:
        tf = github_tarball("sergei-argutin/exercise-dataset")
        m = tar_find(tf, endswith=".json", biggest=True)
        if not m:
            raise RuntimeError("no json found in RepDB dataset")
        data = tar_json(tf, m)
    records = data if isinstance(data, list) else data.get("exercises", [data])
    rows = []
    for ex in records:
        r = {}
        for k, v in ex.items():
            if isinstance(v, dict):  # multilingual field → English
                r[k] = v.get("en") or v.get("english") or next(iter(v.values()), "")
            elif isinstance(v, list):
                r[k] = " | ".join(
                    (x.get("en", "") if isinstance(x, dict) else str(x)) for x in v)
            else:
                r[k] = v
        rows.append(r)
    return pd.DataFrame(rows)


# ───────────────────────── fetchers: FOOD ─────────────────────────

def fetch_norway() -> pd.DataFrame:
    """Norway Matvaretabellen — open licence, commercial OK. English API."""
    data = get("https://www.matvaretabellen.no/api/en/foods.json").json()
    foods = data.get("foods", data) if isinstance(data, dict) else data
    rows = []
    for f in foods:
        r = {"id": f.get("foodId"), "name": f.get("foodName"),
             "group": f.get("foodGroupId"), "energy_kcal": f.get("calories", {}).get("quantity")
             if isinstance(f.get("calories"), dict) else f.get("calories")}
        for c in f.get("constituents", []):
            nid = c.get("nutrientId")
            if nid:
                r[nid] = c.get("quantity")
        rows.append(r)
    return pd.DataFrame(rows)


def fetch_menustat() -> pd.DataFrame:
    """MenuStat (NYC Open Data) — open gov, commercial OK. US restaurant macros."""
    url = ("https://data.cityofnewyork.us/resource/qgc5-ecnb.csv"
           "?$limit=100000")
    return read_tabular(get(url).content, "menustat.csv")


def fetch_cnf() -> pd.DataFrame:
    """Canada CNF — Open Gov Licence, commercial OK. Joins food names + nutrients."""
    url = ("https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/"
           "alt_formats/zip/nutrition/fiche-nutri-data/cnf-fcen-csv.zip")
    zf = zipfile.ZipFile(io.BytesIO(get(url).content))
    names = zf.namelist()

    def pick(*keys):
        for n in names:
            low = n.lower()
            if all(k in low for k in keys) and low.endswith(".csv"):
                return n
        return None

    food_f, amt_f, name_f = pick("food", "name"), pick("nutrient", "amount"), pick("nutrient", "name")
    if not (food_f and amt_f and name_f):
        # fall back: return the biggest csv so the user still sees the data
        biggest = max((n for n in names if n.lower().endswith(".csv")),
                      key=lambda n: zf.getinfo(n).file_size)
        return read_tabular(zf.read(biggest), biggest)

    foods = read_tabular(zf.read(food_f), food_f)
    amounts = read_tabular(zf.read(amt_f), amt_f)
    nutrients = read_tabular(zf.read(name_f), name_f)

    def col(df, *cands):
        for c in df.columns:
            if c.strip().lower() in cands:
                return c
        return None

    fid_a, fid_f = col(amounts, "foodid"), col(foods, "foodid")
    nid_a, nid_n = col(amounts, "nutrientid"), col(nutrients, "nutrientid")
    val = col(amounts, "nutrientvalue")
    nname = col(nutrients, "nutrientname", "nutrientsymbol")
    fname = col(foods, "fooddescription")
    if not all([fid_a, fid_f, nid_a, nid_n, val, nname, fname]):
        return foods

    m = amounts.merge(nutrients[[nid_n, nname]], left_on=nid_a, right_on=nid_n)
    wide = m.pivot_table(index=fid_a, columns=nname, values=val, aggfunc="first")
    return foods[[fid_f, fname]].merge(wide, left_on=fid_f, right_index=True, how="inner")


def fetch_ifct() -> pd.DataFrame:
    """IFCT 2017 (India) — ICMR-NIN data, shipped as CSV inside the npm package.
    Columns are 'Label; code' pairs, e.g. 'Energy; enerc'."""
    tf = npm_tarball("@ifct2017/compositions")
    m = tar_find(tf, endswith=".csv", biggest=True)
    if not m:
        raise RuntimeError("no CSV inside @ifct2017/compositions")
    df = read_tabular(tf.extractfile(m).read(), m.name)
    df.columns = [str(c).strip().strip('"') for c in df.columns]
    return df


def fetch_ciqual() -> pd.DataFrame:
    """France CIQUAL — Etalab 2.0, commercial OK. Has English food-name column."""
    rec = get("https://zenodo.org/api/records/17592207").json()
    files = rec.get("files", [])
    cand = None
    for f in files:
        key = (f.get("key") or "").lower()
        if key.endswith((".csv", ".xlsx", ".xls")):
            cand = f
            break
    if not cand:
        raise RuntimeError("no tabular file in the CIQUAL Zenodo record")
    link = (cand.get("links") or {}).get("self") or (cand.get("links") or {}).get("download")
    return read_tabular(get(link).content, cand["key"])


def fetch_cofid() -> pd.DataFrame:
    """UK CoFID — Open Government Licence, commercial + redistribution OK."""
    url = ("https://assets.publishing.service.gov.uk/media/60538e66d3bf7f03249bac58/"
           "McCance_and_Widdowsons_Composition_of_Foods_integrated_dataset_2021.xlsx")
    return read_tabular(get(url).content, "cofid.xlsx")


# ───────────────────────── catalog ─────────────────────────

@dataclass
class Source:
    key: str
    title: str
    kind: str                     # food | exercise
    license: str
    page: str
    fetch: Optional[Callable] = None
    manual: str = ""              # why it can't be automated
    notes: str = ""


SOURCES: list[Source] = [
    # ---------- EXERCISE (automatable) ----------
    Source("wger", "wger", "exercise",
           "CC-BY-SA — commercial + host images OK",
           "https://wger.de/api/v2/exercise/", fetch_wger,
           notes="Free REST API, no key. English rows only. Still images + a few videos."),
    Source("everkinetic", "Everkinetic", "exercise",
           "CC-BY-SA 4.0 — commercial OK",
           "https://github.com/everkinetic/data", fetch_everkinetic,
           notes="Multi-pose still illustrations + instructions."),
    Source("repdb", "RepDB (free tier)", "exercise",
           "Commercial in-app OK w/ attribution; no redistribution",
           "https://github.com/sergei-argutin/exercise-dataset", fetch_repdb,
           notes="400 exercises. Carries MET values + difficulty (we lack both)."),
    Source("wrkout", "wrkout/exercises.json", "exercise",
           "Unlicense (public domain)",
           "https://github.com/wrkout/exercises.json", fetch_wrkout,
           notes="Metadata only, no media. Overlaps free-exercise-db lineage."),
    Source("logpress", "hasaneyldrm/exercises-dataset", "exercise",
           "Text MIT; GIFs (c) Gym Visual — media needs its own licence",
           "https://github.com/hasaneyldrm/exercises-dataset", fetch_logpress,
           notes="1,324 exercises, instructions in 10 languages (English extracted)."),

    # ---------- FOOD (automatable) ----------
    Source("norway", "Norway Matvaretabellen", "food",
           "Open (NLOD-style) — commercial OK",
           "https://www.matvaretabellen.no/en/api/", fetch_norway,
           notes="Official English JSON API, no key."),
    Source("menustat", "MenuStat (NYC)", "food",
           "NYC Open Data — commercial OK",
           "https://www.menustat.org/data.html", fetch_menustat,
           notes="US restaurant-chain items with per-serving macros."),
    Source("cnf", "Canada Nutrient File", "food",
           "Open Government Licence – Canada — commercial OK",
           "https://open.canada.ca/data/en/dataset/089885f9-ed53-44e6-854a-14d21a1ec2e0",
           fetch_cnf, notes="~5,690 foods; script joins food names to a wide nutrient table."),
    Source("cofid", "UK CoFID", "food",
           "Open Government Licence — commercial OK",
           "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid",
           fetch_cofid, notes="~2,900 UK foods, 185 nutrients."),
    Source("ciqual", "France CIQUAL", "food",
           "Etalab Ouverte 2.0 — commercial OK",
           "https://ciqual.anses.fr/", fetch_ciqual,
           notes="French table but ships an English food-name column."),
    Source("ifct", "IFCT 2017 (India)", "food",
           "ICMR-NIN data; attribute",
           "https://github.com/ifct2017/compositions", fetch_ifct,
           notes="528+ Indian generic foods, 151 components."),

    # ---------- MANUAL / KEY REQUIRED ----------
    Source("indb", "INDB — Indian Nutrient Databank", "food",
           "CC BY 4.0 — commercial + storage OK",
           "https://www.anuvaad.org.in/indian-nutrient-databank/",
           manual="Excel behind a request/download page — grab it by hand.",
           notes="TOP India pick: 1,095 foods + 1,014 Indian recipes WITH serving sizes."),
    Source("foodrepo", "Open Food Repo (Swiss)", "food",
           "CC BY 4.0 — commercial + storage OK",
           "https://www.foodrepo.org/en/developers",
           manual="Needs a free API key; set FOODREPO_API_KEY and use their v3 API.",
           notes="Barcoded packaged products + images."),
    Source("frida", "Denmark Frida", "food",
           "Free + attribution; redistribution unclear",
           "https://frida.fooddata.dk/data",
           manual="Spreadsheet download page, no API."),
    Source("afcd", "Australia AFCD", "food",
           "FSANZ licence — ShareAlike + extra terms",
           "https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files",
           manual="Excel download page."),
    Source("exercisedb", "ExerciseDB (GIFs)", "exercise",
           "GIFs NOT free — one-time paid dataset licence to self-host",
           "https://exercisedb.io/",
           manual="Paid dataset licence / RapidAPI key required.",
           notes="The 1,300+ animated GIFs. Metadata free-ish, media is not."),
]

BY_KEY = {s.key: s for s in SOURCES}


# ───────────────────────── runner ─────────────────────────

def write_outputs(src: Source, df: pd.DataFrame, outdir: str) -> dict:
    d = os.path.join(outdir, src.key)
    os.makedirs(d, exist_ok=True)
    csv_path = os.path.join(d, f"{src.key}.csv")
    df.to_csv(csv_path, index=False)

    with open(os.path.join(d, "_preview.txt"), "w", encoding="utf-8") as fh:
        fh.write(f"{src.title}  [{src.kind}]\n{src.page}\n")
        fh.write(f"Licence: {src.license}\n")
        if src.notes:
            fh.write(f"Notes:   {src.notes}\n")
        fh.write(f"\nRows: {len(df):,}   Columns: {len(df.columns)}\n")
        fh.write("\n--- COLUMNS ---\n")
        for c in df.columns:
            filled = int(df[c].notna().sum())
            fh.write(f"  {c}  ({filled:,}/{len(df):,} filled)\n")
        fh.write("\n--- FIRST 3 ROWS ---\n")
        with pd.option_context("display.max_columns", None, "display.width", 200):
            fh.write(df.head(3).to_string())
        fh.write("\n")

    return {"rows": len(df), "cols": len(df.columns), "csv": csv_path}


def main() -> int:
    ap = argparse.ArgumentParser(description="Download free food/exercise data sources as CSV.")
    ap.add_argument("--out", default="./data_eval")
    ap.add_argument("--only", nargs="*", help="source keys to run")
    ap.add_argument("--kind", choices=["food", "exercise"])
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--check", action="store_true", help="only test reachability")
    args = ap.parse_args()

    if args.list:
        for s in SOURCES:
            tag = "AUTO  " if s.fetch else "MANUAL"
            print(f"[{tag}] {s.key:<12} {s.kind:<8} {s.title}")
            print(f"           {s.page}")
            print(f"           licence: {s.license}")
            if s.manual:
                print(f"           !! {s.manual}")
            if s.notes:
                print(f"           {s.notes}")
            print()
        return 0

    picked = [s for s in SOURCES
              if (not args.only or s.key in args.only)
              and (not args.kind or s.kind == args.kind)]

    if args.check:
        print("Reachability check (HEAD/GET, no parsing):\n")
        for s in picked:
            if not s.fetch:
                print(f"  MANUAL   {s.key:<12} {s.manual}")
                continue
            try:
                r = requests.get(s.page, headers=UA, timeout=30, stream=True)
                print(f"  HTTP {r.status_code} {s.key:<12} {s.page}")
            except Exception as exc:
                print(f"  ERR      {s.key:<12} {type(exc).__name__}: {exc}")
        return 0

    os.makedirs(args.out, exist_ok=True)
    summary = []
    for s in picked:
        if not s.fetch:
            print(f"[skip] {s.key}: MANUAL — {s.manual}")
            summary.append({"key": s.key, "title": s.title, "kind": s.kind,
                            "status": "MANUAL", "rows": "", "cols": "",
                            "licence": s.license, "page": s.page, "notes": s.manual})
            continue

        print(f"[..]   {s.key}: downloading …", flush=True)
        try:
            df = s.fetch()
            if df is None or df.empty:
                raise RuntimeError("returned no rows")
            info = write_outputs(s, df, args.out)
            print(f"[ok]   {s.key}: {info['rows']:,} rows x {info['cols']} cols -> {info['csv']}")
            summary.append({"key": s.key, "title": s.title, "kind": s.kind,
                            "status": "OK", "rows": info["rows"], "cols": info["cols"],
                            "licence": s.license, "page": s.page, "notes": s.notes})
        except Exception as exc:
            print(f"[FAIL] {s.key}: {type(exc).__name__}: {exc}")
            summary.append({"key": s.key, "title": s.title, "kind": s.kind,
                            "status": f"FAILED: {type(exc).__name__}", "rows": "", "cols": "",
                            "licence": s.license, "page": s.page, "notes": str(exc)[:200]})

    sum_csv = os.path.join(args.out, "SUMMARY.csv")
    with open(sum_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["key", "title", "kind", "status", "rows",
                                           "cols", "licence", "page", "notes"])
        w.writeheader()
        w.writerows(summary)

    lines = ["", "=" * 78, "SUMMARY", "=" * 78,
             f"{'KEY':<12}{'KIND':<10}{'STATUS':<22}{'ROWS':>10}  TITLE", "-" * 78]
    for r in summary:
        lines.append(f"{r['key']:<12}{r['kind']:<10}{str(r['status']):<22}"
                     f"{str(r['rows']):>10}  {r['title']}")
    lines += ["-" * 78, f"Output: {os.path.abspath(args.out)}",
              "Per-source columns + sample rows: <out>/<key>/_preview.txt", ""]
    text = "\n".join(lines)
    print(text)
    with open(os.path.join(args.out, "SUMMARY.txt"), "w", encoding="utf-8") as fh:
        fh.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
