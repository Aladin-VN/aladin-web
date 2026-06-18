#!/bin/bash
# ============================================
# ALADIN — Push schema to Turso
# Usage: ./scripts/turso-setup.sh
# Prerequisites: turso CLI installed and logged in
# ============================================
set -e

DB_NAME="aladin-demo"
ORG_NAME="${TURSO_ORG:-$(turso org list 2>/dev/null | head -1 | awk '{print $1}' || echo '')}"

if [ -z "$ORG_NAME" ]; then
  echo "❌ No Turso org found. Run: turso auth login && turso org list"
  exit 1
fi

echo "🚀 Setting up Turso database for ALADIN..."
echo "   Org: $ORG_NAME"
echo "   DB:  $DB_NAME"
echo ""

# 1. Create database (or use existing)
if turso db show "$DB_NAME" --org "$ORG_NAME" &>/dev/null; then
  echo "✅ Database '$DB_NAME' already exists"
else
  echo "📦 Creating database '$DB_NAME'..."
  turso db create "$DB_NAME" --org "$ORG_NAME"
  echo "✅ Database created"
fi

# 2. Get connection URL
DB_URL=$(turso db show "$DB_NAME" --org "$ORG_NAME" --url)
echo "   URL: $DB_URL"

# 3. Create auth token
echo "🔑 Creating auth token..."
AUTH_TOKEN=$(turso db tokens create "$DB_NAME" --org "$ORG_NAME" --no-expiry)
echo "   Token: ${AUTH_TOKEN:0:20}..."

# 4. Push schema via local SQLite -> dump -> import
echo ""
echo "📋 Pushing schema to Turso..."
echo "   Step 1: Creating local schema..."
rm -f db/custom.db
DATABASE_URL="file:./db/custom.db" npx prisma db push --force-reset 2>&1 | grep -E "(✔|Error)" || true

echo "   Step 2: Dumping SQL schema..."
sqlite3 db/custom.db .schema > /tmp/aladin-schema.sql

echo "   Step 3: Importing to Turso..."
echo ".read /tmp/aladin-schema.sql" | turso db shell "$DB_NAME" --org "$ORG_NAME" 2>/dev/null

echo "   Step 4: Cleaning up..."
rm -f db/custom.db /tmp/aladin-schema.sql

# 5. Restore local dev DB
DATABASE_URL="file:./db/custom.db" npx prisma db push 2>&1 | grep -E "(✔|Error)" || true

echo ""
echo "🎉 Turso setup complete!"
echo ""
echo "=== ADD THESE TO VERCEL ENVIRONMENT VARIABLES ==="
echo "DATABASE_URL=$DB_URL"
echo "TURSO_AUTH_TOKEN=$AUTH_TOKEN"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo ""
echo "=== DEPLOYMENT STEPS ==="
echo "1. Push code to GitHub"
echo "2. Import project on vercel.com"
echo "3. Add the 3 environment variables above in Vercel Dashboard"
echo "4. Deploy"
echo "5. Visit: POST https://your-domain.vercel.app/api/setup"
echo "   (This seeds the database with demo data)"