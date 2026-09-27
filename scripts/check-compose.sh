#!/usr/bin/env sh
# Renders every Compose file with example values; any missing variable or syntax error fails.
set -eu

docker compose --env-file .env.example -f compose.local.yaml config -q
docker compose --env-file .env.example -f compose.deploy.yaml config -q
SOURCE_REVISION=0000000000000000000000000000000000000000 PREVIEW_BACKEND_PORT=3001 PREVIEW_FRONTEND_PORT=3000 \
    docker compose --env-file .env.example -f compose.preview.yaml config -q

echo 'Compose files render.'
