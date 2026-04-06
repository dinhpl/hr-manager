# Deployment Guide

## 1. Runtime targets and ports

### Local non-Docker defaults

- frontend dev: `3000`
- backend dev: `4000`

### Docker ports used by this repo

- frontend: `5500`
- backend: `5501`
- PostgreSQL: `5532`

## 2. Environment variables

### Frontend

- `NEXT_PUBLIC_API_URL` - browser-visible backend base URL
- `BACKEND_URL` - backend URL used by Next server-side rewrite for `/uploads/*`
- `NEXT_PUBLIC_VERSION` - optional build/version label

### Backend

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `PORT`
- `NODE_ENV`
- `FRONTEND_URL`
- `UPLOAD_DIR`
- `MAIL_ENABLED`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_SECURE`
- `MAIL_USER`
- `MAIL_PASSWORD`
- `MAIL_FROM_EMAIL`
- `MAIL_FROM_NAME`
- `MAIL_REPLY_TO`

## 3. Local development without Docker

### Backend

```bash
cd backend
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm db:seed:holidays
pnpm dev
```

Notes:

- backend env loader also reads root `.env` and `.env.local` if present
- Swagger docs are available only in development at `/api/docs`
- backend serves health check at `/health`

### Frontend

```bash
pnpm install
NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm dev
```

Notes:

- root repo does not currently ship a dedicated frontend `.env.local.example`
- if you want upload rewrites to work in local SSR contexts, also set `BACKEND_URL=http://localhost:4000`

## 4. Docker development

Use `docker-compose.dev.yml`.

Current behavior:

- database runs on `5532`
- backend runs on `5501`
- frontend runs on `5500`
- backend container:
  - installs dependencies
  - generates Prisma client
  - pushes schema
  - seeds users if DB is empty
  - seeds holidays
  - creates uploads directory
  - starts watch mode
- frontend container installs dependencies and starts `pnpm dev --hostname 0.0.0.0 --port 5500`

Command:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## 5. Docker production-like stack

Use `docker-compose.yml`.

Current behavior:

- backend image builds from `backend/`
- frontend image builds from root `Dockerfile`
- frontend receives build args for `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_VERSION`
- frontend rewrites `/uploads/*` to backend using `BACKEND_URL=http://backend:5501`
- backend persists uploads through mounted `./backend/uploads:/app/uploads`
- compose expects an external Docker network named `backend`

Command:

```bash
docker compose up --build
```

## 6. Build commands

### Frontend

```bash
pnpm build
```

Behavior:

- runs Prettier first
- then runs `next build`
- TypeScript errors may not fail the build because `next.config.mjs` sets `ignoreBuildErrors: true`

### Backend

```bash
pnpm -C backend build
```

Behavior:

- runs Prettier first
- then runs `tsc`
- requires Prisma client generation before build if it is missing

## 7. Test commands

### Backend

```bash
pnpm -C backend test
```

Current state:

- `vitest` is configured
- automated coverage is still limited

### Frontend

- no dedicated frontend test runner is configured in this repo

## 8. Static files and uploads

- backend serves files from `/uploads`
- frontend rewrites `/uploads/:path*` to `BACKEND_URL`
- deployments must preserve writable upload storage and stable public URL access

## 9. Operational caveats

- refresh-token strategy is stateless; revocation/rotation is limited
- SSE notification fanout is in-memory only
- uploads are local-disk based, not object-storage based
- production compose requires the external `backend` network to exist before startup
