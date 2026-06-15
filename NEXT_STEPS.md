# Calolean — Launch Runbook (NEXT STEPS)

**Last updated:** 12 June 2026 (rev. 2 — Google Cloud hosting, self-hosted food database)
**Audience:** you (the founder). Every step below is a manual task only you can do — creating accounts, getting keys, passing reviews. The code is done; this document turns it into a live product at **https://calolean.com**.

**Architecture decisions baked into this revision:**
- Hosting is **Google Cloud Run** (Docker image, included `Dockerfile`) — everything lives in one Google Cloud project. No Vercel.
- There is **no live USDA API**. The Calolean food database is built from the USDA FoodData Central + Open Food Facts data dumps into Cloud SQL (prepare CSVs with `scripts/dataprep/*.py`, load via `db/load/*.sql`); food verification hits our own database first and falls back to live Open Food Facts only as a last resort.

**How to use this document:** work top-to-bottom. Steps are ordered so that the slowest approvals (AdSense ~2–4 weeks, Google Health OAuth verification ~weeks) are kicked off as early as possible. Each step says exactly which `.env` variable it produces — keep a local `.env.local` as the master copy; production values go into Cloud Run (Step 4).

**Estimated monthly cost at launch scale:** ~₹2,000–4,000 (Cloud SQL smallest instance ~₹1,500–2,500 + Cloud Run with min-instances=1 ~₹500–1,500; Firebase, Vertex AI usage, GA4 are ~₹0 at low traffic). Set the budget alert in Step 2.

---

## Progress tracker

| # | Step | Wait time | Status |
|---|------|-----------|--------|
| 1 | Firebase project (auth + user data) | none | ☐ |
| 2 | Google Cloud + Vertex AI (the AI brain) | none | ☐ |
| 3 | Cloud SQL + build the Calolean food & exercise database | ~1 h hands-on | ☐ |
| 4 | Deploy to Cloud Run + point calolean.com | DNS up to 24 h | ☐ |
| 5 | Google Analytics 4 | none | ☐ |
| 6 | Amazon Associates (affiliate income) | approval after 3 sales | ☐ |
| 7 | Google Health API (steps sync) | **verification: weeks — start early** | ☐ |
| 8 | Google AdSense (ad income) | **review: 2–4 weeks — apply early** | ☐ |
| 9 | Final launch checklist | half a day | ☐ |

---

## Step 1 — Firebase project (user accounts + their data)

Firebase gives Calolean its login system (email + Google sign-in) and the Firestore database that stores each user's food logs, water, weight, and settings.

**Cost:** free at this stage (the Blaze upgrade happens automatically with billing in Step 2; still ₹0 at low usage).

1. ☐ Go to https://console.firebase.google.com and sign in with the Google account you want to own the business (a dedicated `admin@calolean.com` via Google Workspace, or your personal account to start).
2. ☐ Click **Create a project** → name it `calolean` → disable Google Analytics here (we set up GA4 separately in Step 5) → Create.
3. ☐ **Register the web app:** Project Overview → click the **`</>`(Web)** icon → nickname `calolean-web` → do NOT tick Firebase Hosting → Register. Copy the `firebaseConfig` values into `.env.local`:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`
4. ☐ **Enable sign-in methods:** Build → **Authentication** → Get started → Sign-in method tab:
   - Enable **Email/Password** (just the toggle).
   - Enable **Google** → public-facing name `Calolean` + support email → Save.
5. ☐ **Authorized domains:** Authentication → Settings → Authorized domains → add `calolean.com` (after Step 4, also add the `*.run.app` URL Cloud Run gives you, for testing).
6. ☐ **Enable Firestore:** Build → **Firestore Database** → Create database → **Production mode** → location `asia-south1 (Mumbai)` (cannot be changed later) → Create.
7. ☐ **Deploy the security rules and indexes** (already in the repo: `firestore.rules`, `firestore.indexes.json`):
   ```bash
   npm install -g firebase-tools
   firebase login
   cd <your clone of the calsdeficit repo>
   firebase use --add        # pick the calolean project, alias "default"
   firebase deploy --only firestore:rules,firestore:indexes
   ```
8. ☐ **Server credentials (Admin SDK):** ⚙️ Project settings → **Service accounts** tab → **Generate new private key** → JSON downloads. Convert to one base64 line:
   ```bash
   base64 -w0 path/to/downloaded-key.json     # macOS: base64 -i path/to/key.json
   ```
   → `FIREBASE_SERVICE_ACCOUNT_B64`
   ⚠️ Never commit the JSON or base64 string to git. Keep the JSON in a password manager, delete from Downloads.

**Produces:** `NEXT_PUBLIC_FIREBASE_*` (6 vars), `FIREBASE_SERVICE_ACCOUNT_B64`

---

## Step 2 — Google Cloud + Vertex AI (food scanning, chat, form analysis)

Firebase projects ARE Google Cloud projects — reuse the same `calolean` project for everything: Vertex AI (Gemini), Cloud SQL, Cloud Run hosting, Secret Manager.

**Cost:** Gemini Flash-Lite is ~₹0.01–0.04 per food scan; expect under ₹500/month until thousands of daily scans.

1. ☐ https://console.cloud.google.com → top project picker → select **calolean**.
2. ☐ **Enable billing:** ☰ → Billing → link a billing account (credit/debit card). Then set a **budget alert**: Billing → Budgets & alerts → Create budget → ₹3,000/month, email alerts at 50/90/100%.
3. ☐ **Enable the APIs** (visit each with the calolean project selected, click Enable):
   - Vertex AI API: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com
   - Cloud SQL Admin API: https://console.cloud.google.com/apis/library/sqladmin.googleapis.com
   - Cloud Run Admin API: https://console.cloud.google.com/apis/library/run.googleapis.com
   - Cloud Build API: https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com
   - Artifact Registry API: https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com
   - Secret Manager API: https://console.cloud.google.com/apis/library/secretmanager.googleapis.com
4. ☐ **Create the server service account:** ☰ → IAM & Admin → Service Accounts → **Create service account**:
   - Name: `calolean-server`
   - Grant roles: **Vertex AI User** and **Cloud SQL Client**
   - Done → open it → **Keys** tab → Add key → JSON → download.
5. ☐ Base64 it → `GCP_SERVICE_ACCOUNT_B64`. Also set:
   - `GCP_PROJECT_ID` = the project ID shown in the console
   - `VERTEX_LOCATION=global`, `GEMINI_CHAT_MODEL=gemini-3.1-flash`, `GEMINI_VISION_MODEL=gemini-3.1-flash-lite` (defaults — leave as is)
6. ☐ **Sanity check models:** https://console.cloud.google.com/vertex-ai/model-garden → search "Gemini 3.1 Flash" → available without an access request. (If a newer generation exists, just change the two `GEMINI_*` vars — no code change.)
7. ☐ (Optional fallback during setup) `GOOGLE_API_KEY` from https://aistudio.google.com/apikey — public Gemini API fallback if Vertex is misconfigured. Remove later.
8. ☐ Install the gcloud CLI on your machine: https://cloud.google.com/sdk/docs/install → `gcloud init` → pick the calolean project. (Or do everything from Cloud Shell in the browser — the `>_` icon — which has gcloud preinstalled.)

**Produces:** `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_B64`, (`VERTEX_LOCATION`, `GEMINI_*` defaults), optional `GOOGLE_API_KEY`

---

## Step 3 — Cloud SQL + build the Calolean food & exercise database

One PostgreSQL instance holds: the **Calolean food database** (built from the USDA FoodData Central + Open Food Facts data dumps — this replaces any live USDA API), the exercise catalog (from free-exercise-db), the shared nutrition cache, and form-check reference angles. User personal data stays in Firestore.

The data pipeline is: **`scripts/dataprep/*.py` → CSVs → Cloud SQL staging tables → `db/load/transform.sql`.** You prepare and eyeball the CSVs locally first (you've already done this), then load them.

> ⚠️ **Instance sizing.** If you load the *full* USDA Branded + Open Food Facts sets (millions of rows + a trigram index), the smallest `db-f1-micro` will be slow and may run out of memory building the index. For the full datasets, pick at least a **2 vCPU / 8 GB** instance (~₹6,000–9,000/mo) for the load, then you can scale it down afterward. If you stick to the **generic whole-foods** sets (USDA Foundation + SR Legacy + Survey ≈ 20–30k foods), `db-f1-micro` (~₹1,500–2,500/mo) is fine. Decide based on whether you need branded/packaged products.

1. ☐ https://console.cloud.google.com/sql → **Create instance** → **PostgreSQL**:
   - Instance ID `calolean-db`; set + **save** a strong postgres password
   - Version **PostgreSQL 16**; region `asia-south1`; single zone
   - Tier: `db-f1-micro` for generic foods only, **or** a 2 vCPU / 8 GB tier if loading the full branded/OFF sets (see the warning above)
   - Connections: Public IP is fine (the app connects through the Cloud SQL connector with IAM)
   - Create (~10 min).
2. ☐ Copy the **Connection name** (`calolean:asia-south1:calolean-db`) → `CLOUD_SQL_CONNECTION_NAME`.
3. ☐ **Databases** tab → Create database `calolean` (keep the default **UTF8** encoding — required for the exercise instructions) → `CLOUD_SQL_DB=calolean`.
4. ☐ **Users** tab → Add user `calolean_app` + strong password → `CLOUD_SQL_USER`, `CLOUD_SQL_PASSWORD`.
5. ☐ **Create the schema + staging tables** — open Cloud Shell (`>_` icon, top right):
   ```bash
   git clone https://github.com/mkpurohitt/calsdeficit.git && cd calsdeficit
   gcloud sql connect calolean-db --user=calolean_app --database=calolean
   # in psql, run in order:
   \i db/migrations/001_exercises.sql
   \i db/migrations/002_foods.sql
   \i db/migrations/003_nutrition_cache.sql
   \i db/load/staging.sql
   \q
   ```
6. ☐ **Prepare the CSVs locally** (you've validated these already). On your machine:
   ```powershell
   python scripts/dataprep/exercises_to_csv.py
   python scripts/dataprep/usda_to_csv.py --dir "C:\path\to\usda_folder"
   python scripts/dataprep/off_to_csv.py  --file "C:\path\to\en.openfoodfacts.org.products.csv.gz"
   ```
   You now have `exercises.csv`, `usda_foods.csv`, `off_foods.csv`.
7. ☐ **Load the CSVs into the staging tables.** Two ways — use **A** for the big food files, **B** is fine for the small exercises file:

   **A) Recommended for large files — import via a Cloud Storage bucket:**
   ```bash
   # one-time bucket
   gcloud storage buckets create gs://calolean-data --location=asia-south1
   # upload (run from where your CSVs are)
   gcloud storage cp exercises.csv usda_foods.csv off_foods.csv gs://calolean-data/
   # grant the Cloud SQL service account read access (the console will name it if this errors)
   # then import each CSV into its staging table:
   gcloud sql import csv calolean-db gs://calolean-data/usda_foods.csv --database=calolean --table=stg_foods --quiet
   gcloud sql import csv calolean-db gs://calolean-data/off_foods.csv  --database=calolean --table=stg_foods --quiet
   gcloud sql import csv calolean-db gs://calolean-data/exercises.csv  --database=calolean --table=stg_exercises --quiet
   ```

   **B) Simpler for small files — psql `\copy` (streams from your machine):**
   ```bash
   gcloud sql connect calolean-db --user=calolean_app --database=calolean
   # in psql, from the folder containing the CSVs:
   \copy stg_foods FROM 'usda_foods.csv' WITH (FORMAT csv, HEADER true)
   \copy stg_foods FROM 'off_foods.csv'  WITH (FORMAT csv, HEADER true)
   \copy stg_exercises FROM 'exercises.csv' WITH (FORMAT csv, HEADER true)
   ```
8. ☐ **Transform staging → real tables, then apply form references.** In psql:
   ```bash
   gcloud sql connect calolean-db --user=calolean_app --database=calolean
   \i db/load/transform.sql               # builds foods + exercises, prints row counts
   \i db/migrations/004_form_reference.sql # adds squat/deadlift/etc. form angles (matches by name)
   \q
   ```
9. ☐ **Verify** in psql: `SELECT count(*) FROM foods;` and `SELECT canonical_name FROM foods WHERE similarity(search_name,'banana') > 0.4 LIMIT 3;` returns banana rows; `SELECT count(*) FROM exercises;` ≈ 870.

ℹ️ **Refreshing later:** re-run the dataprep scripts on new dumps, re-load staging, and re-run `transform.sql` + `004` — it's a full rebuild each time, so it's safe to repeat.

**Produces:** `CLOUD_SQL_CONNECTION_NAME`, `CLOUD_SQL_DB`, `CLOUD_SQL_USER`, `CLOUD_SQL_PASSWORD`, a populated food + exercise database

---

## Step 4 — Deploy to Cloud Run + point calolean.com at it

The repo includes a production `Dockerfile` (Next.js standalone). Cloud Run builds and runs it; you map calolean.com to the service. Get the site live now — **AdSense, Amazon Associates, and Google OAuth verification all require a live, working website.** This replaces the waitlist page.

**Cost:** pay-per-use; with `--min-instances 1` (recommended so the first user of the day doesn't wait for a cold start) ≈ ₹500–1,500/month.

1. ☐ **Put the secrets in Secret Manager** (server-side values; from your machine or Cloud Shell):
   ```bash
   printf '%s' "$FIREBASE_SERVICE_ACCOUNT_B64" | gcloud secrets create FIREBASE_SERVICE_ACCOUNT_B64 --data-file=-
   printf '%s' "$GCP_SERVICE_ACCOUNT_B64"      | gcloud secrets create GCP_SERVICE_ACCOUNT_B64 --data-file=-
   printf '%s' "$CLOUD_SQL_PASSWORD"           | gcloud secrets create CLOUD_SQL_PASSWORD --data-file=-
   # later, when you have them (Steps 7): GOOGLE_HEALTH_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY
   ```
2. ☐ **Build the image.** `NEXT_PUBLIC_*` values are baked into the browser bundle at build time, so they're passed as Docker build args (Cloud Shell has Docker preinstalled). From the repo root:
   ```bash
   REGION=asia-south1
   IMAGE=$REGION-docker.pkg.dev/$GCP_PROJECT_ID/calolean/web:latest
   gcloud artifacts repositories create calolean --repository-format=docker --location=$REGION  # first time only
   gcloud auth configure-docker $REGION-docker.pkg.dev

   docker build -t $IMAGE \
     --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... \
     --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=... \
     --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=... \
     --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=... \
     --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=... \
     --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=... \
     --build-arg NEXT_PUBLIC_APP_URL=https://calolean.com .
     # add the GA / AdSense / affiliate build args as you obtain them (Steps 5, 6, 8)
   docker push $IMAGE
   ```
3. ☐ **Deploy** the image with the runtime env vars and secrets:
   ```bash
   gcloud run deploy calolean --image $IMAGE --region $REGION --allow-unauthenticated \
     --min-instances 1 --memory 1Gi \
     --add-cloudsql-instances $CLOUD_SQL_CONNECTION_NAME \
     --set-env-vars GCP_PROJECT_ID=$GCP_PROJECT_ID,VERTEX_LOCATION=global,CLOUD_SQL_CONNECTION_NAME=$CLOUD_SQL_CONNECTION_NAME,CLOUD_SQL_DB=calolean,CLOUD_SQL_USER=calolean_app,NEXT_PUBLIC_APP_URL=https://calolean.com \
     --set-secrets FIREBASE_SERVICE_ACCOUNT_B64=FIREBASE_SERVICE_ACCOUNT_B64:latest,GCP_SERVICE_ACCOUNT_B64=GCP_SERVICE_ACCOUNT_B64:latest,CLOUD_SQL_PASSWORD=CLOUD_SQL_PASSWORD:latest
   ```
   (Re-run both blocks whenever you change a `NEXT_PUBLIC_*` value; only the deploy command for runtime values.)
   💡 Easier long-term: once all keys are settled, ask a Claude Code session to add a `cloudbuild.yaml` wiring the build args from Secret Manager so deploys become one command / auto-deploy on push.
4. ☐ The deploy prints a service URL like `https://calolean-xxxxx-el.a.run.app` → open it, confirm signup/login works (add this URL to Firebase Authorized domains, Step 1.5).
5. ☐ **Map the domain:** Cloud Run → calolean service → **Networking / Manage custom domains** → Add mapping → `calolean.com` (and `www.calolean.com`). Google asks you to verify domain ownership via **Search Console** (https://search.google.com/search-console → add `calolean.com` → DNS TXT record at your registrar) — you need Search Console later for SEO and OAuth verification anyway.
6. ☐ At your domain registrar, replace the waitlist DNS records with the records Cloud Run shows you (A/AAAA records for the apex, CNAME `ghs.googlehosted.com` for www — use exactly what the console displays).
7. ☐ Wait for DNS + automatic certificate (minutes to 24 h). Verify https://calolean.com loads the app, not the waitlist.
8. ☐ Re-check Firebase Authorized domains contains `calolean.com`.

**Produces:** live site at calolean.com; `NEXT_PUBLIC_APP_URL`; Search Console property (needed again in Steps 7–9)

---

## Step 5 — Google Analytics 4 (traffic measurement)

**Cost:** free.

1. ☐ https://analytics.google.com → Admin (gear) → **Create → Account** → name `Calolean`.
2. ☐ Create a **Property** → `calolean.com`, timezone India, currency INR.
3. ☐ Platform: **Web** → URL `https://calolean.com`, stream name `Calolean Web`.
4. ☐ Copy the **Measurement ID** (`G-XXXXXXXXXX`) → `NEXT_PUBLIC_GA_MEASUREMENT_ID` → rebuild/redeploy (build-time var).
5. ☐ Verify: open the site, accept the cookie banner (GA only loads after consent), then GA4 → Reports → Realtime shows you.

**Produces:** `NEXT_PUBLIC_GA_MEASUREMENT_ID`

---

## Step 6 — Amazon Associates India (affiliate income)

Powers the product cards in the AI chat, shop teasers, and the ad-fallback card. Until AdSense is approved (Step 8) this is your only monetization, so do it before announcing.

**Cost:** free. **Commission:** ~1–9% by category (sports/nutrition typically ~6–9%).

1. ☐ https://affiliate-program.amazon.in → **Sign up** → log in with (or create) an Amazon.in account.
2. ☐ **Account info:** name, address, payee name (must match your bank account for payouts).
3. ☐ **Website list:** `https://calolean.com` (must be live — Step 4 — with real content).
4. ☐ **Profile:** request Store ID `calolean` → Amazon assigns e.g. `calolean-21` — **this is your affiliate tag**. Topics: Health & Personal Care / Sports & Fitness. Traffic: SEO/content, in-app recommendations.
5. ☐ **Identity verification:** phone call/PIN.
6. ☐ Provisionally approved. ⚠️ **You must generate 3 qualifying sales within 180 days** or the account closes (reapplying is allowed). After 3 sales Amazon does the final site review.
7. ☐ `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG=calolean-21` (your real tag) → rebuild/redeploy.
8. ☐ Verify: AI chat → "best whey protein" → product card URL contains `tag=calolean-21`.
9. ☐ **Payouts:** Associates Central → Payment Information → bank account + PAN.
10. ☐ Compliance (already built — just confirm): affiliate disclosure visible near product cards and the "As an Amazon Associate…" line in the Terms page.

**Produces:** `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG`

---

## Step 7 — Google Health API (steps & activity sync) — START THE VERIFICATION EARLY

Connects users' step counts into the exercise page. Works **immediately for up to 100 test users** while unverified; public access needs Google's OAuth verification (**weeks**) — kick it off now and launch with the cap.

**Cost:** free.

### 7a. Make it work today (test mode)

1. ☐ In the calolean project, enable the Health API: https://console.cloud.google.com/apis/library → search "Health" → Enable (successor to the Fitness API; see https://developers.google.com/health/setup).
2. ☐ **OAuth consent screen:** https://console.cloud.google.com/apis/credentials/consent →
   - User type **External** → Create
   - App name `Calolean`, support email, logo
   - App domain `https://calolean.com`; Privacy `https://calolean.com/privacy`; Terms `https://calolean.com/terms` (already built)
   - Authorized domain `calolean.com`
3. ☐ **Scopes page:** add `https://www.googleapis.com/auth/health.activity.read` (the app's default, set in `lib/server/google-health.ts`).
4. ☐ **Test users:** add your Gmail + beta testers (max 100 while status is "Testing").
5. ☐ **OAuth client:** https://console.cloud.google.com/apis/credentials → Create credentials → **OAuth client ID** → **Web application**:
   - JavaScript origins: `https://calolean.com`
   - Redirect URI: `https://calolean.com/api/health/callback`
   - → `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET`
6. ☐ Generate the token-encryption key (encrypts users' OAuth tokens at rest): `openssl rand -hex 32` → `TOKEN_ENCRYPTION_KEY`. Confirm `GOOGLE_HEALTH_REDIRECT_URI=https://calolean.com/api/health/callback`.
7. ☐ Add to Secret Manager + Cloud Run (`gcloud run services update calolean --region asia-south1 --set-secrets ... --set-env-vars GOOGLE_HEALTH_CLIENT_ID=...,GOOGLE_HEALTH_REDIRECT_URI=...`). Test: Exercise page → Connect Google Health → consent screen ("unverified app" warning is normal in test mode) → steps appear.

### 7b. Submit for verification (removes the 100-user cap)

8. ☐ Consent screen → **Publish app** → Google flags the sensitive/restricted scopes and starts verification.
9. ☐ Prepare:
   - ✅ Privacy policy at calolean.com/privacy explaining exactly what health data you read and why (ours does — re-read once)
   - ✅ Homepage describing the app; domain verified in Search Console (done in Step 4.5)
   - ☐ Screen-recorded **demo video** (unlisted YouTube): login → "Connect Google Health" → consent screen with your client ID visible → steps in the app
   - ☐ Justification text: "Calolean reads daily step counts and activity calories, with user consent, solely to display them in the user's own dashboard and improve calorie-balance accuracy. Data is never shared or sold."
10. ☐ Timeline: brand verification ~2–3 days; restricted-scope review **several weeks** with possible follow-up emails (reply promptly). Test users keep working throughout.

**Produces:** `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET`, `GOOGLE_HEALTH_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`

---

## Step 8 — Google AdSense (ad income) — APPLY AS SOON AS THE SITE IS LIVE

The dashboard ad card runs AdSense native in-article ads, auto-falling back to your Amazon affiliate card until approval. Review takes **2–4 weeks** — apply right after Step 4.

**Cost:** free. **Revenue:** modest until thousands of pageviews/day.

### Before applying — eligibility checklist
- ☐ Site live on your own domain (Step 4) ✅
- ☐ Privacy policy & Terms live (built-in) ✅
- ☐ Cookie-consent banner live (built-in — AdSense/GA load only after consent) ✅
- ☐ You are 18+ with an Indian address/bank for payouts
- ☐ Genuine content beyond the app shell; if rejected for "low value content", add 3–5 short articles (e.g. "How a calorie deficit works") and reapply after 2 weeks.

### Apply
1. ☐ https://adsense.google.com → **Get started** → same Google account → country **India** → accept terms.
2. ☐ Enter site: `calolean.com`.
3. ☐ You get a **publisher ID** (`pub-XXXXXXXXXXXXXXXX`). Two changes:
   - `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX` → rebuild/redeploy (the app injects the AdSense script automatically — doubles as the ownership snippet).
   - Edit `public/ads.txt`: replace the placeholder with `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` → commit, push, redeploy (I can do this when you have the ID). Verify https://calolean.com/ads.txt.
4. ☐ Click **Request review**. Wait 2–4 weeks; check the dashboard weekly and fix any "needs attention" items.
5. ☐ **After approval:** Ads → By ad unit → **In-article** → name `calolean-dashboard-native` → copy the slot ID → `NEXT_PUBLIC_ADSENSE_SLOT_NATIVE` → rebuild/redeploy.
6. ☐ **EEA/UK consent:** AdSense → Privacy & messaging → GDPR message → create + publish for calolean.com (required for EEA traffic).
7. ☐ Verify: dashboard ad card shows a real ad (may take hours; affiliate fallback shows until then — by design).
8. ☐ **Payments:** AdSense → Payments → Indian bank (NEFT) + PAN; address PIN-by-post verification at ₹1,000 earnings; payout threshold ~$100.

**Produces:** `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_SLOT_NATIVE`, updated `public/ads.txt`

---

## Step 9 — Final launch checklist

When Steps 1–5 are done (6–8 can still be pending review):

### Environment audit
- ☐ Cloud Run → calolean service → Revisions → check env vars + secrets match the table below; server secrets only via Secret Manager.
- ☐ `NEXT_PUBLIC_*` values were passed as Docker build args (they're in the browser bundle — rebuild after changing any).
- ☐ No keys in git: `git log -p --all -S "BEGIN PRIVATE KEY"` returns nothing.

### End-to-end smoke test (live site, desktop + phone)
- ☐ Sign up with a fresh email → onboarding → dashboard shows your calorie target
- ☐ Google sign-in works
- ☐ Scan a food photo → result shows the **verified** badge sourced from "Calolean Database" → Save → appears in today's log → totals update
- ☐ Log water; log weight; persist after refresh
- ☐ Exercise page: search exercises, log a workout, steps card shows Google Health data (test account)
- ☐ Form check: record/upload a short squat video → angles + feedback (in-browser; first load downloads the model, ~10 s on slow connections)
- ☐ AI chat answers; product cards carry your affiliate tag
- ☐ Settings → Export CSV works; Delete account removes data (use a throwaway account!)
- ☐ Cookie banner in fresh incognito; Decline → GA/AdSense don't load (Network tab)
- ☐ Light/dark themes; mobile bottom-nav on all five tabs
- ☐ `/privacy`, `/terms`, `/sitemap.xml`, `/robots.txt`, `/ads.txt` all load

### Search & monitoring
- ☐ Search Console (from Step 4.5) → Sitemaps → submit `https://calolean.com/sitemap.xml`
- ☐ Cloud Run → service → Metrics/Logs: glance at error rate after a day
- ☐ Cloud SQL → instance → Backups: daily backups ON (default)
- ☐ Firebase console → Firestore: data appears under `users/<uid>/…` as testers sign up

### Announce
- ☐ Email the waitlist that calolean.com is live
- ☐ Update social bios pointing at the waitlist

---

## Appendix A — Env var ↔ step cross-reference

Build-time (Docker `--build-arg`, baked into the browser bundle — redeploy with a rebuild to change): all `NEXT_PUBLIC_*`. Runtime (Cloud Run env vars / Secret Manager): everything else.

| Variable | From step | Kind | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (6 vars) | 1.3 | build-time | web app config |
| `FIREBASE_SERVICE_ACCOUNT_B64` | 1.8 | secret | admin JSON, base64 |
| `GCP_PROJECT_ID` | 2.5 | runtime | |
| `GCP_SERVICE_ACCOUNT_B64` | 2.5 | secret | server JSON, base64 |
| `VERTEX_LOCATION` / `GEMINI_CHAT_MODEL` / `GEMINI_VISION_MODEL` | 2.5 | runtime | defaults fine |
| `GOOGLE_API_KEY` | 2.7 | secret | optional fallback |
| `CLOUD_SQL_CONNECTION_NAME` / `CLOUD_SQL_DB` / `CLOUD_SQL_USER` | 3.2–3.4 | runtime | |
| `CLOUD_SQL_PASSWORD` | 3.4 | secret | |
| `NEXT_PUBLIC_APP_URL` | 4 | build-time | `https://calolean.com` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | 5.4 | build-time | `G-…` |
| `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG` | 6.7 | build-time | e.g. `calolean-21` |
| `GOOGLE_HEALTH_CLIENT_ID` | 7a.5 | runtime | |
| `GOOGLE_HEALTH_CLIENT_SECRET` | 7a.5 | secret | |
| `GOOGLE_HEALTH_REDIRECT_URI` | 7a.6 | runtime | `https://calolean.com/api/health/callback` |
| `TOKEN_ENCRYPTION_KEY` | 7a.6 | secret | `openssl rand -hex 32` |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | 8.3 | build-time | `ca-pub-…` |
| `NEXT_PUBLIC_ADSENSE_SLOT_NATIVE` | 8.5 | build-time | after approval |

(No `USDA_API_KEY` — the live USDA API is not used; the food database is self-hosted in Cloud SQL, refreshed from USDA bulk dumps via `scripts/seed_foods_usda.mjs`.)

## Appendix B — Things intentionally NOT in this runbook

- **Shop checkout/payments** — out of scope per your decision; the shop stays a teaser with affiliate links.
- **Native mobile apps / Apple Health** — the site is a responsive web app; app-store distribution and Apple Health are a later project.
- **Paid subscriptions** — all features free at launch.
- **CI/CD pipeline** — first deploys are manual `gcloud` commands; once keys are settled, add a `cloudbuild.yaml` for one-command/auto deploys (any Claude Code session can set this up).

## Appendix C — Who to contact when stuck

- Google Cloud (Run/SQL/Vertex/Firebase): https://console.cloud.google.com/support
- AdSense: https://support.google.com/adsense + community forum (rejections state a category — fix, reapply after 2 weeks)
- Amazon Associates: Associates Central → Contact Us (chat is responsive)
- USDA data downloads: https://fdc.nal.usda.gov/download-datasets (new dumps ~twice a year)
- The codebase: open a Claude Code session on this repo — `README.md` and `PRODUCTION_UPGRADE.md` describe the architecture.
