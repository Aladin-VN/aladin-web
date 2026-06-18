#!/bin/bash
# Run this to set DATABASE_URL on Vercel
# Usage: ./scripts/set-vercel-env.sh <VERCEL_TOKEN>

TOKEN=${1:-$VERCEL_TOKEN}
if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <VERCEL_TOKEN>"
  echo "Or set VERCEL_TOKEN env var"
  exit 1
fi

PROJECT_ID=$(vercel ls --token=$TOKEN 2>/dev/null | head -1 | awk '{print $2}')
if [ -z "$PROJECT_ID" ]; then
  echo "Could not find Vercel project. Make sure you're logged in."
  exit 1
fi

# Set DATABASE_URL
echo "Setting DATABASE_URL on Vercel..."
vercel env rm DATABASE_URL production --yes --token=$TOKEN 2>/dev/null
echo "postgresql://neondb_owner:npg_4kRzjDV8pTEA@ep-twilight-river-aotfef9p-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" | vercel env add DATABASE_URL production --token=$TOKEN

echo "Done! Redeploy with: vercel --prod --token=$TOKEN"
