# Calolean — AI Health Assistant

Train smarter. Eat cleaner. Get leaner. Calolean is an AI-powered food-tech app:
a ChatGPT-style assistant that scans food photos for verified nutrition data,
analyzes gym form on-device, and tracks diet, water, workouts, and steps —
monetized with contextual native ads, affiliate links, and subscriptions.

**Architecture, phase plan, costs, and ops runbook:** see [`PRODUCTION_UPGRADE.md`](./PRODUCTION_UPGRADE.md).

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind v4
- **Firebase** — Auth + Firestore (all user data, security-rules protected)
- **Google Cloud** — Vertex AI (Gemini 3.1 Flash-Lite), Cloud SQL Postgres (food + exercise reference data)
- **MediaPipe Tasks Vision** — pose analysis runs in the browser; videos never leave the device
- **Google AdSense** native in-article ads + Amazon affiliate links
- **Google Health API** — step sync (successor to the deprecated Google Fit)

## Getting started

```bash
npm install
cp .env.example .env.local   # paste your credentials (see comments per variable)
npm run dev
```

The app degrades gracefully while credentials are missing: Gemini falls back to
`GOOGLE_API_KEY`, the exercise library falls back to the open dataset, and food
verification falls back to live Open Food Facts lookups until the Cloud SQL
food database (built from USDA FoodData Central + Open Food Facts) is in place.

## Deployment

Production runs on **Google Cloud Run** from the included `Dockerfile`
(Next.js standalone output):

```bash
gcloud run deploy calolean --source . --region asia-south1 \
  --add-cloudsql-instances $CLOUD_SQL_CONNECTION_NAME \
  --allow-unauthenticated
```

See `NEXT_STEPS.md` for the full launch runbook (domain mapping, Secret
Manager, database seeding).

## Building the food + exercise database

The Cloud SQL reference data (foods, exercises) is built from free public
dumps via a CSV pipeline — see `scripts/dataprep/README.md` and **Step 3** of
`NEXT_STEPS.md`:

1. `python scripts/dataprep/{exercises,usda,off}_to_csv.py` → produces CSVs
2. `db/load/staging.sql` → create staging tables
3. `gcloud sql import csv` (or psql `\copy`) → load CSVs into staging
4. `db/load/transform.sql` then `db/migrations/004_form_reference.sql` → populate `foods` + `exercises`

## Useful scripts

| Script | Purpose |
|---|---|
| `firebase deploy --only firestore:rules,firestore:indexes` | Deploy Firestore security rules + indexes |

## Quality gates

```bash
npx eslint .       # lint
npx tsc --noEmit   # types
npm run build      # production build
```

CI runs all three on every push (`.github/workflows/ci.yml`).
