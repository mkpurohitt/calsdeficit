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
food database (seeded from USDA FoodData Central) is in place.

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

## Useful scripts

| Script | Purpose |
|---|---|
| `node scripts/seed_exercises_cloudsql.mjs` | Seed the Cloud SQL `exercises` table (run `db/migrations/*.sql` first) |
| `node scripts/seed_foods_usda.mjs` | Build the Calolean food database in Cloud SQL from the USDA FoodData Central bulk dump |
| `firebase deploy --only firestore:rules,firestore:indexes` | Deploy Firestore security rules + indexes |

## Quality gates

```bash
npx eslint .       # lint
npx tsc --noEmit   # types
npm run build      # production build
```

CI runs all three on every push (`.github/workflows/ci.yml`).
