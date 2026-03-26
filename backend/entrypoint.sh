#!/bin/sh
set -e

mkdir -p uploads

echo "[entrypoint] Applying Prisma schema to database..."
node_modules/.bin/prisma db push --accept-data-loss
echo "[entrypoint] Schema applied."

echo "[entrypoint] Starting server..."
exec node dist/src/server.js
