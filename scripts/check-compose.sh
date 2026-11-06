#!/usr/bin/env sh
# Renders every Compose file with example values; any missing variable or syntax error fails.
set -eu

docker compose --env-file .env.example -f compose.local.yaml config -q
# Deployed live email requires a webhook signing secret, which .env.example leaves blank.
export RESEND_WEBHOOK_SECRET=synthetic-webhook-signing-secret
for environment in uat production; do
    APP_ENV="$environment" docker compose --env-file .env.example -f compose.deploy.yaml config -q
    APP_ENV="$environment" node scripts/check-compose-topology.mjs
done
SOURCE_REVISION=0000000000000000000000000000000000000000 PREVIEW_BACKEND_PORT=3001 PREVIEW_FRONTEND_PORT=3000 \
    docker compose --env-file .env.example -f compose.preview.yaml config -q

echo 'Compose files render.'
