# Calolean — Free Food & Exercise Data Sources

A researched catalog of **free / low-cost** data sources for food macros and exercises that we can bulk-download or pull via API and store in our own Cloud SQL (Postgres) database — to expand coverage beyond what we already have.

**Already in use (excluded from this list):**
- **Food:** USDA FoodData Central, Open Food Facts
- **Exercise:** `yuhonas/free-exercise-db` (~800 exercises, 2 still photos each)

> ⚠️ = a licensing / commercial-use / storage caveat you must check before using the source in production. ⭐ = top recommendation.

---

## 1. How new data maps to our schema

Any new source only needs to be reshaped into the columns our pipeline already expects.

**Food** — table `foods` (`db/migrations/002_foods.sql`), values **per 100 g**:

```
source, external_id, canonical_name, brand, barcode, serving_desc,
calories_kcal, protein_g, carbs_g, fat_g, fiber_g
```

Ingestion flow (same as USDA/OFF):
1. Write `scripts/dataprep/<source>_to_csv.py` that emits the 11-column CSV with a **new `source` tag** (e.g. `INDB`, `COFID`, `CIQUAL`).
2. Load the CSV into `stg_foods` (`db/load/staging.sql`).
3. Add the new tag to the `source IN (...)` whitelist in `db/load/transform.sql` (~line 42) and run the transform.
4. (Optional) add the tag to `labelFor()` in `lib/server/food-db.ts` for distinct attribution — today every DB hit shows "Calolean Database".

**Exercise** — table `exercises` (`db/migrations/001_exercises.sql`):

```
id, name, muscle_group, body_part, equipment, gif_url,
secondary_muscles[], instructions (jsonb), form_reference (jsonb)
```

⚠️ **Two schema caveats for new exercise sources:**
- There is **no `difficulty` column** — sources that carry difficulty/level or MET need a small `ALTER TABLE`.
- Only a **single `gif_url`** is stored; multi-frame animation is fetched live by exercise **id** in `lib/server/exercise-db.ts`. A source that reuses free-exercise-db ids integrates most cleanly; a source with its own ids + real GIFs would need an images/frames column or a CDN of our own.

---

## 2. Recommended shortlist (commercial-safe, budget-aware, India-first)

**Food — download-and-own, commercial-friendly, real per-serving macros:**
1. **INDB (Indian Nutrient Databank)** ⭐ — CC BY 4.0; foods **+ 1,014 Indian recipes** with serving-size macros. Best India fit.
2. **IFCT 2017 (structured `nodef/ifct2017`)** — India generic ingredients; emits ready SQL INSERTs.
3. **UK CoFID** (Open Gov Licence), **France CIQUAL** (Etalab), **Canada CNF** (Open Gov Licence), **Norway Matvaretabellen** (open + free JSON API) — clean licenses, full macros incl. fiber, relational-friendly.
4. **Open Food Repo** (CC BY 4.0) — barcoded packaged products via free API.
5. **MenuStat** — free US restaurant-chain per-serving macros.

**Exercise — free & hostable today:**
- **wger** + **Everkinetic** (both CC-BY-SA, commercial + image hosting OK) for breadth with still images.
- **RepDB free** for **difficulty + MET** values (useful for calorie math).
- If **animated GIFs** are a hard requirement: budget for the **one-time ExerciseDB.io / Gym Visual dataset license** — that is the only clean way to host exercise GIFs commercially (see §4.A).

---

## 3. Food / nutrition macro sources

### A. Government / national food-composition tables
Bulk downloads of analytically-measured **generic** foods with full macros (incl. fiber) per 100 g — the strongest fit for "store in our own DB."

| # | Source | Link | Access | License (commercial / storage) | Coverage | Fields | Ingestion note |
|---|--------|------|--------|-------------------------------|----------|--------|----------------|
| 1 | **INDB – Indian Nutrient Databank** ⭐ | anuvaad.org.in/indian-nutrient-databank · github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- | Bulk (Excel) | **CC BY 4.0 — commercial + storage OK**, attribute | 1,095 foods **+ 1,014 Indian recipes** | Macros incl. fiber, **per 100 g and per serving**; recipe ingredient amounts + serving sizes | Parse Excel → foods + recipes tables. Best India source (cooked-dish macros) |
| 2 | **IFCT 2017 (structured)** | github.com/ifct2017/ifct2017 · npm `@ifct2017/compositions` · Kaggle `gijoe707/ifct2017` | Bulk (CSV/JSON) **+ SQL generator** | ICMR-NIN gov data; attribute "ICMR-NIN, IFCT 2017" (no explicit open license on official PDF) | 528–542 Indian generic foods, 151 components | kcal, protein, carbs, fat, **fiber**, + amino/fatty acids, vitamins, minerals; per 100 g | `compositions.sql()` emits INSERTs → drops straight into Postgres |
| 3 | **UK CoFID** (McCance & Widdowson's) | gov.uk → "composition of foods integrated dataset" | Bulk (Excel + CSV) | **Open Government Licence — commercial + redistribution OK**, attribute | ~2,900 foods, 185 nutrients | kcal, protein, carbs, fat, **fiber (AOAC & Englyst)**, full micros; per 100 g | Clean Excel/CSV → Postgres |
| 4 | **France CIQUAL (ANSES)** ⭐ | ciqual.anses.fr · Zenodo 2025 mirror | Bulk (Excel/XML) + webservice | **Etalab Licence Ouverte 2.0 — commercial OK worldwide**, attribute "Anses–Ciqual" | ~3,200 foods, 74 components | kcal, protein, carbs, fat, **fiber**, sugars, salt, vitamins, minerals; per 100 g | Excel/XML → Postgres; parse `< X` / trace ranges |
| 5 | **Canada — Canadian Nutrient File (CNF)** | canada.ca → Canadian Nutrient File 2015 · open.canada.ca | Bulk (relational CSV zip) | **Open Government Licence – Canada — commercial OK**, attribute | ~5,690 foods, 150+ nutrients | Full macros incl. **fiber**; per 100 g **+ measures/serving-conversion file** | Easiest to load — already normalized relational CSVs |
| 6 | **Norway — Matvaretabellen** ⭐ | matvaretabellen.no/en/api · data.norge.no | **Both** — XLSX/CSV/JSON download **+ free JSON API** | Open (NLOD-style) — commercial OK, attribute | ~1,700 foods | kcal, protein, carbs, fat, fiber, micros; per 100 g | Grab JSON dump → Postgres (trivial). Updated Jan 2026; no API key |
| 7 | **Australia — AFCD (FSANZ)** | foodstandards.gov.au → AFCD data files | Bulk (Excel) | ⚠️ FSANZ Data User Licence — commercial OK but **ShareAlike + extra DB terms**; derivatives share-alike | ~1,588 foods, up to 268 nutrients | Full macros incl. **fiber**, micros; per 100 g | Excel → Postgres; review share-alike clause |
| 8 | **Denmark — Frida (DTU)** | frida.fooddata.dk/data | Bulk (spreadsheet); **no API** | ⚠️ Free + attribution on every display; **redistribution rights not spelled out** — verify | 1,000+ foods | Energy, protein, carbs, fat, vitamins, minerals; per 100 g | Spreadsheet → Postgres |
| 9 | **New Zealand — FOODfiles** | foodcomposition.co.nz/foodfiles | Bulk via Windows installer | ⚠️ Copy/communicate with attribution **BUT "data must not be modified"** (awkward for reshaping) | 2,857 foods, 87–434 components | Full macros incl. fiber; per 100 g | Extract from installer; no-modify clause is a real constraint |
| 10 | **FAO / INFOODS** | fao.org/infoods | Bulk (Excel) | ⚠️ Free download; **some files CC BY-NC-SA IGO (non-commercial)** — check each | AnFood; BioFoodComp4.0 = 6,492 foods × 466 comp.; + directory to every national table | Macros + extensive micros; per 100 g | Use as gap-filler + to discover more country tables (Japan, Brazil TACO, Germany BLS…) |

### B. Free / freemium nutrition APIs
Verify two things before bulk-storing: (a) does the free tier permit **caching / permanent storage**, and (b) is **commercial use** allowed on the free tier.

| # | Source | Link | Free tier | License caveat | Coverage | Fields |
|---|--------|------|-----------|----------------|----------|--------|
| 11 | **FatSecret Platform API** ⭐ | platform.fatsecret.com/platform-api | **5,000 calls/day** (US data); "Premier Free" unlimited for startups/non-profits (verification) | ⚠️ Commercial OK, but ToS typically **restricts permanent caching** — must re-query | ~1.9M branded/restaurant/generic (global on paid) | Full per-serving macros incl. fiber, serving sizes, some micros |
| 12 | **Edamam Food & Grocery DB** | developer.edamam.com/food-database-api | 1,000 req/day, 50/min, 10 GB/mo | ⚠️ Free tier = **non-commercial / eval**; commercial + storage needs paid | 900k+ incl. barcode + NLP parsing | Per-serving macros incl. fiber, measure conversions, micros |
| 13 | **Spoonacular** | spoonacular.com/food-api/pricing | ~150 points/day (~50 calls) | ⚠️ Commercial requires paid; caching limited on free | 365k recipes, 4M products, 115k menu items | Full macros incl. fiber, per-serving; recipe→nutrition |
| 14 | **Chomp (ChompThis)** | chompthis.com/api | Free prototyping tier; prod ~$0.001/MAU | Commercial OK on paid; check storage terms | ~875k branded/barcode + ingredients | Nutrition label (per-serving macros incl. fiber), ingredients, allergens |
| 15 | **Suggestic** | suggestic.com/api.html | Free dev/sandbox (full features) | Commercial on paid plans | 7,000+ ingredients, 179 nutrients | Full macros + micros per serving; recipe-level |
| 16 | **API-Ninjas Nutrition** (ex-CalorieNinjas) | api-ninjas.com/api/nutrition | Free key, small monthly allowance | ⚠️ **No commercial use on free tier** (paid ~$39/mo) | 100,000+, NL query, US-centric | Per-serving/100g macros incl. fiber, sodium, sugar |
| — | **Nutritionix** | nutritionix.com/api | ❌ **Free tier discontinued** (now $50+/mo) | — | 800k+ branded/restaurant (best US menus) | Full per-serving macros |
| — | **Barcode Lookup** | barcodelookup.com/api | Trial then paid | Product catalog, not a nutrition DB | Huge UPC/EAN | ⚠️ Nutrition fields **sparse/inconsistent** — low priority |

### C. Open datasets / research databases

| # | Source | Link | Access | License | Coverage / Fields | Note |
|---|--------|------|--------|---------|-------------------|------|
| 17 | **Open Food Repo (FoodRepo, Swiss)** ⭐ | foodrepo.org/en/developers · github.com/digitalepidemiologylab/foodrepo_api | **Both** — REST API v3 (free key) + open data | **CC BY 4.0 — commercial + storage OK**, attribute | Barcoded packaged products (mostly Swiss) + images; per-serving/100g macros incl. fiber, sugar, salt | Paginate API → Postgres. Distinct from OFF |
| 18 | **MenuStat (NYC DOHMH)** ⭐ | menustat.org/data · data.cityofnewyork.us | Bulk (Excel/CSV) + Socrata JSON API | Public / NYC Open Data — commercial OK, attribute | ~100+ US chains, 2008–2017; item name, **serving size**, calories, fat, carbs, **fiber**, sugar, protein | CSV → Postgres; good US restaurant coverage |
| 19 | **Food.com recipes (Kaggle)** | kaggle.com → food-com-recipes | Bulk (CSV) | ⚠️ Per-uploader, often scraped (CC0/ODbL) — verify | Recipes **with a nutrition column** (calories, fat, sugar, sodium, protein, carbs as %DV) | Rough macros; provenance risk |
| 20 | **Indian Food Nutrition (Kaggle 2025)** | kaggle.com → indian-food-nutrition | Bulk (CSV) | ⚠️ Check per-uploader license | India dish macros | Gap-fill India dishes |
| 21 | **RecipeNLG** | kaggle.com → recipenlg | Bulk (CSV, 2.14 GB) | ⚠️ Academic (Poznań Univ.) — not clearly commercial | 2.23M recipes, ingredients + steps, **no reliable macros** | Text/NER only |
| — | **FooDB** | foodb.ca | Bulk (CSV/SQL/JSON) | ⚠️ **Non-commercial redistribution** (needs written permission) | 28,000+ compounds across 1,000+ foods | Food **chemistry**, not per-serving macros — skip for macros |

---

## 4. Exercise sources

> ⚠️ **Reality check on GIFs:** nearly every animated-GIF exercise set traces back to one commercial source, **Gym Visual (gymvisual.com)**. You can freely grab the *metadata*, but legally **hosting the GIFs commercially requires a paid one-time license**. The "free" GIF APIs do **not** convey redistribution/hosting rights.

### A. Animated GIF / video (the priority — media licensing flagged)

| # | Source | Link | Access | GIF/media license reality | Coverage | Fields |
|---|--------|------|--------|---------------------------|----------|--------|
| 1 | **ExerciseDB (RapidAPI)** | rapidapi.com/justin-WFnsXH_t6/api/exercisedb · exercisedb.io | API (free ~10 req/day in 2026) | ⚠️ GIFs **not open**; **buy one-time dataset license at exercisedb.io/pricing** to self-host + use commercially (may not resell raw dataset) | 1,300+ (Pro 1,500+) with **animated GIFs** | name, bodyPart, target + secondaryMuscles, equipment, instructions, GIF |
| 2 | **ExerciseDB open-source** (exercisedb.dev) | github.com/ExerciseDB/exercisedb-api · exercisedb.dev/docs | Self-host API (one-click Vercel) + free demo endpoint | ⚠️ Code **AGPL-3.0**; **GIFs served from their CDN (not cleanly yours)** — same Gym-Visual assets | 1,500–5,000 metadata | name, bodyPart, target/secondary, equipment, instructions, GIF refs |
| 3 | **hasaneyldrm/exercises-dataset** (LogPress) | github.com/hasaneyldrm/exercises-dataset | **Bulk download** (repo bundles GIFs + thumbs) | ⚠️ Metadata+text **MIT**; **GIFs/thumbs © Gym Visual** (reduced-res, keep attribution) — **need own Gym Visual license** to reuse media | **1,324** | id, name, category, bodyPart, equipment, target + secondary muscles, **instructions in 10 languages**, 180×180 thumb + GIF |
| 4 | **MuscleWiki** | api.musclewiki.com | Official **paid** API | ⚠️ Video/GIF demos, high quality; only clean via **paid API**. Unofficial scrapers (Saranjen, LeManhDuy) = **ToS/legal risk**, no license | 1,900+ | name, muscle/equipment, instructions, video/GIF |

### B. Still images — genuinely free & hostable (no animation)

| # | Source | Link | Access | License | Coverage | Bonus fields |
|---|--------|------|--------|---------|----------|--------------|
| 5 | **wger** ⭐ | wger.de/api/v2 · github.com/wger-project/wger | **Both** — free REST API (no key for reads) + self-host DB | **CC-BY-SA 3.0/4.0 — commercial + host images OK**, attribute + share-alike | ~690 exercises, ~286 images, multilingual | name, category, primary/secondary muscles, equipment, full instructions, per-item license. (Apify scraper exports CSV/JSON fast) |
| 6 | **Everkinetic** ⭐ | github.com/everkinetic/data | Bulk download (JSON + images) | **CC-BY-SA 4.0 — commercial OK**, attribute + share-alike | Several hundred, multi-pose illustrations (start/end) | name, muscles, equipment, step-by-step instructions |
| 7 | **RepDB free** (sergei-argutin) | github.com/sergei-argutin/exercise-dataset · repdb.co | Bulk (ZIP: JSON + WebP) | ⚠️ Commercial in-app OK **with attribution "Exercise data by RepDB"**; **no standalone redistribution** | 400 free (470+ paid) | multilingual names/instructions, primary/secondary muscles, equipment, mechanics, force, **MET values**, **difficulty**, 2-pose 512² WebP |

### C. Text / metadata only (enrichment, difficulty ratings)

| # | Source | Link | Access | License | Note |
|---|--------|------|--------|---------|------|
| 8 | **wrkout/exercises.json** | github.com/wrkout/exercises.json | Bulk (JSON; can emit SQL) | **Unlicense (public domain)** — no restrictions | force, **level (difficulty)**, mechanic, equipment, primary/secondary muscles, instructions. ⚠️ Overlaps free-exercise-db lineage |
| 9 | **API-Ninjas Exercises** | api-ninjas.com/api/exercises | API | ⚠️ **No commercial use on free tier** | name, type, muscle, difficulty, instructions, equipment, safety_info; **no media** |
| 10 | **Kaggle sets** (megaGymDataset ~2,900; Gym Exercises; "600K+ Fitness Exercise & Workout Program") | kaggle.com | Bulk (CSV) | ⚠️ Mixed / often unspecified or CC-BY-NC — check each; several scraped | Title, desc, type, bodypart, equipment, **level**, rating. Metadata gap-fill, not media |
| 11 | **Wikidata / Wikipedia** | query.wikidata.org (SPARQL) | API | CC0 | ⚠️ Sparse & inconsistent (few hundred, no standard schema/media) — **low value** |

---

## 5. License caution appendix

Sources whose **commercial storage / redistribution** is restricted or unclear — get sign-off before using in production:

- **FatSecret** — commercial OK but ToS generally **forbids permanent caching** (re-query model).
- **Edamam / Spoonacular** — **free tier is non-commercial**; commercial + storage needs a paid plan.
- **API-Ninjas** (Nutrition & Exercises) — **no commercial use on the free tier**.
- **Denmark Frida** — attribution required; redistribution rights **not explicitly granted**.
- **FAO/INFOODS** — some files are **CC BY-NC-SA IGO (non-commercial)**.
- **NZ FOODfiles** — **"data must not be modified"** (blocks reshaping into our schema as-is).
- **Australia AFCD** — **ShareAlike** + extra DB terms.
- **FooDB** — **non-commercial redistribution** (needs written permission); also it's food chemistry, not macros.
- **Kaggle/Food.com/RecipeNLG** — uploader-declared or academic licenses; **scraped-data provenance risk**.
- **Exercise GIFs** (ExerciseDB RapidAPI, exercisedb.dev, hasaneyldrm/LogPress, MuscleWiki) — all trace to **Gym Visual**; metadata is usable but **GIF hosting requires a paid license**. Cleanest commercial path: **one-time ExerciseDB.io / Gym Visual dataset license**, layered on free **wger + Everkinetic** CC-BY-SA imagery for breadth.

**Safest "download-and-own", commercial-friendly set:** INDB · IFCT-structured · CoFID · CIQUAL · Canada CNF · Norway Matvaretabellen · Open Food Repo · MenuStat (food) — and wger · Everkinetic · RepDB free (exercise).

---

*Compiled from deep web research (2025–2026 verified free tiers/licenses). A few caching/commercial terms (FatSecret, Edamam, Spoonacular, Frida, FAO-NC) were inferred from provider summaries — confirm the exact ToS text before bulk-storing commercially.*
