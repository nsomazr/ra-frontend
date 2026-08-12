#!/usr/bin/env bash
# Assess frontend — Node static server on :3087 (local development)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
fi

if [ ! -d node_modules ]; then
  npm install
fi

export PORT="${FRONTEND_PORT:-${PORT:-3087}}"
export NODE_ENV="${NODE_ENV:-development}"
echo "Starting assess-frontend on http://0.0.0.0:${PORT}"
exec node server.js
