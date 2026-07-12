# Calolean — Post-Launch Product & Engineering Roadmap

**Purpose:** what to build *after* the MVP web app is live (NEXT_STEPS.md Step 9), which technologies to use, and how the backend/cloud grows with you. Written for a solo/small founder on a lean budget — every recommendation favours **managed services + serverless + scale-to-zero** so you pay for usage, not idle infrastructure.

**Golden rule:** the live web app *is* the product. Do **not** rewrite it. Grow it in phases, and only invest in the next phase once the previous one shows real traction (users, retention, revenue).

---

## Phase 0 — What you already have (the foundation)

| Layer | Technology | Role |
|---|---|---|
| Frontend | **Next.js 16** (App Router, React 19, TypeScript, Tailwind v4) | Responsive web app (desktop + mobile web) |
| Hosting | **Google Cloud Run** (Docker, scale-to-zero) | Runs the app + API routes |
| Auth | **Firebase Auth** (email + Google) | Login / accounts |
| User data | **Cloud Firestore** | Food logs, water, workouts, goals, plans, prefs |
| Reference data | **Cloud SQL (PostgreSQL 16)** | 4M+ foods, exercises, form angles, nutrition cache |
| AI | **Vertex AI — Gemini** | Food scanning, chat coach, form analysis prompts |
| On-device ML | **MediaPipe Tasks Vision** | Pose/form analysis in the browser (private) |
| Monetization | **Google AdSense** + **Amazon Associates** | Native ads + affiliate product cards |
| Steps | **Google Health API** | Activity/step sync |
| Secrets | **Secret Manager** | Server credentials |

This is a genuinely production-grade, low-cost stack. Everything below **extends** it — the same Firebase + Cloud Run + Cloud SQL + Vertex AI backend serves every future client, including native apps.

---

## Phase 1 — Stabilize & grow (Month 1–2 after launch)

Goal: make the live app reliable, measurable, and sticky before adding surface area.

### 1.1 Observability (do this first)
- **Cloud Monitoring + Cloud Logging + Error Reporting** (built into GCP, ~free) — dashboards, alerts on error rate/latency.
- **Sentry** (free tier) — front-end + API error tracking with stack traces and user context.
- **Uptime checks** (Cloud Monitoring) — ping the site every minute, email/SMS on downtime.

### 1.2 Automated deploys (CI/CD)
- Replace the manual `gcloud` deploy with **GitHub Actions** (or `cloudbuild.yaml`): push to `main` → build image → deploy to Cloud Run automatically. Adds preview/staging environments.
- Keep the existing `scripts/deploy/cloud-run.sh` as the manual fallback.

### 1.3 Retention loops
- **Push notifications** via **Firebase Cloud Messaging (FCM)** — meal / water / workout reminders and streak nudges. The notification preferences UI already exists; wire it to FCM + **Cloud Scheduler + Cloud Tasks** for timed sends.
- **Email** via a transactional provider (**Resend**, **SendGrid**, or **Firebase Extensions – Trigger Email**) — welcome, weekly progress summary, re-engagement.

### 1.4 Installable web app (PWA) — the cheap "app on your phone"
- Add a **service worker + web manifest** so users can "Add to Home Screen" and get an app-like, offline-capable experience. **Zero app-store friction, zero extra backend.** This buys you a mobile "app" months before a native build is justified.

### 1.5 Growth foundations
- **SEO content**: a blog (`/blog`) with 10–20 articles ("how a calorie deficit works", exercise guides). Doubles as your **AdSense approval** content and organic acquisition.
- **GA4 events + funnels**: track signup → onboarding complete → first food log → day-7 retention. Export to **BigQuery** for deep cohort analysis (free tier is generous).

**Tech added:** FCM, Cloud Scheduler, Cloud Tasks, Sentry, GitHub Actions, a transactional email provider, PWA service worker, BigQuery.

---

## Phase 2 — Native mobile apps (Month 2–4)

This is the real "build our app" step: presence on the **App Store** and **Google Play**.

### 2.1 Which technology?

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Expo / React Native** ✅ | Reuse React + TypeScript skills; **share business logic & API layer with the web**; one codebase for iOS + Android; over-the-air updates (EAS Update); full native access | Some native modules need config | **Recommended** |
| Flutter | Excellent performance & UI control | New language (Dart); **no code reuse** from your Next.js app; second skillset | Only if you want pixel-perfect custom UI and don't mind a fresh codebase |
| Capacitor (wrap the web app) | Fastest to ship; reuses the existing web UI as-is | Feels less "native"; limited for camera/health-heavy UX | Good stop-gap between PWA and full native |

**Recommendation: Expo (React Native).** You keep the exact same backend — the mobile app calls the **same API routes and Firebase SDK**. Only the UI layer is new, and much of the logic (`lib/plan.ts`, types, API client patterns) ports directly.

### 2.2 What the native app unlocks
- **Native health data**: **Apple HealthKit** (iOS) + **Android Health Connect** — deeper, permissioned steps/workouts/heart-rate than the web Google Health API.
- **Camera**: faster food-scan capture + **barcode scanning** (your food DB already stores barcodes).
- **Local + push notifications**, **home-screen widgets** (today's calories/rings), **Apple/Google Sign-In** (Apple Sign-In is mandatory on iOS if you offer Google sign-in).
- **Offline-first** logging that syncs to Firestore.

### 2.3 Build & release toolchain
- **Expo EAS Build** (cloud builds — no Mac needed) + **EAS Submit** (to the stores).
- **RevenueCat** (Phase 3) for in-app purchases.
- **Apple Developer Program** ($99/yr) + **Google Play Console** ($25 one-time). Budget ~2–4 weeks for first-time store review, privacy labels, and screenshots.

**Backend changes: essentially none.** Firebase + Cloud Run + Cloud SQL + Vertex AI already serve any client. You may add device-token storage in Firestore for push, and Apple/Health Connect token handling similar to the existing Google Health flow.

**Tech added:** Expo/React Native, EAS, HealthKit, Health Connect, native camera/barcode, RevenueCat (link to Phase 3).

---

## Phase 3 — Subscriptions & monetization depth (Month 3–5)

The UI already teases Premium ("100 prompts/day · no ads — coming soon"). Turn it on.

- **Entitlements**: extend the existing server-side tier check (`lib/entitlements.ts`, `lib/server/entitlements.ts`) — free vs premium gates AI usage and ads.
- **Payments**:
  - **Web**: **Razorpay** (best for India — UPI/cards) or **Stripe** / **Paddle** (Paddle = merchant-of-record, handles global tax/VAT for you).
  - **Mobile**: **Apple/Google in-app purchase is mandatory** for digital subscriptions (they take 15–30%). Use **RevenueCat** to unify web + iOS + Android entitlements behind one API and one webhook.
- **Webhooks → Firestore**: payment events update the user's `tier`; Cloud Run handles the webhook, Secret Manager holds the keys.
- **Ads**: scale AdSense (mediation, more placements) for free-tier users; premium users see none.

**Tech added:** RevenueCat, Razorpay/Stripe/Paddle, subscription webhooks on Cloud Run.

---

## Phase 4 — Feature & AI depth (Month 4–8)

Prioritise by what your analytics say users want. Candidates:

- **Barcode & packaged-food scanning** — instant lookup against your Cloud SQL barcodes (data already there).
- **AI meal planning & recipes** — Gemini generates day/week meal plans that hit the user's macro targets (you already compute per-meal calorie targets in onboarding).
- **Smarter coaching** — **RAG over the user's own history** (recent logs, trends) so the chat gives personalised, specific advice; optional **voice input** (speech-to-text) and **agentic** multi-step coaching.
- **Semantic food search** — add **pgvector** to Cloud SQL and embed food names for "fuzzy meaning" search (e.g. "protein-rich breakfast") beyond trigram matching.
- **Progress analytics** — weight-trend smoothing, **auto-adjusting TDEE** as weight changes, insights, streak mechanics.
- **More wearables** — Fitbit, Garmin, Whoop, Apple Watch companion.
- **Community (scope carefully)** — friends, challenges, leaderboards; adds social retention but also moderation cost.

**Tech added:** pgvector, Vertex AI embeddings, speech-to-text (Vertex/Web Speech API), wearable OAuth integrations.

---

## Phase 5 — Scale & harden (as users grow — not before)

Only invest here when traffic justifies it; the current setup handles thousands of users fine.

### Backend scaling
- **Cloud Run**: already autoscales; raise max instances, set `min-instances` ≥ 1 once cold starts hurt UX.
- **Cloud SQL**: move up from `db-f1-micro` → dedicated tier; add **read replicas** for read-heavy food lookups; add **PgBouncer** (or Cloud SQL's built-in pooling) for connection pooling.
- **Memorystore (Redis)**: cache hot food lookups and the nutrition cache in-memory for sub-millisecond reads.
- **Cloud CDN / Cloudflare**: cache static assets and images at the edge.

### Data pipeline (automate the food DB refresh)
- **Cloud Run Jobs + Cloud Scheduler**: re-run the USDA/Open Food Facts dump → CSV → staging → `transform.sql` pipeline on a schedule (dumps refresh ~2×/year), fully hands-off.
- Store dumps/backups in **Cloud Storage**.

### Security & compliance
- **Cloud Armor** (WAF + rate limiting / DDoS) in front of Cloud Run.
- **API rate limiting** per user (protect the AI cost line).
- **Secret rotation**, least-privilege IAM, periodic dependency audits.
- **India DPDP Act + GDPR**: data export & delete already built — keep them working; publish a clear data-retention policy.

### Cost control
- Committed-use discounts / right-sizing once spend is predictable; keep scale-to-zero on low-traffic services.

**Tech added:** read replicas, Memorystore, Cloud CDN, Cloud Run Jobs, Cloud Armor, PgBouncer.

---

## Target architecture (where it all lands)

```
                         ┌────────────────────────────────────────────┐
   Web (Next.js/PWA) ─┐  │                Google Cloud                 │
   iOS  (Expo/RN)     ├─▶│  Cloud Run (app + API)  ◀── Cloud Armor/CDN │
   Android (Expo/RN)  ┘  │        │        │        │                  │
                         │        ▼        ▼        ▼                  │
                         │  Firestore   Cloud SQL   Vertex AI (Gemini) │
                         │  (user data) (foods/ex,  (scan/chat/form)   │
                         │              pgvector,                      │
                         │              Redis cache)                   │
                         │        │                                    │
                         │   FCM · Cloud Scheduler · Cloud Tasks ·     │
                         │   Cloud Run Jobs (data refresh) ·           │
                         │   Secret Manager · Cloud Storage · BigQuery │
                         └────────────────────────────────────────────┘
   External: RevenueCat · Razorpay/Stripe · Sentry · AdSense · Amazon ·
             Apple HealthKit / Android Health Connect / Fitbit / Garmin
```

**Key principle:** one backend, many clients. The web app, PWA, and native apps all hit the **same Cloud Run APIs, Firebase, Cloud SQL, and Vertex AI** — you never fork the backend.

---

## Technology summary

| Layer | Now | Add later |
|---|---|---|
| Web frontend | Next.js 16 / React 19 / TS / Tailwind | PWA (service worker, manifest) |
| Mobile | Responsive web | **Expo / React Native**, EAS Build/Submit |
| Compute | Cloud Run | Cloud Run Jobs, min-instances tuning |
| Auth | Firebase Auth | Apple Sign-In, MFA, phone auth |
| User DB | Firestore | (scales as-is) |
| Reference DB | Cloud SQL Postgres | Read replicas, PgBouncer, **pgvector** |
| Cache | Nutrition cache (SQL) | **Memorystore (Redis)** |
| AI | Vertex AI Gemini | Embeddings, RAG, speech-to-text |
| On-device ML | MediaPipe (web) | HealthKit / Health Connect (native) |
| Notifications | — | **FCM push**, email (Resend/SendGrid) |
| Scheduling / jobs | — | Cloud Scheduler, Cloud Tasks, Run Jobs |
| Payments | — | **RevenueCat** + Razorpay/Stripe/Paddle |
| Monetization | AdSense, Amazon | Mediation, premium tier |
| Analytics | GA4 | Firebase Analytics + **BigQuery** |
| Observability | Cloud Logging | **Sentry**, uptime checks, Cloud Trace |
| Edge/security | — | Cloud CDN, **Cloud Armor** (WAF) |
| CI/CD | manual script | **GitHub Actions / Cloud Build** |

---

## Suggested timeline (traction-gated, not calendar-locked)

| When | Focus | Outcome |
|---|---|---|
| Month 0 | **Launch (NEXT_STEPS Step 9)** | Live at calolean.com |
| Month 1–2 | Phase 1: observability, CI/CD, push, **PWA**, SEO content | Reliable, measurable, installable |
| Month 2–4 | Phase 2: **Expo native apps** + health integrations | App Store + Play Store presence |
| Month 3–5 | Phase 3: **subscriptions** (RevenueCat + payments) | Recurring revenue |
| Month 4–8 | Phase 4: barcode, AI meal plans, RAG, wearables | Deeper product, stickier |
| Ongoing | Phase 5: scale, cache, harden, automate | Handles growth cost-efficiently |

---

## What to build vs. buy (lean-founder guidance)

- **Buy/managed** (don't build): payments (RevenueCat), error tracking (Sentry), email (Resend), push (FCM), auth (Firebase). These are cheap and save weeks.
- **Build**: your differentiators — the AI coaching quality, the food/exercise data pipeline, the onboarding/plan engine, the UX.
- **Defer until traction**: native apps (PWA first), community features, multi-region, Redis/read-replicas.

## Rough cost trajectory

- **Launch → first ~1k users:** ~$10–25/month (Cloud SQL micro + scale-to-zero Cloud Run + low Vertex usage). Basically what you have now.
- **~10k active users:** ~$100–300/month (bigger Cloud SQL, min-instances, more AI calls) — should be covered by ads + affiliate + early subscriptions.
- **Beyond:** scales with revenue; add Redis/replicas/CDN as needed. AI (Gemini) usage is the main variable cost — rate-limit the free tier to protect it.

---

*This roadmap extends the architecture in `PRODUCTION_UPGRADE.md` and follows the launch runbook in `NEXT_STEPS.md`. Revisit it after launch with real usage data — let the metrics, not the calendar, decide the next phase.*
