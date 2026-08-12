#!/usr/bin/env bash
# Assess frontend — production deploy with pm2 on :3087
# Served publicly as https://assess.nileagi.com (reverse proxy -> 127.0.0.1:3087).
# Production .env should set:
#   API_URL=https://api.assess.nileagi.com
#   PUBLIC_URL=https://assess.nileagi.com
#   PORT=3087
#   NODE_ENV=production
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Error: pm2 is not installed. Run: npm install -g pm2"
  exit 1
fi

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "Set API_URL=https://api.assess.nileagi.com in .env before going live."
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

PORT="${PORT:-${FRONTEND_PORT:-3087}}"
PM2_NAME="${PM2_APP_NAME:-assess-frontend}"

pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 start ecosystem.config.cjs --env production --update-env
pm2 save
echo "assess-frontend deployed on :${PORT} (pm2: ${PM2_NAME})"
echo "Public URL: https://assess.nileagi.com (point reverse proxy at 127.0.0.1:${PORT})"
pm2 status "$PM2_NAME"
