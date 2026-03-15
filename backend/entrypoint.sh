#!/bin/sh
set -e

echo "[entrypoint] Applying Prisma schema to database..."
npx prisma db push --accept-data-loss
echo "[entrypoint] Schema applied."

# Only seed when DB is empty (no users yet) — prevents wiping data on restart/rebuild
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then(n => { console.log(n); return p.\$disconnect(); }).catch(() => { console.log(0); });
")

if [ "$USER_COUNT" = "0" ]; then
  echo "[entrypoint] DB is empty — seeding initial data..."
  npx tsx prisma/seed.ts
  echo "[entrypoint] Seed complete."
else
  echo "[entrypoint] DB already has $USER_COUNT users — skipping seed to preserve existing data."
fi

echo "[entrypoint] Bootstrapping default holidays if holiday table is empty..."
npx tsx prisma/seed-holidays.ts
echo "[entrypoint] Holiday bootstrap complete."

echo "[entrypoint] Starting server..."
exec node dist/server.js
