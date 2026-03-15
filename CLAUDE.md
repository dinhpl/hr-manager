# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack HR management system for leave, overtime, comp-off, and attendance tracking. Multi-role (Employee, Manager, HR, Admin) with approval workflows, real-time notifications via SSE, and Excel report generation.

## Development Commands

### Full Stack (Primary — always used locally)
```bash
docker-compose -f docker-compose.dev.yml up
```
- Frontend: http://localhost:5500
- Backend API: http://localhost:5501
- Swagger Docs: http://localhost:5501/api/docs
- PostgreSQL: localhost:5532

### Local Development (without Docker)
```bash
# Frontend
pnpm dev          # Next.js dev server
pnpm build        # Runs prettier then next build
pnpm lint         # ESLint
pnpm format       # Prettier write
pnpm format:check # Prettier check

# Backend (from /backend)
pnpm dev          # tsx watch src/server.ts
pnpm build        # Runs prettier then tsc

# Database (from /backend)
pnpm db:generate  # prisma generate
pnpm db:migrate   # prisma migrate dev
pnpm db:push      # prisma db push
pnpm db:seed      # Seed base data
pnpm db:seed:holidays  # Seed holiday calendar

# Tests (from /backend)
pnpm test         # vitest run
pnpm test:watch   # vitest (interactive)
```

## Architecture

### Frontend (`/app`, `/components`, `/hooks`, `/lib`)
Next.js 15 App Router with TypeScript. All dashboard pages live under `app/dashboard/`. API calls use an Axios instance from `lib/`. Real-time updates use `@microsoft/fetch-event-source` for SSE.

### Backend (`/backend/src`)
Express.js with modular architecture. Each feature is a self-contained module under `backend/src/modules/` with its own router, service, and types.

**Modules:**
- `auth/` — JWT auth (access token 15m, refresh token 7d via httpOnly cookie)
- `users/` — CRUD, profile, role/department management
- `leave-types/`, `leave-balances/`, `leave-requests/` — Full leave workflow
- `overtime/`, `comp-off/` — Overtime logging and comp-off conversion
- `attendances/` — Check-in/check-out, work hours calculation
- `holidays/` — Holiday calendar (excluded from leave day counts)
- `dashboard/` — Aggregated metrics
- `reports/` — Excel export via XLSX
- `notifications/` — SSE streaming, read/unread tracking
- `settings/` — Key-value config store (JSON values in `Setting` model)
- `departments/` — Department master data
- `jobs/` — node-cron scheduled tasks
- `middlewares/` — Auth guards, error handling, validation

### Database (Prisma + PostgreSQL)
Schema at `backend/prisma/schema.prisma`. Key relationships:
- `User` has `managerId` self-relation (hierarchy)
- `LeaveRequest` → `User` + `LeaveType` + optional `approver`
- `OvertimeRecord` → can generate `CompOffRecord`
- `LeaveBalance` unique per `(userId, leaveTypeId, year)`
- `Attendance` unique per `(userId, date)`
- `Notification` linked to entities via `entityType` + `entityId`

### Authentication Flow
JWT: access token in Authorization header, refresh token in httpOnly cookie. CORS allows localhost:3000, localhost:5500, and `FRONTEND_URL` env var.

## Environment Variables

Frontend (`.env` / `.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:5501
BACKEND_URL=http://backend:5501   # internal Docker URL
```

Backend (`backend/.env`):
```
DATABASE_URL=postgresql://postgres:secret@localhost:5532/hr_leave_db
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
PORT=5501
UPLOAD_DIR=uploads/leave-attachments
```

## Key Conventions

- **Shared Prettier config:** Root `.prettierrc` is used by both frontend and backend (`pnpm build` runs format first)
- **BigInt PKs:** All Prisma models use `BigInt` primary keys — serialize carefully in JSON responses
- **File uploads:** Multer saves to `UPLOAD_DIR`, served at `/uploads/` static route
- **Rate limiting:** 200 req/min per IP on all API routes
- **API versioning:** All routes prefixed `/api/`, docs at `/api/docs` (dev only)
