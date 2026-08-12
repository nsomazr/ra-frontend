#!/usr/bin/env bash
# Assess frontend — production deploy with pm2 on :3087
# Independent of the API. Set API_URL to https://api.assess.nileagi.com
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Error: pm2 is not installed. Run: npm install -g pm2"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

PORT="${PORT:-${FRONTEND_PORT:-3087}}"
PM2_NAME="${PM2_APP_NAME:-assess-frontend}"

pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 start server.js \
  --name "$PM2_NAME" \
  --cwd "$(pwd)" \
  --update-env

pm2 save
echo "assess-frontend deployed on :${PORT} (pm2: ${PM2_NAME})"
echo "Public URL: https://assess.nileagi.com → 127.0.0.1:${PORT}"
echo "API_URL=${API_URL:-https://api.assess.nileagi.com}"
pm2 status "$PM2_NAME"
