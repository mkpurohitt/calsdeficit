# Calolean — Launch Runbook (NEXT STEPS)

**Last updated:** 12 June 2026
**Audience:** you (the founder). Every step below is a manual task only you can do — creating accounts, getting keys, passing reviews. The code is done; this document turns it into a live product at **https://calolean.com**.

**How to use this document:** work top-to-bottom. Steps are ordered so that the slowest approvals (AdSense ~2–4 weeks, Google Health OAuth verification ~weeks) are kicked off as early as possible while you finish the rest. Each step tells you exactly which `.env` variable it produces — fill them into a local `.env.local` file as you go, then mirror them all into Vercel in Step 8.

**Estimated total cost at launch scale:** ~₹2,500–4,000/month (Cloud SQL smallest instance is the main cost; Firebase, Vertex AI, and Vercel are effectively free at low traffic). Everything else is free to set up.

---

## Progress tracker

| # | Step | Wait time | Status |
|---|------|-----------|--------|
| 1 | Firebase project (auth + database) | none | ☐ |
| 2 | Google Cloud + Vertex AI (the AI brain) | none | ☐ |
| 3 | USDA food-data API key | instant email | ☐ |
| 4 | Deploy to Vercel + point calolean.com | DNS up to 24 h | ☐ |
| 5 | Cloud SQL exercise/food database | ~15 min | ☐ |
| 6 | Google Analytics 4 | none | ☐ |
| 7 | Amazon Associates (affiliate income) | approval after 3 sales | ☐ |
| 8 | Google Health API (steps sync) | **verification: weeks — start early** | ☐ |
| 9 | Google AdSense (ad income) | **review: 2–4 weeks — apply early** | ☐ |
| 10 | Final launch checklist | half a day | ☐ |

---

## Step 1 — Firebase project (user accounts + their data)

Firebase gives Calolean its login system (email + Google sign-in) and the Firestore database that stores each user's food logs, water, weight, and settings.

**Cost:** free (Spark plan covers thousands of users; you'll upgrade to pay-as-you-go Blaze in Step 2 anyway, which is still ₹0 at low usage).

1. ☐ Go to https://console.firebase.google.com and sign in with the Google account you want to own the business (suggest a dedicated one, e.g. `admin@calolean.com` via Google Workspace, or your personal account is fine to start).
2. ☐ Click **Create a project** → name it `calolean` → you can disable Google Analytics here (we set up GA4 separately in Step 6) → Create.
3. ☐ **Register the web app:** Project Overview → click the **`</>`(Web)** icon → nickname `calolean-web` → do NOT tick Firebase Hosting → Register. You'll see a `firebaseConfig` code block. Copy each value into your `.env.local`:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`
4. ☐ **Enable sign-in methods:** left sidebar → Build → **Authentication** → Get started → Sign-in method tab:
   - Enable **Email/Password** (just the toggle; leave passwordless off).
   - Enable **Google** → set public-facing name `Calolean` and a support email → Save.
5. ☐ **Authorized domains:** still in Authentication → Settings → Authorized domains → **Add domain** → `calolean.com` (also add your `*.vercel.app` preview domain after Step 4).
6. ☐ **Enable Firestore:** Build → **Firestore Database** → Create database → **Production mode** → location `asia-south1 (Mumbai)` (closest to your Indian users; this cannot be changed later) → Create.
7. ☐ **Deploy the security rules and indexes** (these files are already in the repo: `firestore.rules`, `firestore.indexes.json`). On your computer:
   ```bash
   npm install -g firebase-tools
   firebase login
   cd <your clone of the calsdeficit repo>
   firebase use --add        # pick the calolean project, alias "default"
   firebase deploy --only firestore:rules,firestore:indexes
   ```
8. ☐ **Server credentials (Admin SDK):** ⚙️ Project settings → **Service accounts** tab → **Generate new private key** → a JSON file downloads. Convert it to one base64 line and put it in `.env.local`:
   ```bash
   base64 -w0 path/to/downloaded-key.json     # macOS: base64 -i path/to/key.json
   ```
   → `FIREBASE_SERVICE_ACCOUNT_B64`
   ⚠️ Never commit this JSON or the base64 string to git. Store the JSON somewhere safe (password manager) and delete it from Downloads.

**Produces:** `NEXT_PUBLIC_FIREBASE_*` (6 vars), `FIREBASE_SERVICE_ACCOUNT_B64`

---

## Step 2 — Google Cloud + Vertex AI (food scanning, chat, form analysis)

Firebase projects ARE Google Cloud projects, so you'll reuse the same `calolean` project. Vertex AI runs the Gemini models that power photo food scanning, the AI chat, and exercise form analysis.

**Cost:** pay-per-use. Gemini Flash-Lite is ~₹0.01–0.04 per food scan; expect under ₹500/month until you have thousands of daily scans.

1. ☐ Go to https://console.cloud.google.com → top project picker → select **calolean** (same project as Firebase).
2. ☐ **Enable billing:** ☰ menu → Billing → link a billing account (needs a credit/debit card). This also upgrades Firebase to the Blaze plan — required for Vertex AI. Set a **budget alert** while you're there: Billing → Budgets & alerts → Create budget → ₹2,000/month with email alerts at 50/90/100%.
3. ☐ **Enable the APIs:** visit each link with the calolean project selected and click Enable:
   - Vertex AI API: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com
   - Cloud SQL Admin API: https://console.cloud.google.com/apis/library/sqladmin.googleapis.com
4. ☐ **Create the server service account:** ☰ → IAM & Admin → Service Accounts → **Create service account**:
   - Name: `calolean-server`
   - Grant roles: **Vertex AI User** (`roles/aiplatform.user`) and **Cloud SQL Client** (`roles/cloudsql.client`)
   - Done → click the new account → **Keys** tab → Add key → Create new key → JSON → download.
5. ☐ Base64 it like before → `GCP_SERVICE_ACCOUNT_B64`. Also set:
   - `GCP_PROJECT_ID` = the project ID shown in the console (e.g. `calolean` or `calolean-xxxxx`)
   - `VERTEX_LOCATION` = `global` (already the default in `.env.example`; leave as is)
   - `GEMINI_CHAT_MODEL` = `gemini-3.1-flash`, `GEMINI_VISION_MODEL` = `gemini-3.1-flash-lite` (defaults; leave as is)
6. ☐ **Sanity check the models are available to your project:** https://console.cloud.google.com/vertex-ai/model-garden → search "Gemini 3.1 Flash" → it should show as available with no extra access request. (If a newer Flash-Lite generation exists by the time you do this, you can simply change the two `GEMINI_*` env vars — no code change needed.)
7. ☐ (Optional fallback) `GOOGLE_API_KEY` from https://aistudio.google.com/apikey lets the app fall back to the public Gemini API if Vertex is misconfigured. Nice safety net during setup; you can remove it later.

**Produces:** `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_B64`, (`VERTEX_LOCATION`, `GEMINI_*` defaults), optional `GOOGLE_API_KEY`

---

## Step 3 — USDA FoodData Central API key (verified nutrition data)

This powers the "verified" badge: AI estimates are cross-checked against the US government nutrition database (plus Open Food Facts, which needs no key).

**Cost:** free, 1,000 requests/hour (the app caches results in Cloud SQL, so you'll rarely hit this).

1. ☐ Go to https://fdc.nal.usda.gov/api-key-signup → fill name + email → Submit.
2. ☐ The key arrives by email within a minute → `USDA_API_KEY`.

**Produces:** `USDA_API_KEY`

---

## Step 4 — Deploy to Vercel + point calolean.com at it

Get the real site live now (even with some features pending keys) because **AdSense, Amazon Associates, and Google OAuth verification all require a live, working website to review.** This replaces the current waitlist page.

**Cost:** free (Hobby plan) to start. ⚠️ Note: Vercel's Hobby plan prohibits commercial use — since you'll run ads, plan to upgrade to **Pro ($20/month)** at or shortly after launch.

1. ☐ Go to https://vercel.com/signup → **Continue with GitHub** → authorize.
2. ☐ Dashboard → **Add New → Project** → Import the `mkpurohitt/calsdeficit` repository.
3. ☐ Before clicking Deploy, expand **Environment Variables** and paste in everything you have so far from `.env.local` (you can add the rest later under Project → Settings → Environment Variables). Set `NEXT_PUBLIC_APP_URL` = `https://calolean.com`.
4. ☐ Make sure the production branch is correct: after the first deploy, go to Project → Settings → Git → Production Branch and confirm it points at your main branch (merge the `claude/gracious-shannon-p2kzih` work into it first if you haven't).
5. ☐ Click **Deploy** → wait ~2 min → you get a `*.vercel.app` URL. Click through the site and confirm signup/login works (Firebase vars from Step 1 must be set).
6. ☐ **Connect the domain:** Project → Settings → **Domains** → add `calolean.com` and `www.calolean.com`. Vercel shows you the DNS records to set.
7. ☐ Go to your domain registrar (wherever calolean.com is registered — GoDaddy/Namecheap/Google Domains etc.) → DNS settings → replace the waitlist records:
   - `A` record, host `@`, value `76.76.21.21`
   - `CNAME` record, host `www`, value `cname.vercel-dns.com`
   (Use exactly what Vercel's Domains page tells you — it may differ.)
8. ☐ Wait for DNS (minutes to 24 h). Vercel auto-issues the HTTPS certificate. Verify https://calolean.com loads the app, not the waitlist.
9. ☐ Back in Firebase (Step 1.5): add the final `your-project.vercel.app` domain to Authentication → Authorized domains.

**Produces:** live site at calolean.com; `NEXT_PUBLIC_APP_URL`

---

## Step 5 — Cloud SQL (exercise library, food cache, form-check references)

A small PostgreSQL database holding the 800+ exercise catalog, the shared nutrition cache, and the exercise form reference angles. (User personal data lives in Firestore, not here.)

**Cost:** this is your main fixed cost. The smallest instance (`db-f1-micro`, shared CPU) is roughly **₹1,500–2,500/month**. You can stop the instance anytime to pause billing.

1. ☐ https://console.cloud.google.com/sql → **Create instance** → **PostgreSQL**:
   - Instance ID: `calolean-db`; set and **save** a strong postgres password
   - Database version: **PostgreSQL 16**
   - Edition: **Enterprise** → preset **Sandbox/Shared core (db-f1-micro)**, region `asia-south1`, single zone
   - Under Connections: **Public IP** is fine (the app connects via the Cloud SQL connector using IAM, not by IP allowlist)
   - Create (takes ~10 min).
2. ☐ On the instance page, copy the **Connection name** (looks like `calolean:asia-south1:calolean-db`) → `CLOUD_SQL_CONNECTION_NAME`.
3. ☐ **Databases** tab → Create database → name `calolean` → `CLOUD_SQL_DB=calolean`.
4. ☐ **Users** tab → Add user account → username `calolean_app`, strong password → `CLOUD_SQL_USER`, `CLOUD_SQL_PASSWORD`.
5. ☐ **Run the migrations.** Easiest path — Cloud Shell (the `>_` icon, top right of the console):
   ```bash
   # in Cloud Shell:
   git clone https://github.com/mkpurohitt/calsdeficit.git && cd calsdeficit
   gcloud sql connect calolean-db --user=calolean_app --database=calolean
   # when psql opens, run each file's contents in order:
   \i db/migrations/001_exercises.sql
   \i db/migrations/002_foods.sql
   \i db/migrations/003_nutrition_cache.sql
   \i db/migrations/004_form_reference.sql
   \q
   ```
6. ☐ **Seed the exercise catalog** (downloads the free-exercise-db dataset and inserts ~870 exercises). Still in Cloud Shell, in the repo folder:
   ```bash
   npm install
   export CLOUD_SQL_CONNECTION_NAME=... CLOUD_SQL_DB=calolean CLOUD_SQL_USER=calolean_app CLOUD_SQL_PASSWORD=...
   export GCP_SERVICE_ACCOUNT_B64=...   # from Step 2
   node scripts/seed_exercises_cloudsql.mjs
   ```
   Expected output: a count of inserted exercises (~870).
7. ☐ Add the four `CLOUD_SQL_*` vars to Vercel and redeploy. Open https://calolean.com/exercise and confirm the exercise search returns results.

**Produces:** `CLOUD_SQL_CONNECTION_NAME`, `CLOUD_SQL_DB`, `CLOUD_SQL_USER`, `CLOUD_SQL_PASSWORD`

---

## Step 6 — Google Analytics 4 (traffic measurement)

**Cost:** free.

1. ☐ https://analytics.google.com → Admin (gear) → **Create → Account** → name `Calolean`.
2. ☐ Create a **Property** → name `calolean.com`, timezone India, currency INR.
3. ☐ Business details → finish → **Choose a platform: Web** → Website URL `https://calolean.com`, stream name `Calolean Web`.
4. ☐ Copy the **Measurement ID** (`G-XXXXXXXXXX`) → `NEXT_PUBLIC_GA_MEASUREMENT_ID` (add to Vercel, redeploy).
5. ☐ Verify: open the site, then GA4 → Reports → Realtime → you should see yourself. (The app only loads GA after cookie consent is accepted — accept the banner first.)

**Produces:** `NEXT_PUBLIC_GA_MEASUREMENT_ID`

---

## Step 7 — Amazon Associates India (affiliate income)

Powers the product cards in the AI chat, shop teasers, and the ad-fallback card. Until AdSense is approved (Step 9), affiliate cards are your only monetization, so do this before announcing.

**Cost:** free. **Commission:** ~1–9% depending on category (sports/nutrition is typically ~6–9%).

1. ☐ Go to https://affiliate-program.amazon.in → **Sign up** → log in with (or create) an Amazon.in account.
2. ☐ **Account info:** your name, address, and the payee name (this must match your bank account for payouts later).
3. ☐ **Website list:** enter `https://calolean.com`. (The site must be live — Step 4 — and have real content; the waitlist page alone may be rejected.)
4. ☐ **Profile:**
   - Associates Store ID: request `calolean` → Amazon assigns something like `calolean-21`. **This is your affiliate tag.**
   - Topics: Health & Personal Care / Sports, Fitness & Outdoors
   - How you drive traffic: SEO/content, app recommendations.
5. ☐ **Identity verification:** enter your phone number → receive a call/PIN → enter the PIN.
6. ☐ You're approved **provisionally**. ⚠️ **Important rule: you must generate at least 3 qualifying sales within 180 days** or the account is closed (you can reapply). Once 3 sales happen, Amazon does a final review of calolean.com.
7. ☐ Put the tag in env: `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG=calolean-21` (your actual tag) → add to Vercel, redeploy.
8. ☐ Verify: open the AI chat, ask "best whey protein", click a product card → the Amazon URL must contain `tag=calolean-21`.
9. ☐ **Payouts:** Associates Central → Payment Information → add your bank account + PAN (required in India for payouts and tax).
10. ☐ Compliance (already built into the site, just confirm): the affiliate disclosure line appears near product cards and in the Terms page — Amazon requires the disclosure to be visible, and our Terms page includes the standard "As an Amazon Associate, Calolean earns from qualifying purchases" statement.

**Produces:** `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG`

---

## Step 8 — Google Health API (steps & activity sync) — START THE VERIFICATION EARLY

This connects users' step counts (Android/Health Connect data) into the exercise page. It works **immediately for up to 100 test users** while unverified; full public access needs Google's OAuth verification, which takes **weeks** — kick it off now and launch with the 100-user cap in the meantime.

**Cost:** free.

### 8a. Make it work today (test mode)

1. ☐ In the calolean Google Cloud project, enable the Health API: https://console.cloud.google.com/apis/library — search "Health" → enable (the successor to the Fitness API; see https://developers.google.com/health/setup).
2. ☐ **OAuth consent screen:** https://console.cloud.google.com/apis/credentials/consent →
   - User type: **External** → Create
   - App name `Calolean`, support email, app logo (use `public/icon.png` if you have a 120×120 version)
   - App domain: `https://calolean.com`; Privacy policy: `https://calolean.com/privacy`; Terms: `https://calolean.com/terms` (these pages are already built)
   - Authorized domain: `calolean.com`
3. ☐ **Scopes page:** Add the activity read scope the app requests: `https://www.googleapis.com/auth/health.activity.read` (the app's default, set in `lib/server/google-health.ts`; overridable via `GOOGLE_HEALTH_SCOPES`). Save.
4. ☐ **Test users:** add your own Gmail + any beta testers (up to 100). While the app's publishing status is "Testing", only these accounts can connect Google Health.
5. ☐ **Create the OAuth client:** https://console.cloud.google.com/apis/credentials → Create credentials → **OAuth client ID** → type **Web application**:
   - Name: `calolean-web`
   - Authorized JavaScript origins: `https://calolean.com`
   - Authorized redirect URIs: `https://calolean.com/api/health/callback`
   - Create → copy Client ID → `GOOGLE_HEALTH_CLIENT_ID`, Client secret → `GOOGLE_HEALTH_CLIENT_SECRET`.
6. ☐ Generate the token-encryption key (encrypts users' OAuth tokens at rest in Firestore):
   ```bash
   openssl rand -hex 32
   ```
   → `TOKEN_ENCRYPTION_KEY`. Also confirm `GOOGLE_HEALTH_REDIRECT_URI=https://calolean.com/api/health/callback`.
7. ☐ Add all four vars to Vercel, redeploy. Test: Exercise page → Connect Google Health → consent screen (will show an "unverified app" warning in test mode — normal) → steps appear.

### 8b. Submit for verification (removes the 100-user cap)

8. ☐ Consent screen page → **Publish app** → Google flags that your scopes are **sensitive/restricted** and starts the verification flow.
9. ☐ Prepare what reviewers ask for:
   - ✅ Privacy policy live at calolean.com/privacy that explicitly explains what health/fitness data you read and why (ours does — review the wording once more)
   - ✅ Homepage clearly describing the app, owned domain verified in **Google Search Console** (https://search.google.com/search-console → add property `calolean.com` → verify via DNS TXT record)
   - ☐ A short **screen-recorded demo video** (YouTube unlisted link) showing: login → clicking "Connect Google Health" → the consent screen with your client ID visible → steps appearing in the app
   - ☐ Written justification: "Calolean reads daily step counts and activity calories, with user consent, solely to display them in the user's own dashboard and improve calorie-balance accuracy. Data is never shared or sold."
10. ☐ Timeline: brand verification ~2–3 days; sensitive/restricted scope review **several weeks**, possibly with follow-up emails (reply promptly). The app keeps working for test users throughout.

**Produces:** `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET`, `GOOGLE_HEALTH_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`

---

## Step 9 — Google AdSense (ad income) — APPLY AS SOON AS THE SITE IS LIVE

The dashboard ad card runs AdSense native in-article ads, with automatic fallback to your Amazon affiliate card until approval. AdSense review takes **2–4 weeks** for new sites, so apply immediately after Step 4 is done and the site has real content.

**Cost:** free. **Revenue:** expect modest income until you have meaningful traffic (thousands of pageviews/day).

### Before applying — eligibility checklist
- ☐ Site live on your own domain (Step 4) ✅
- ☐ Privacy policy & Terms pages live (already built into the app) ✅
- ☐ Cookie-consent banner live (already built — AdSense/GA only load after consent) ✅
- ☐ You are 18+ and have an Amazon-style address/bank for payouts
- ☐ Some genuine content beyond the app shell — the landing page, privacy, terms, and a working product count; if rejected for "low value content", add 3–5 short blog-style articles (e.g. "How a calorie deficit works", "Protein needs for Indian diets") and reapply after 2 weeks.

### Apply
1. ☐ https://adsense.google.com → **Get started** → use the same Google account → country **India** → accept terms.
2. ☐ Enter your site: `calolean.com`.
3. ☐ AdSense gives you a **publisher ID** (`pub-XXXXXXXXXXXXXXXX`) and asks you to prove site ownership. Two things to do in the repo/env:
   - `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX` → Vercel env → redeploy (the app injects the AdSense script tag automatically once this is set, which doubles as the ownership snippet).
   - Edit `public/ads.txt` in the repo: replace the placeholder line with
     `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`
     commit + push (I can do this for you when you have the ID). Verify https://calolean.com/ads.txt shows it.
4. ☐ In AdSense click **Request review**. Wait 2–4 weeks. Check the AdSense dashboard weekly; respond to any "needs attention" items.
5. ☐ **After approval:** AdSense → Ads → **By ad unit** → **In-article** → name `calolean-dashboard-native` → copy the **slot ID** (the `data-ad-slot` number) → `NEXT_PUBLIC_ADSENSE_SLOT_NATIVE` → Vercel env → redeploy.
6. ☐ **Consent for EU/UK visitors:** AdSense → Privacy & messaging → **GDPR message** → Create message for calolean.com (default settings fine) → Publish. (Indian traffic isn't affected, but this keeps you compliant globally and AdSense requires it for EEA traffic.)
7. ☐ Verify: dashboard ad card shows a real ad (may take a few hours after slot creation; until then it shows the affiliate fallback card — that's by design).
8. ☐ **Payments:** AdSense → Payments → add Indian bank account (NEFT) + PAN; payout threshold is $100/₹8,000-ish equivalent; you'll also need to do a one-time address PIN verification by post when you hit ₹1,000 earnings.

**Produces:** `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_SLOT_NATIVE`, updated `public/ads.txt`

---

## Step 10 — Final launch checklist

When Steps 1–6 are done (7–9 can still be pending review), do a full pass:

### Environment audit
- ☐ Vercel → Project → Settings → Environment Variables: every var from the table below is present in **Production**. Redeploy after any change.
- ☐ No keys committed to git: run `git log -p --all -S "BEGIN PRIVATE KEY"` — should return nothing.

### End-to-end smoke test (do each on the live site, once on desktop + once on your phone)
- ☐ Sign up with a fresh email → onboarding flow → dashboard shows your calorie target
- ☐ Sign in with Google works
- ☐ Scan a food photo → result appears with the **verified** badge (USDA/OFF match) → Save → appears in today's log → dashboard totals update
- ☐ Log water; log weight; both persist after refresh
- ☐ Exercise page: search exercises (Cloud SQL), log a workout, steps card shows Google Health data (your test account)
- ☐ Form check: record/upload a short squat video → angles + feedback appear (runs in-browser; first load downloads the model, ~10 s on slow connections)
- ☐ AI chat answers and shows affiliate product cards with your tag in the URL
- ☐ Settings → Export CSV downloads your data; Settings → Delete account removes it (test with a throwaway account!)
- ☐ Cookie banner appears in a fresh incognito window; Decline → GA/AdSense scripts do NOT load (check the Network tab)
- ☐ Light/dark theme both look right; mobile bottom-nav works on all five tabs
- ☐ `/privacy`, `/terms`, `/sitemap.xml`, `/robots.txt`, `/ads.txt` all load

### Search & monitoring
- ☐ Google Search Console (set up in Step 8b.9) → Sitemaps → submit `https://calolean.com/sitemap.xml`
- ☐ Vercel → Project → Observability: glance at error rate after a day of traffic
- ☐ Set up the Cloud SQL automated backup check: instance → Backups → confirm daily backups are ON (default)
- ☐ Firestore: https://console.firebase.google.com → Firestore → confirm data appears under `users/<uid>/...` as testers sign up

### Announce
- ☐ Email the waitlist that calolean.com is live
- ☐ Update any social bios pointing at the waitlist

---

## Appendix A — Env var ↔ step cross-reference

| Variable | From step | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` (+5 more `NEXT_PUBLIC_FIREBASE_*`) | 1.3 | Web app config block |
| `FIREBASE_SERVICE_ACCOUNT_B64` | 1.8 | base64 of admin JSON — secret |
| `GCP_PROJECT_ID` | 2.5 | |
| `GCP_SERVICE_ACCOUNT_B64` | 2.5 | base64 of server JSON — secret |
| `VERTEX_LOCATION` | 2.5 | keep `global` |
| `GEMINI_CHAT_MODEL` / `GEMINI_VISION_MODEL` | 2.5 | defaults fine |
| `GOOGLE_API_KEY` | 2.7 | optional fallback |
| `USDA_API_KEY` | 3 | |
| `NEXT_PUBLIC_APP_URL` | 4 | `https://calolean.com` |
| `CLOUD_SQL_CONNECTION_NAME` | 5.2 | `project:region:instance` |
| `CLOUD_SQL_DB` / `CLOUD_SQL_USER` / `CLOUD_SQL_PASSWORD` | 5.3–5.4 | secrets |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | 6.4 | `G-…` |
| `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG` | 7.7 | e.g. `calolean-21` |
| `GOOGLE_HEALTH_CLIENT_ID` / `GOOGLE_HEALTH_CLIENT_SECRET` | 8a.5 | secret |
| `GOOGLE_HEALTH_REDIRECT_URI` | 8a.6 | `https://calolean.com/api/health/callback` |
| `TOKEN_ENCRYPTION_KEY` | 8a.6 | `openssl rand -hex 32` — secret |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | 9.3 | `ca-pub-…` |
| `NEXT_PUBLIC_ADSENSE_SLOT_NATIVE` | 9.5 | after approval |

## Appendix B — Things intentionally NOT in this runbook

- **Shop checkout/payments** — out of scope per your decision; the shop page stays a teaser with affiliate links.
- **Native mobile apps** — the site is a responsive PWA-style web app; app-store distribution is a later project.
- **Apple Health** — requires a native iOS app; revisit with the mobile app.
- **Paid subscriptions** — all features are free at launch; pricing is a later decision.

## Appendix C — Who to contact when stuck

- Firebase/GCP/Vertex/Cloud SQL: https://console.cloud.google.com/support (free tier = community/docs; billing issues get free support)
- AdSense: https://support.google.com/adsense + the AdSense community forum (rejections usually state a category — fix and reapply after 2 weeks)
- Amazon Associates: Associates Central → Contact Us (chat support is responsive)
- Vercel: https://vercel.com/help
- The codebase: open a new Claude Code session on this repo — `README.md` and `PRODUCTION_UPGRADE.md` describe the architecture.
