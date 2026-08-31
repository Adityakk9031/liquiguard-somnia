#!/usr/bin/env bash
set -e

echo "=========================================="
echo "🛡️  Deploying LiquiGuard to Somnia Shannon"
echo "=========================================="

# Check for environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ Error: PRIVATE_KEY is not set in .env"
  exit 1
fi

RPC_URL=${SOMNIA_RPC_URL:-"https://dream-rpc.somnia.network"}
echo "🌐 Using RPC: $RPC_URL"

# Deploy via Foundry Script
cd contracts
echo "📦 Running forge script deployment..."
forge script script/DeployLiquiGuard.s.sol:DeployScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --legacy \
  -vvv

echo "✅ Deployment finished successfully!"
