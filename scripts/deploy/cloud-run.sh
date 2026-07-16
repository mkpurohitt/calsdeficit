#!/usr/bin/env bash
# One-command build + deploy of the Calolean Next.js app to Cloud Run.
#
# Reads every value from an env file (default: .env.local) so you don't have to
# paste a dozen --build-arg / --set-env-vars flags by hand. Safe to re-run: it
# updates the image, the Secret Manager secrets, and the Cloud Run service in
# place. Re-run after changing ANY value (NEXT_PUBLIC_* are baked into the
# browser bundle at build time, so they need a fresh image).
#
# Prerequisites: gcloud + docker (both preinstalled in Google Cloud Shell),
# and an env file with your real values.
#
# Usage (from the repo root):
#   cp .env.example .env.local      # then fill in your real values
#   bash scripts/deploy/cloud-run.sh
#
# Optional overrides:
#   ENV_FILE=deploy.env REGION=asia-south1 SERVICE=calolean \
#     bash scripts/deploy/cloud-run.sh

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.local}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-calolean}"
REPO="${REPO:-calolean}"
# Scale-to-zero by default (cheapest — you only pay while a request is in
# flight). Set MIN_INSTANCES=1 to keep one warm instance (no cold starts, but
# ~$15/month always-on). Cloud SQL is OPTIONAL: leave the CLOUD_SQL_* vars
# blank and the app falls back to the free Open Food Facts API + the public
# exercise dataset — no always-on database to pay for.
MIN_INSTANCES="${MIN_INSTANCES:-0}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example to $ENV_FILE and fill it in." >&2
  exit 1
fi

# Load KEY=VALUE lines from the env file into the environment.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

require() {
  if [[ -z "${!1:-}" ]]; then
    echo "ERROR: $1 is empty in $ENV_FILE — fill it in and re-run." >&2
    exit 1
  fi
}

for v in GCP_PROJECT_ID \
         NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
         NEXT_PUBLIC_FIREBASE_PROJECT_ID NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
         NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID NEXT_PUBLIC_FIREBASE_APP_ID \
         FIREBASE_SERVICE_ACCOUNT_B64 GCP_SERVICE_ACCOUNT_B64; do
  require "$v"
done

# Cloud SQL is all-or-nothing: if you set the connection name, the user and
# password must come with it. If none are set, the app runs without a database.
USE_CLOUD_SQL=0
if [[ -n "${CLOUD_SQL_CONNECTION_NAME:-}" ]]; then
  require CLOUD_SQL_USER
  require CLOUD_SQL_PASSWORD
  USE_CLOUD_SQL=1
fi

APP_URL="${NEXT_PUBLIC_APP_URL:-https://calolean.com}"
DB_NAME="${CLOUD_SQL_DB:-calolean}"
IMAGE="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/$REPO/web:latest"

echo "==> Project: $GCP_PROJECT_ID   Region: $REGION"
echo "==> Image:   $IMAGE"
gcloud config set project "$GCP_PROJECT_ID" >/dev/null

echo "==> Enabling required APIs (idempotent)…"
gcloud services enable \
  run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com sqladmin.googleapis.com aiplatform.googleapis.com \
  >/dev/null

echo "==> Ensuring Artifact Registry repo '$REPO' exists…"
gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker --location="$REGION"

# Build + push the image with Cloud Build (server-side, inside Google's
# network). This avoids the flaky local `docker push` from Cloud Shell and
# needs no local Docker at all. NEXT_PUBLIC_* are passed as build args via
# substitutions (a custom '|' delimiter keeps any special chars safe).
echo "==> Building + pushing image via Cloud Build (this bakes NEXT_PUBLIC_* into the bundle)…"
SUBS="_IMAGE=$IMAGE"
SUBS="$SUBS|_FB_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY"
SUBS="$SUBS|_FB_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
SUBS="$SUBS|_FB_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID"
SUBS="$SUBS|_FB_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
SUBS="$SUBS|_FB_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
SUBS="$SUBS|_FB_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID"
SUBS="$SUBS|_APP_URL=$APP_URL"
SUBS="$SUBS|_GA_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID:-}"
SUBS="$SUBS|_ADSENSE_CLIENT=${NEXT_PUBLIC_ADSENSE_CLIENT_ID:-}"
SUBS="$SUBS|_ADSENSE_SLOT=${NEXT_PUBLIC_ADSENSE_SLOT_NATIVE:-}"
SUBS="$SUBS|_AMAZON_TAG=${NEXT_PUBLIC_AMAZON_AFFILIATE_TAG:-}"
gcloud builds submit --config cloudbuild.yaml --substitutions="^|^$SUBS" .

# Create the secret if missing, then add the current value as a new version.
put_secret() {
  local name="$1" value="$2"
  [[ -z "$value" ]] && return 0
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic >/dev/null
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  echo "    secret $name updated"
}

echo "==> Writing server-side secrets to Secret Manager…"
put_secret FIREBASE_SERVICE_ACCOUNT_B64 "$FIREBASE_SERVICE_ACCOUNT_B64"
put_secret GCP_SERVICE_ACCOUNT_B64      "$GCP_SERVICE_ACCOUNT_B64"
put_secret GOOGLE_HEALTH_CLIENT_SECRET  "${GOOGLE_HEALTH_CLIENT_SECRET:-}"
put_secret TOKEN_ENCRYPTION_KEY         "${TOKEN_ENCRYPTION_KEY:-}"
[[ "$USE_CLOUD_SQL" == 1 ]] && put_secret CLOUD_SQL_PASSWORD "$CLOUD_SQL_PASSWORD"

# The Cloud Run runtime service account (default Compute SA) must be allowed to
# read those secrets at startup.
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
echo "==> Granting $RUNTIME_SA access to read secrets…"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/secretmanager.secretAccessor" --condition=None >/dev/null

# Plain (non-secret) runtime env vars.
ENV_VARS="GCP_PROJECT_ID=$GCP_PROJECT_ID"
ENV_VARS="$ENV_VARS,VERTEX_LOCATION=${VERTEX_LOCATION:-global}"
ENV_VARS="$ENV_VARS,NEXT_PUBLIC_APP_URL=$APP_URL"
if [[ "$USE_CLOUD_SQL" == 1 ]]; then
  ENV_VARS="$ENV_VARS,CLOUD_SQL_CONNECTION_NAME=$CLOUD_SQL_CONNECTION_NAME"
  ENV_VARS="$ENV_VARS,CLOUD_SQL_DB=$DB_NAME"
  ENV_VARS="$ENV_VARS,CLOUD_SQL_USER=$CLOUD_SQL_USER"
fi
[[ -n "${GEMINI_CHAT_MODEL:-}" ]]   && ENV_VARS="$ENV_VARS,GEMINI_CHAT_MODEL=$GEMINI_CHAT_MODEL"
[[ -n "${GEMINI_VISION_MODEL:-}" ]] && ENV_VARS="$ENV_VARS,GEMINI_VISION_MODEL=$GEMINI_VISION_MODEL"
[[ -n "${GOOGLE_HEALTH_CLIENT_ID:-}" ]]    && ENV_VARS="$ENV_VARS,GOOGLE_HEALTH_CLIENT_ID=$GOOGLE_HEALTH_CLIENT_ID"
[[ -n "${GOOGLE_HEALTH_REDIRECT_URI:-}" ]] && ENV_VARS="$ENV_VARS,GOOGLE_HEALTH_REDIRECT_URI=$GOOGLE_HEALTH_REDIRECT_URI"

# Secrets to mount as env vars (only those that exist).
SECRETS="FIREBASE_SERVICE_ACCOUNT_B64=FIREBASE_SERVICE_ACCOUNT_B64:latest"
SECRETS="$SECRETS,GCP_SERVICE_ACCOUNT_B64=GCP_SERVICE_ACCOUNT_B64:latest"
[[ "$USE_CLOUD_SQL" == 1 ]]                  && SECRETS="$SECRETS,CLOUD_SQL_PASSWORD=CLOUD_SQL_PASSWORD:latest"
[[ -n "${GOOGLE_HEALTH_CLIENT_SECRET:-}" ]] && SECRETS="$SECRETS,GOOGLE_HEALTH_CLIENT_SECRET=GOOGLE_HEALTH_CLIENT_SECRET:latest"
[[ -n "${TOKEN_ENCRYPTION_KEY:-}" ]]        && SECRETS="$SECRETS,TOKEN_ENCRYPTION_KEY=TOKEN_ENCRYPTION_KEY:latest"

if [[ "$USE_CLOUD_SQL" == 1 ]]; then
  echo "==> Deploying to Cloud Run (with Cloud SQL via the connector, min-instances=$MIN_INSTANCES)…"
else
  echo "==> Deploying to Cloud Run (no Cloud SQL — free food/exercise fallbacks, min-instances=$MIN_INSTANCES)…"
fi
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances "$MIN_INSTANCES" \
  --memory 1Gi \
  --set-env-vars "$ENV_VARS" \
  --set-secrets "$SECRETS"

echo
echo "==> Done. Service URL:"
gcloud run services describe "$SERVICE" --region "$REGION" --format="value(status.url)"
