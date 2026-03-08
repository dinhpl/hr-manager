# Debug Report: Prisma Migrations Not Running in Docker

**Date:** 2026-03-08
**Error:** `The table 'public.users' does not exist in the current database` on POST /api/auth/login

---

## Root Cause Summary

**Three compounding problems** cause the `users` table to be missing:

1. **No `prisma migrate deploy` in startup** — Dockerfile CMD is `node dist/server.js` with zero migration step
2. **Conflict between `init.sql` and Prisma** — `hr_leave_db.sql` mounts as `init.sql`, which creates tables via raw SQL; Prisma's migration history (`_prisma_migrations`) never exists, so Prisma thinks DB is unmanaged
3. **No `migrations/` folder exists** — `backend/prisma/` only has `schema.prisma` and `seed.ts`; `prisma migrate deploy` has nothing to apply

---

## Current Startup Sequence

```
docker-compose up
  ├── db (postgres:16)
  │     └── runs hr_leave_db.sql via docker-entrypoint-initdb.d/
  │           → creates all tables (users, leave_types, etc.) via raw SQL
  │           → BUT: no _prisma_migrations table → Prisma doesn't know these tables exist
  │
  └── backend (depends_on: db healthy)
        └── CMD: node dist/server.js   ← starts immediately, no migration step
              └── Prisma Client queries public.users  ← TABLE EXISTS (from init.sql)
                  BUT if pgdata volume is NEW or db container rebuilt without init.sql →
                  init.sql only runs on FIRST init (empty volume) → table may not exist
```

**Why the error happens:**
- `docker-entrypoint-initdb.d/init.sql` **only runs when the PostgreSQL data directory is empty**
- If `pgdata` volume already exists (from previous run) but the DB was re-created, or the volume was wiped and init.sql didn't re-run cleanly → tables are absent
- Since Prisma has no `migrations/` folder, `prisma migrate deploy` would fail too — there is literally nothing to deploy

---

## Why Migrations Are Not Applied

| Issue | Detail |
|-------|--------|
| No migrations folder | `backend/prisma/migrations/` does not exist — `prisma migrate dev` was never run locally |
| No deploy step in Dockerfile | CMD is `node dist/server.js`; no `prisma migrate deploy` before server start |
| init.sql conflict | Raw SQL schema bypasses Prisma migration tracking entirely |
| init.sql only runs once | PostgreSQL only executes `docker-entrypoint-initdb.d/` files on fresh volume; rebuilds without wiping volume skip it |

---

## Files That Need to Change

| File | Change |
|------|--------|
| `backend/Dockerfile` | Add entrypoint script or change CMD to run `prisma migrate deploy` before server |
| `backend/entrypoint.sh` | **New file** — run migration then exec server |
| `docker-compose.yml` | Remove `init.sql` volume mount (let Prisma own the schema) OR keep it only for seed data |
| `backend/prisma/migrations/` | **Must be created** by running `prisma migrate dev --name init` locally first |

---

## Exact Fix

### Step 1 — Generate migration locally (one-time, run on dev machine)

```bash
cd backend
# Point to local DB temporarily, then:
DATABASE_URL="postgresql://postgres:secret@localhost:5532/hr_leave_db" \
  pnpm exec prisma migrate dev --name init
```

This creates `backend/prisma/migrations/YYYYMMDDHHMMSS_init/migration.sql` and `backend/prisma/migrations/migration_lock.toml`.
Commit the `migrations/` folder to git.

---

### Step 2 — Create `backend/entrypoint.sh` (new file)

```bash
#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] Starting server..."
exec node dist/server.js
```

---

### Step 3 — Update `backend/Dockerfile`

**Before:**
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g pnpm
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 5501
CMD ["node", "dist/server.js"]
```

**After:**
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g pnpm
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 5501
CMD ["./entrypoint.sh"]
```

---

### Step 4 — Update `docker-compose.yml`

Remove the `init.sql` mount from db service (Prisma will own schema creation via `migrate deploy`):

**Before:**
```yaml
  db:
    ...
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./hr_leave_db.sql:/docker-entrypoint-initdb.d/init.sql
```

**After:**
```yaml
  db:
    ...
    volumes:
      - pgdata:/var/lib/postgresql/data
```

> **Why remove init.sql?** `hr_leave_db.sql` starts with `CREATE DATABASE hr_leave_db` and `\connect hr_leave_db` which fails inside Docker (DB already exists via `POSTGRES_DB`). It also creates tables without Prisma's `_prisma_migrations` tracking, causing permanent schema drift.
> If you need seed data, extract just the `INSERT` statements into a separate `seed.sql` or use `prisma/seed.ts`.

---

### Step 5 — Wipe stale volume before first clean run

```bash
docker compose down -v   # removes pgdata volume
docker compose up --build
```

---

## Final Startup Sequence (After Fix)

```
docker-compose up
  ├── db starts → healthy (empty DB, no tables yet)
  └── backend starts
        └── entrypoint.sh
              ├── prisma migrate deploy  → applies migrations/YYYYMMDD_init/migration.sql
              │     → creates _prisma_migrations table + all app tables
              └── node dist/server.js   → server starts, users table EXISTS ✓
```

---

## Unresolved Questions

- `hr_leave_db.sql` contains seed data (users, balances, etc.) — confirm whether to port those INSERTs into `prisma/seed.ts` and wire `pnpm db:seed` into entrypoint, or drop the seed data for production
- Password hashes in `hr_leave_db.sql` — are they bcrypt? Seed.ts must use the same hashing
