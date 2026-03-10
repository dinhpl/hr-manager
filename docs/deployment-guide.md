# Deployment Guide

## 1. Apps and ports

### Local default ports

- Frontend dev: `3000`
- Backend dev: `4000`

### Docker ports used in repo

- Frontend: `5500`
- Backend: `5501`
- PostgreSQL: `5532`

## 2. Required environment variables

### Frontend

- `NEXT_PUBLIC_API_URL` - public backend base URL.
- `BACKEND_URL` - backend URL used by Next server rewrite for `/uploads/*`, mainly in Docker.

### Backend

From `backend/.env.example`:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `PORT`
- `NODE_ENV`
- `FRONTEND_URL`
- `UPLOAD_DIR`

## 3. Local development without Docker

### Backend

```bash
cd backend
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Notes:

- backend build depends on generated Prisma client.
- Swagger docs are available only in development at `/api/docs`.

### Frontend

```bash
cp .env.local.example .env.local   # only if such file is later added
pnpm install
NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm dev
```

Current repo does not include a dedicated frontend `.env.local.example`, so set `NEXT_PUBLIC_API_URL` manually if needed.

## 4. Docker development

Use `docker-compose.dev.yml`.

Behavior in current file:

- Postgres starts on `5532`.
- Backend container installs deps, generates Prisma client, pushes schema, seeds if user table is empty, then runs `pnpm dev`.
- Frontend container installs deps and runs `pnpm dev --hostname 0.0.0.0 --port 5500`.

Typical command:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## 5. Docker production-like stack

Use `docker-compose.yml`.

Behavior in current file:

- backend image builds from `backend/Dockerfile`
- frontend image builds from root `Dockerfile`
- frontend proxies `/uploads/*` to backend using `BACKEND_URL`
- backend persists uploaded files through mounted `./backend/uploads:/app/uploads`

Typical command:

```bash
docker compose up --build
```

Note: current `docker-compose.yml` expects an external Docker network named `backend`.

## 6. Build commands

### Frontend

```bash
pnpm build
```

Current behavior:

- runs prettier first
- then runs `next build`
- TypeScript errors may not fail build because `next.config.mjs` sets `ignoreBuildErrors: true`

### Backend

```bash
pnpm -C backend build
```

Current behavior:

- runs prettier first
- then `tsc`
- requires Prisma client generation first if not already generated

## 7. Test commands

### Backend

```bash
pnpm -C backend test
```

Current state:

- Vitest is configured.
- `backend/tests/setup.ts` exists.
- repo currently has little or no meaningful automated test coverage.

### Frontend

- No dedicated frontend test setup is present.

## 8. Static file handling

- Backend serves local files from `/uploads`.
- Frontend rewrites `/uploads/:path*` to backend URL in `next.config.mjs`.
- Any production deployment must preserve writable upload storage and stable public URL access.

## 9. Deployment caveats

- Refresh token strategy is stateless and simple, but weak for revocation-heavy security needs.
- SSE notifications are in-memory only; multi-instance backend deployment will need redesign.
- Local disk uploads are not cloud-native; object storage may be needed later.
- External network requirement in `docker-compose.yml` must exist before startup.
