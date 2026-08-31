#!/usr/bin/env bash
set -e

echo "=================================================="
echo "🛡️  Starting LiquiGuard Sentinel & Frontend Demo"
echo "=================================================="

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing root dependencies..."
  npm install
fi

echo "🚀 Launching Daemon on port 3001 and Frontend on port 3000..."
npx concurrently --kill-others \
  "cd daemon && npm run dev" \
  "cd frontend && npm run dev"
