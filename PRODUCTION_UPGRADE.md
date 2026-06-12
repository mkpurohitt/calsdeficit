# Calolean — Production Upgrade Blueprint

> **Status:** ✅ IMPLEMENTED (all code phases P0–P10). What remains is the manual
> console work listed in §6 — create the cloud resources, paste credentials into
> `.env.local` / Vercel using `.env.example`, run the migration/seed scripts, and
> the corresponding feature lights up. The app builds and runs with graceful
> fallbacks before any credentials are configured.
> **Scope of this document:** Everything needed to take the current app to full production launch — Google Cloud migration (Vertex AI, Cloud SQL, Firestore), the blueprint food-scan pipeline with native-ad monetization, on-device form analysis, Google Health API steps, entitlements, and production hardening.
> **Explicitly deferred (Phase 11+):** Food database bulk seeding (USDA / Open Food Facts / Kaggle), shop payment gateway + delivery APIs.

---

## 1. Product overview

Calolean is a food-tech AI assistant. Users chat with an LLM (ChatGPT-style homepage), upload **food photos** for nutrition analysis and **gym videos** for form analysis, track diet/water/workouts/steps, and browse a 1,300+ exercise muscle library.

**Revenue engine (per the production blueprint PDF):**
1. **Contextual Google native ads** — a clearly labeled "Sponsored" ad card at the end of every AI response (ChatGPT-ads style), contextually targeted using keywords Gemini emits in structured JSON. Privacy insulation rule: **only database-verified keywords ever leave the app to the ad network — never raw chat text.**
2. **Amazon affiliate links** — when the AI suggests improvements ("add high-protein paneer"), mapped keywords render as affiliate links.
3. **Subscriptions** — free tier (daily prompt limit + ads), premium tier (higher limits, no ads). Payments deferred; entitlement model built now.
4. **Shop** (future) — own food products; stays "coming soon".

**Cost engine:** client-side image compression guarantees flat 258-token image cost; pose ML runs on the user's own device; Gemini 3.1 Flash-Lite at $0.25/1M input, $1.50/1M output.

---

## 2. Target architecture

```
                     ┌──────────────────────────────────────────────┐
                     │                 BROWSER (PWA)                │
                     │  Next.js App Router UI (Vercel)              │
                     │  - Firebase Auth (email + Google)            │
                     │  - Firestore client SDK (own user data only) │
                     │  - lib/image-compress.ts (768px / 75% JPEG)  │
                     │  - @mediapipe/tasks-vision PoseLandmarker    │
                     │    (WASM, on-device joint-angle telemetry)   │
                     │  - AdSense native ad cards + Google CMP      │
                     │  - GA4 (@next/third-parties)                 │
                     └───────┬──────────────────────┬───────────────┘
              ID token (Bearer)                Firestore security rules
                     ┌───────▼──────────────┐   ┌───▼──────────────────┐
                     │ Next.js API routes   │   │ Firebase Firestore   │
                     │ (Node runtime)       │◄──┤ users/{uid}/...      │
                     │ firebase-admin:      │   │ goals, foodLogs,     │
                     │  verify token, usage │   │ workoutLogs, days,   │
                     │ /api/chat            │   │ formAnalyses, usage, │
                     │ /api/food-scan       │   │ subscription         │
                     │ /api/form-analysis   │   └──────────────────────┘
                     │ /api/exercises       │
                     │ /api/health/*        │   ┌──────────────────────┐
                     └───┬──────────┬───────┘   │ Cloud SQL Postgres   │
                         │          └──────────►│ exercises (1300+ ref)│
              service account creds             │ foods (USDA/OFF seed)│
                     ┌───▼──────────────────┐   │ nutrition_cache      │
                     │ Vertex AI (@google/  │   └──────────────────────┘
                     │ genai, vertexai:true)│
                     │ gemini-3.1-flash-lite│   ┌──────────────────────┐
                     │ (vision/scan/form),  │   │ Google Health API    │
                     │ stronger flash (chat)│   │ OAuth 2.0 (steps)    │
                     └──────────────────────┘   └──────────────────────┘

DEPRECATED BY THIS UPGRADE:
  Supabase (all tables) · ai-video-engine/ FastAPI+MediaPipe server · in-memory rate limit
```

**Division of responsibility**
- **Firestore** — all per-user data (goals, logs, days, usage counters, subscription). Client reads/writes its own subtree under security rules; sensitive fields (subscription, health tokens, usage) are admin-SDK-only.
- **Cloud SQL Postgres** — shared *reference* data only: exercises catalog, foods catalog, nutrition cache. Only API routes touch it.
- **Vertex AI** — all Gemini calls via the unified `@google/genai` SDK with `vertexai: true` and a service account. Model IDs live in env (`GEMINI_VISION_MODEL=gemini-3.1-flash-lite` — use the **GA id**, the preview id is discontinued 2026-07-09).
- **On-device** — image compression and pose landmark extraction never send heavy media to the server.

---

## 3. Phase plan

Ordering rationale: (a) data-layer abstraction before backend swap, (b) auth before anything trusts `user_id`, (c) Vertex SDK before features needing structured output, (d) Cloud SQL before features that read it (food verification degrades gracefully to live USDA/OFF APIs until seeded), (e) ads after scan keywords + consent + entitlements exist. **Every phase leaves the app deployable.**

| Phase | Title | Ships |
|---|---|---|
| P0 | Housekeeping & env scaffolding | no behavior change |
| P1 | Server auth + Firestore usage limits | security foundation |
| P2 | Data-layer abstraction + Firestore migration | user data off Supabase |
| P3 | Vertex AI migration (`@google/genai`) | off API-key Gemini |
| P4 | Cloud SQL reference DBs; Supabase fully removed | exercises live, foods interface |
| P5 | Food scan pipeline v2 | the blueprint pipeline |
| P6 | Entitlements (free/premium) | ad gating + limits |
| P7 | AdSense native ads + consent + affiliates | revenue on |
| P8 | On-device form analysis | Python server retired |
| P9 | Google Health API steps | steps without Fit API |
| P10 | Production hardening | launch-ready |
| P11 | LATER: food DB seeding, payments, delivery | out of scope here |

---

### Phase 0 — Housekeeping & env scaffolding

**Create**
- `.env.example` — full variable list (§8). *(Done in the same commit as this document.)*
- `lib/config/app.ts` — brand constants (name, domain, tagline, accent color), default tier limits.

**Modify**
- `.gitignore` — ensure `.env*` ignored except `.env.example`; ignore `*service-account*.json`.

**Delete**
- `test-supabase.js`, `test-supabase.mjs`, empty `types.ts`.

**Manual:** none.

---

### Phase 1 — Server-side auth + durable rate limiting

Today no API route verifies identity — `user_id` is read from the request body unverified, and rate limiting is an in-memory `Map` that resets on every serverless cold start. Both are launch blockers.

**Libraries:** `firebase-admin@^13`

**Create**
- `lib/server/firebase-admin.ts` — singleton (guard with `getApps().length`); credential from `JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString())`. Export `adminAuth`, `adminDb`. **Never import outside `lib/server/`** (server-only).
- `lib/server/auth.ts` — `requireUser(req)`: reads `Authorization: Bearer <idToken>`, `adminAuth.verifyIdToken()`, returns `{ uid, email }` or a 401 `Response`.
- `lib/server/usage.ts` — Firestore transaction on `users/{uid}/usage/{dateKey}` → `{ count, limit }`. Replaces `lib/rate-limit.ts`. Limit comes from tier config (expanded in P6).
- `lib/api-client.ts` — client fetch wrapper: `await auth.currentUser.getIdToken()` → attach header. All pages calling `/api/*` go through it.

**Modify**
- `app/api/chat/route.ts`, `app/api/food-scan/route.ts`, `app/api/food-logs/route.ts`, `app/api/workouts/route.ts`, `app/api/limit/route.ts` — derive `uid` from the verified token (stop trusting body `user_id`), call `usage.ts`, add `export const runtime = 'nodejs'` (firebase-admin is Node-only).
- `app/page.tsx` and other API callers — switch to `lib/api-client.ts`.

**Delete (end of phase):** `lib/rate-limit.ts`.

**Manual:** Firebase console → Project settings → Service accounts → Generate new private key → base64-encode into `FIREBASE_SERVICE_ACCOUNT_B64`.

---

### Phase 2 — Data-layer abstraction + Firestore migration

All user-data CRUD currently happens client-side through `lib/user-data.ts` (imported by 7 pages). Strategy: keep its exported function signatures 1:1, swap the implementation behind an interface, migrate, flip a flag.

**Create**
- `lib/data/types.ts` — record interfaces moved from `lib/user-data.ts` (keep field names: `food_name`, `protein_g`, `date_key`, …) so zero UI changes.
- `lib/data/store.ts` — the `UserDataStore` interface:

```ts
export interface UserDataStore {
  saveUserGoal(goal: UserGoalRecord): Promise<void>;
  getUserGoal(userId: string): Promise<UserGoalRecord | null>;
  addFoodLog(log: NewFoodLog): Promise<FoodLogRecord | null>;
  getFoodLogs(userId: string, range?: { from: string; to: string }): Promise<FoodLogRecord[]>;
  deleteFoodLog(userId: string, id: string): Promise<void>;          // userId added (Firestore path)
  saveWorkoutLog(log: NewWorkoutLog): Promise<WorkoutLogRecord | null>;
  getWorkoutLogs(userId: string, range?: { from: string; to: string }): Promise<WorkoutLogRecord[]>;
  saveFormAnalysis(r: NewFormAnalysis): Promise<void>;
  getFormAnalyses(userId: string): Promise<FormAnalysisRecord[]>;
  getDay(userId: string, dateKey: string): Promise<DayRecord | null>; // merges steps + water
  saveDay(userId: string, dateKey: string, patch: Partial<DayRecord>): Promise<void>;
  saveNotificationPreferences(r: NotificationPreferenceRecord): Promise<void>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferenceRecord>;
}
```

- `lib/data/supabase-store.ts` — current implementation lifted verbatim.
- `lib/data/firestore-store.ts` — Firestore client SDK implementation against the model in §5. `lib/firebase.js` **already exports an initialized `db`** — build on it.
- `lib/data/index.ts` — `export const store = process.env.NEXT_PUBLIC_DATA_BACKEND === 'firestore' ? firestoreStore : supabaseStore;`
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`.
- `scripts/migrate-supabase-to-firestore.mjs` — one-shot copy (small user base; no dual-write needed): read each Supabase table, write per-uid subcollections via firebase-admin.

**Modify**
- `lib/user-data.ts` — becomes a thin facade re-exporting `getDateKey` and delegating every function to `store`. The 7 importing pages need only two touch-ups: `deleteFoodLog` gains `userId`, steps/water move to `getDay`/`saveDay`.
- `getDateKey` must **only ever run client-side** (server would compute the UTC day and mis-bucket meals). Server endpoints accept the client's `date_key` and validate format `YYYY-MM-DD`.

**Rollout:** ship with flag=`supabase` → run migration script → flip flag to `firestore` → verify in prod → P4 removes Supabase.

**Manual:** Firebase console → enable Firestore (production mode; pick the region you'll also use for Cloud SQL, e.g. `us-central1` or `asia-south1`) → `firebase deploy --only firestore:rules,firestore:indexes`.

---

### Phase 3 — Vertex AI via `@google/genai`

**Libraries:** add `@google/genai@^1`; remove `@google/generative-ai` (deprecated SDK).

**Create**
- `lib/server/genai.ts`:

```ts
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID,
  location: process.env.VERTEX_LOCATION ?? 'global',
  googleAuthOptions: {
    credentials: JSON.parse(Buffer.from(process.env.GCP_SERVICE_ACCOUNT_B64!, 'base64').toString()),
  },
});
```

Helpers `chatModel()` / `visionModel()` read `GEMINI_CHAT_MODEL` (stronger flash for conversation) and `GEMINI_VISION_MODEL` (`gemini-3.1-flash-lite` for scans/form — the blueprint's cost target).

**Modify**
- `app/api/chat/route.ts` — swap to `ai.models.generateContent` call shape.
- `lib/food-analysis.ts` — same swap, plus `config: { responseMimeType: 'application/json', responseSchema }` instead of regex-stripping markdown fences.

**Manual:** GCP console → create/select project → enable **Vertex AI API** → create service account with `roles/aiplatform.user` → JSON key → base64 into `GCP_SERVICE_ACCOUNT_B64`. (Long-term improvement: Vercel OIDC Workload Identity Federation instead of long-lived keys — see Risks.)

---

### Phase 4 — Cloud SQL reference databases; Supabase removed

**Libraries:** `pg@^8`, `@google-cloud/cloud-sql-connector@^1` (IAM-authenticated connection from Vercel — no IP allowlisting).

**Create**
- `lib/server/cloudsql.ts` — lazy singleton `pg.Pool({ max: 2 })` (serverless!) via the connector; reads `CLOUD_SQL_CONNECTION_NAME`, `CLOUD_SQL_DB`, `CLOUD_SQL_USER`, `CLOUD_SQL_PASSWORD`.
- `db/migrations/001_exercises.sql`, `002_foods.sql`, `003_nutrition_cache.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE exercises (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, muscle_group TEXT, body_part TEXT,
  equipment TEXT, gif_url TEXT, secondary_muscles TEXT[] DEFAULT '{}',
  instructions JSONB DEFAULT '[]', form_reference JSONB   -- ideal joint angles/cues (P8)
);
CREATE INDEX exercises_name_trgm ON exercises USING gin (name gin_trgm_ops);
CREATE INDEX exercises_muscle ON exercises (muscle_group);

CREATE TABLE foods (                      -- seeded in P11; queried via food-db.ts from P5
  id BIGSERIAL PRIMARY KEY, canonical_name TEXT NOT NULL, search_name TEXT NOT NULL,
  source TEXT NOT NULL,                   -- 'USDA' | 'OFF'
  external_id TEXT, barcode TEXT,
  calories_kcal NUMERIC, protein_g NUMERIC, carbs_g NUMERIC, fat_g NUMERIC, fiber_g NUMERIC,
  serving_desc TEXT, updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX foods_search_trgm ON foods USING gin (search_name gin_trgm_ops);

CREATE TABLE nutrition_cache (            -- port of the Supabase table
  search_key TEXT PRIMARY KEY, payload JSONB NOT NULL, source TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

- `lib/server/exercise-db.ts` — typed queries replacing the Supabase queries in the chat + exercises routes (`ilike` → `ILIKE`, muscle OR-filters → `= ANY(...)` / trigram).
- `lib/server/food-db.ts` — **the verification interface (designed now, seeded later)**:
  `verifyFood(searchName)` → `{ verified: boolean, match?: FoodRecord, source: 'cloudsql' | 'usda' | 'off' | 'none' }`.
  Rule: trigram similarity ≥ 0.45 against `foods.search_name` ⇒ `verified=true`, DB macros override AI estimates. Else fall back to the existing live `fetchUSDA` / `fetchOpenFoodFacts` (moved here from `lib/food-analysis.ts`; an exact USDA hit still shows the verified badge, labeled by source). Else Gemini estimate with `verified=false`. Results cached in `nutrition_cache`.
- `scripts/seed_exercises_cloudsql.mjs` — seeds the **fully enriched** dataset (gif_url, instructions, secondary_muscles baked in) so the runtime GitHub JSON fetch in `lib/exercise-catalog.ts` — a hidden production dependency — can be deleted.

**Modify:** `app/api/exercises/route.ts`, `app/api/chat/route.ts` (exercise lookup), `lib/food-analysis.ts` (nutrition cache → Cloud SQL).

**Delete:** `lib/supabase.ts`, `lib/data/supabase-store.ts` + the backend flag, `lib/exercise-catalog.ts`, `supabase/` dir, `@supabase/supabase-js` dependency. `app/api/food-logs` and `app/api/workouts` routes: pages already write via the client store, so **delete them** (keep `/api/workouts` only if server-side validation is wanted; note it currently lets `user_id:'guest'` through — see Risks).

**Manual:** GCP → Cloud SQL → create PostgreSQL 16 instance (smallest Enterprise: 1 shared vCPU / 0.6 GB; public IP is fine — the connector handles auth, no authorized networks needed) → create DB `calolean` + user → grant the service account `roles/cloudsql.client` → run migrations + seed script locally.

---

### Phase 5 — Food scan pipeline v2 (the blueprint pipeline)

End-to-end flow per the production blueprint PDF:

1. **Client compression** — `lib/image-compress.ts`: canvas resize so `max(width, height) ≤ 768px`, `toBlob('image/jpeg', 0.75)`. Guarantees single-tile processing = **exactly 258 input tokens** per image (avoids Gemini's multi-tile billing fallback on dense photos). Used before *any* upload in `app/page.tsx` and `app/diet/page.tsx`.
2. **Structured Gemini call** — one vision call with `responseSchema`:

```json
{
  "type": "object",
  "properties": {
    "food_identified":      { "type": "string" },
    "confidence_score":     { "type": "number" },
    "suggested_ad_keywords":{ "type": "array", "items": { "type": "string" } },
    "structured_review": {
      "type": "object",
      "properties": {
        "rating_out_of_10": { "type": "number" },
        "summary":          { "type": "string" },
        "improvement_suggestions": {
          "type": "array",
          "items": { "type": "object", "properties": {
            "tip": { "type": "string" }, "product_keyword": { "type": "string" } } }
        }
      }
    },
    "nutrition": { "type": "object", "properties": {
      "calories": {"type":"number"}, "protein_g": {"type":"number"},
      "carbs_g": {"type":"number"}, "fat_g": {"type":"number"},
      "fiber_g": {"type":"number"}, "portion": {"type":"string"} } }
  },
  "required": ["food_identified", "suggested_ad_keywords", "structured_review"]
}
```

3. **Database verification** — `verifyFood()` from P4; verified macros override estimates.
4. **Render** — `components/FoodScanCard.tsx`: "✓ DATABASE VERIFIED MATCH" badge (lime accent, only when verified), calories/macros grid, **AI Rating x/10**, improvement suggestions with affiliate links, then the ad-card slot **last** (commercial content never interrupts core value — blueprint wireframe rule).

**Create:** `lib/image-compress.ts`, `lib/schemas/food-scan.ts` (zod schema + Gemini responseSchema, single source of truth), `lib/config/affiliate-links.ts` (config-driven `keyword → { label, amazonUrl }` using `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG`; **only keywords present in this map render links** — privacy + Amazon ToS insulation), `components/FoodScanCard.tsx`.

**Modify:** `lib/food-analysis.ts` (full rewrite around the schema → `FoodScanResultV2`), `app/api/food-scan/route.ts` + `app/api/chat/route.ts` (food mode returns v2 shape), `app/page.tsx` + `app/diet/page.tsx` (render `FoodScanCard`), food log records gain `verified: boolean`, `confidence: number`.

---

### Phase 6 — Entitlements (before ads, so ads are gateable on day one)

**Create**
- `lib/entitlements.ts` — shared tier config:
  `{ free: { dailyPrompts: 10, ads: true }, premium: { dailyPrompts: 100, ads: false } }`
- `lib/server/entitlements.ts` — read `users/{uid}` subscription via admin SDK; default `free`.
- `components/UpgradeBadge.tsx` — profile CTA (payment integration LATER).

**Modify:** `lib/server/usage.ts` (limit from tier), `/api/limit` (returns tier), `app/profile/page.tsx` (show tier). Firestore rules: subscription writable **only** by the admin SDK — recommended pattern: keep `subscription` and `healthConnect` in a parallel `private/{uid}` collection that denies all client access (simpler than field-level guards).

---

### Phase 7 — AdSense native ads + consent + affiliate links

**Create**
- `public/ads.txt` — `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`
- `components/ads/AdCard.tsx` — the ChatGPT-style "Sponsored"-labeled card wrapping an `<ins class="adsbygoogle">` native in-article unit. Lazy: `adsbygoogle.push({})` only when the card nears the viewport (IntersectionObserver). Contextual targeting input is **exclusively** the `suggested_ad_keywords` that survived DB verification — never raw chat text (blueprint's context-isolation table; also the AdSense-policy compliance mechanism). Hidden entirely for premium tier and when consent is denied.
- `components/ads/ConsentManager.tsx` — Google CMP (Funding Choices) script; gates AdSense loading on TCF consent state.

**Modify:** `app/layout.tsx` (AdSense + CMP via `next/script` `strategy="lazyOnload"`, Google Consent Mode defaults), `app/page.tsx` (AdCard after AI responses), `components/FoodScanCard.tsx` (ad slot), form-analysis result UI (P8).

**Manual:** AdSense account → add site → **approval review** (needs a live site with substantive content + real privacy policy — apply right after P10's legal pages ship; see Risks for AI-content policy) → create native in-article ad unit → slot ID into env → configure the Funding Choices CMP message for EEA/UK.

---

### Phase 8 — On-device form analysis

Replaces the Python FastAPI microservice (currently a hardcoded `http://localhost:8000/analyze-form` call at `app/exercise/page.tsx:164` — broken in production). Video never leaves the device: MediaPipe runs in-browser, only a compact telemetry JSON (~2–5 KB) goes to the backend. Server cost per analysis ≈ $0.001.

**Libraries:** `@mediapipe/tasks-vision@^0.10`

**Create**
- `lib/pose/loader.ts` — **dynamic-import-only** loader (never top-level imported); WASM via `FilesetResolver.forVisionTasks` CDN; `pose_landmarker_lite.task` model URL constant; cache model in CacheStorage.
- `lib/pose/telemetry.ts` — per-frame joint angles (knee/hip/elbow/shoulder/spine lean), rep segmentation, downsampled telemetry summary (e.g. `"Left Knee ROM: 150° → 80°"` per the blueprint).
- `components/FormCheckPanel.tsx` — video element + landmark overlay canvas + progress; extracted from the inline logic in `app/exercise/page.tsx`.
- `app/api/form-analysis/route.ts` — auth + usage check → load `form_reference` for the exercise from Cloud SQL → Vertex Gemini structured output `{ score_out_of_100, verdict, corrections[], suggested_ad_keywords[] }` → persist to `users/{uid}/formAnalyses` via admin → return (with ad keywords for the AdCard).
- `db/migrations/004_form_reference.sql` — per-exercise ideal-angle JSON for the common lifts (squat, deadlift, bench, OHP, rows, curls…).

**Modify:** `app/exercise/page.tsx` — on-device pipeline + new API.

**Deprecate:** `ai-video-engine/` — add `ai-video-engine/DEPRECATED.md`; remove root `requirements.txt`; keep code for reference.

---

### Phase 9 — Google Health API steps

Google Fit REST API is deprecated (shutdown end-2026, signups closed since 2024). The replacement for web is the **Google Health API** (REST, OAuth 2.0 web-server flow; surfaces Fitbit / Pixel Watch / connected-device data).

**Create**
- `app/api/health/connect/route.ts` — builds the OAuth consent URL.
- `app/api/health/callback/route.ts` — code → tokens; refresh token AES-GCM-encrypted with `TOKEN_ENCRYPTION_KEY`, stored in the admin-only private doc.
- `app/api/health/sync/route.ts` — pulls daily steps → `users/{uid}/days/{dateKey}.steps` (`steps_source: 'google-health'`).
- `lib/server/google-health.ts` — token refresh + data fetch helpers.

**Modify:** `app/profile/google-fit/page.tsx` → rebrand UX to "Google Health" with connect/disconnect/sync; `app/exercise/page.tsx` steps widget reads `days/{dateKey}`.

**Manual:** GCP → OAuth consent screen (External) → enable Google Health API → create OAuth **web** client (redirect `https://<domain>/api/health/callback`) → **submit for restricted-scope verification — takes weeks; start during P5–P7**, it's the longest external lead time alongside AdSense approval.

---

### Phase 10 — Production hardening & launch

**Create:** `public/manifest.webmanifest` + brand icons (lime/navy), `app/sitemap.ts`, `app/robots.ts`, OG image (static or dynamic route), `components/Skeleton.tsx` (ring/card/list variants per `DESIGN_DESKTOP.md`), `app/error.tsx`, `app/not-found.tsx`, `.github/workflows/ci.yml` (lint + `tsc --noEmit` + `next build`), `lib/analytics.ts` (GA4 event helpers).

**Modify**
- `app/layout.tsx` — full `metadata` export (title template, description, OG/Twitter, canonical, themeColor), `<GoogleAnalytics gaId>` from `@next/third-parties@^16`, manifest link.
- Complete stubbed pages: `profile/personal-info` (edit profile → Firestore), `profile/notifications` (wire prefs), `profile/privacy-security` (password change + delete-account flow via Firebase), `profile/export` (client-side CSV from Firestore data), `exercise/[id]` (full detail: gif, instructions, secondary muscles, log-set form, history).
- Replace placeholder legal copy in privacy-policy/terms with real text covering: AI processing of photos/videos, on-device processing claim, Firestore storage, AdSense cookies/personalization, affiliate disclosure, Google Health data handling. **Required before the AdSense application.**

**Delete:** remaining dead code, unused template assets (`public/next.svg` etc.).

---

### Phase 11 — Deferred (separate efforts, not this upgrade)

- **Food DB bulk seeding** — USDA FoodData Central + Open Food Facts dumps (+ Kaggle sets) into the `foods` table; dedup/canonicalization pipeline. Until then `verifyFood()` serves live API lookups.
- **Payments** (Razorpay/Stripe) wiring into the entitlement model; **shop** catalog + delivery API.
- **Native Android app** — also unlocks Health Connect for steps from any phone.

---

## 4. Firestore data model

```
users/{uid}                                  (doc)
  profile: { displayName, email, photoURL, age, weight_kg, height_cm, createdAt }
  goal: { goal, daily_calories, protein_g, carbs_g, fat_g, updatedAt }
  notificationPrefs: { meal_reminders, workout_reminders, weekly_summary }

private/{uid}                                (ADMIN-SDK ONLY — rules deny all client access)
  subscription: { tier: 'free'|'premium', status, updatedAt }
  healthConnect: { status, scopes, refreshTokenEnc, connectedAt }

users/{uid}/foodLogs/{autoId}     { food_name, portion, calories, protein_g, carbs_g,
                                    fat_g, fiber_g, meal_type, health_tip, source,
                                    verified, confidence, date_key, createdAt }
users/{uid}/workoutLogs/{autoId}  { exercise_id, exercise_name, muscle_group, sets,
                                    reps, weight_lbs, date_key, loggedAt }
users/{uid}/formAnalyses/{autoId} { exercise_id, exercise_name, score, corrections[],
                                    telemetrySummary, createdAt }
users/{uid}/days/{dateKey}        { steps, steps_source, water_ml, updatedAt }
users/{uid}/usage/{dateKey}       { count, limit, updatedAt }   // ADMIN-SDK ONLY writes
```

**Composite indexes:** `foodLogs(date_key asc, createdAt asc)`, `workoutLogs(date_key asc, loggedAt asc)`.

**Rules skeleton:**

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /users/{uid}/usage/{day} {
  allow read: if request.auth.uid == uid;
  allow write: if false;                  // admin SDK only
}
match /private/{uid}/{document=**} {
  allow read, write: if false;            // admin SDK only
}
```

---

## 5. Unit economics (cost model)

| Item | Math | Cost |
|---|---|---|
| Food scan (`gemini-3.1-flash-lite`, $0.25/$1.50 per 1M) | 258 img + ~350 prompt in, ~300 structured out | **≈ $0.0006/scan** → 1,000 scans/day ≈ $18/mo |
| Chat message (stronger flash, ≈$0.50/$3.00 per 1M) | ~1.5k in / 500 out | ≈ $0.0023/msg; 10 free msgs/day × 500 DAU ≈ $345/mo worst case — **the free-tier limit is the cost governor** |
| Form analysis (flash-lite) | telemetry ~1.5k in / 400 out; video never uploaded | ≈ $0.001/analysis |
| Cloud SQL (smallest Enterprise) | fixed | ≈ $9–15/mo (biggest fixed cost; can pause until food seeding) |
| Firestore | free tier 50k reads / 20k writes/day | $0 early on (keep date-range filters! §7.6) |
| Vercel | Hobby/Pro | $0 / $20 |
| MediaPipe, AdSense, GA4, Health API | — | $0 |

Revenue side per the blueprint: native health-niche ad CPMs ~ $12 ⇒ ~$0.012/ad impression vs ~$0.0006 scan cost ⇒ **~1,700% margin per ad-monetized scan**, plus affiliate commissions.

---

## 6. Manual console work vs. code, per phase

| Phase | You do in consoles | Code does |
|---|---|---|
| P1 | Firebase service-account key | token verify, Firestore usage counters |
| P2 | Enable Firestore, deploy rules/indexes | store abstraction + migration script |
| P3 | GCP project, enable Vertex AI, SA + `roles/aiplatform.user` | SDK swap |
| P4 | Create Cloud SQL instance/db/user, `roles/cloudsql.client`, run migrations + seed | query layer, Supabase removal |
| P7 | AdSense signup + site approval + ad unit + CMP message | ad components, ads.txt, consent gating |
| P9 | OAuth client, **restricted-scope verification (start weeks early)** | OAuth routes, sync |
| P10 | GA4 property, custom domain, Vercel env vars | everything else |

---

## 7. Risks & gotchas

1. **Vertex auth on Vercel** — no GCP metadata server; file-path `GOOGLE_APPLICATION_CREDENTIALS` doesn't work. Use `googleAuthOptions.credentials` from the base64 env var. Long-term: Vercel OIDC → Workload Identity Federation (no long-lived keys). All routes touching firebase-admin/Vertex: `runtime = 'nodejs'`.
2. **Cloud SQL from serverless** — connection exhaustion. Lazy singleton `pg.Pool({ max: 2 })`; the connector handles TLS/IAM. Escape hatch if it bites: deploy the Next app to Cloud Run (private IP, min-instances).
3. **Model IDs are env-driven** — confirm `gemini-3.1-flash-lite` (GA) availability in `VERTEX_LOCATION` (`global` endpoint recommended). The preview id is discontinued 2026-07-09; a model rename must be a config change, not a code change.
4. **AdSense policy on AI content** — approval needs substantive publisher content + a real privacy policy (ship P10 legal pages before applying). Ads must be clearly labeled "Sponsored" and never interleaved to look like AI output. Never pass raw user text to ad calls — only the DB-verified keyword whitelist (the blueprint's privacy insulation doubles as the compliance mechanism). A chat-heavy SPA may get rejected initially; the diet/exercise/library pages improve odds.
5. **MediaPipe bundle** — ~3 MB WASM + ~5.5 MB lite model. `await import()` only when the user taps Form Check; cache the model in CacheStorage; degrade gracefully where WASM/SIMD fails; test iOS Safari (worst performer).
6. **Firestore read amplification** — today `getFoodLogs` fetches ALL logs on every page load. The new store interface takes a `date_key` range; use it everywhere or Firestore read costs creep.
7. **`getDateKey` timezone** — must always be computed client-side; server endpoints accept and validate the client's `date_key` (`YYYY-MM-DD`), never recompute it (UTC mis-bucketing).
8. **Migration safety** — keep the `NEXT_PUBLIC_DATA_BACKEND` flag until Firestore is verified in production; keep the Supabase project alive (read-only) until P4 completes.
9. **Google Health restricted scopes** — OAuth verification review takes weeks and needs a demo video + privacy policy. Kick it off during P5–P7, not at P9.
10. **firebase-admin hygiene** — guard `getApps().length` against hot-reload re-init; never import into client bundles (everything under `lib/server/`).
11. **Guest-user gap** — `/api/workouts` currently accepts `user_id: 'guest'`. P1's auth gate closes this; the rate-limit semantics change to per-uid per-day Firestore transactions.

---

## 8. Environment variables

See `.env.example` in the repo root — every variable, grouped by phase, with a comment saying where to obtain it. Paste real values into `.env.local` (never committed) and mirror them in Vercel → Project → Settings → Environment Variables.

## 9. Library changes

| Library | Version | Why |
|---|---|---|
| `@google/genai` | `^1` | Unified SDK; one code path for Vertex (`vertexai:true` + SA) and API-key dev; replaces deprecated `@google/generative-ai` |
| `firebase-admin` | `^13` | ID-token verify, admin Firestore, usage transactions |
| `pg` / `@google-cloud/cloud-sql-connector` | `^8` / `^1` | IAM-auth Cloud SQL from serverless, no IP allowlists |
| `@mediapipe/tasks-vision` | `^0.10` | On-device PoseLandmarker (WASM) |
| `zod` | `^3` | API body + Gemini response validation |
| `@next/third-parties` | `^16` | GA4 component matching Next 16 |
| **remove** | `@google/generative-ai`, `@supabase/supabase-js`, `dotenv` | replaced / Next loads `.env` natively |
