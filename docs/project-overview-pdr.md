# Project Overview

## 1. Project identity

- Product in code: `Leave Management System`
- Repository shape: monorepo-style single checkout with:
  - frontend app at repo root
  - backend app in `backend/`
- Main domain: HR operations for leave, attendance, overtime, comp-off, employee admin, device management, skills tracking, audit logs, mail settings, and notifications

## 2. Current stacks

### Frontend

- `Next.js 16` App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- Radix/shadcn component set under `components/ui/*`
- `axios` for API access
- `@microsoft/fetch-event-source` for SSE notifications
- `recharts` for dashboard/report charts

### Backend

- `Express`
- `TypeScript`
- `Prisma`
- `PostgreSQL`
- `Zod`
- `JWT` access + refresh flow
- `multer` for local uploads
- `nodemailer` for outbound mail
- `node-cron` for scheduled jobs
- Swagger in development only

## 3. Product scope in the current repo

### Frontend routes

- `/` - login
- `/dashboard` - role-aware summary dashboard
- `/dashboard/activity-log` - audit log page for HR/admin-eligible users
- `/dashboard/approval` - leave approval queue
- `/dashboard/attendance` - attendance check-in/check-out and calendar details
- `/dashboard/compoff` - comp-off listing and summaries
- `/dashboard/devices` - device management
- `/dashboard/employees` - employee directory and admin actions
- `/dashboard/leave-balances` - leave-balance overview page
- `/dashboard/leave-detail/[id]` - leave request detail view
- `/dashboard/leave-history` - personal or scoped leave history
- `/dashboard/leave-request` - legacy standalone leave request page
- `/dashboard/overtime` - overtime submission and review
- `/dashboard/profile` - profile, avatar, password, personal widgets
- `/dashboard/reports` - reports and exports
- `/dashboard/settings` - system settings including mail controls
- `/dashboard/skills` - skills matrix and management UI
- `/dashboard/skills/settings` - skills-specific settings page
- `/guild-ui` - design-system / UI workbench page

### Backend API modules

- `auth`
- `users`
- `leave-types`
- `leave-balances`
- `leave-requests`
- `overtime`
- `comp-off`
- `attendances`
- `holidays`
- `dashboard`
- `reports`
- `settings`
- `departments`
- `notifications`
- `devices`
- `skills`
- `user-skills`
- `audit-logs`
- `mail` service support

## 4. Roles and access model

- `EMPLOYEE` - self-service leave, attendance, profile, personal views
- `MANAGER` - approval and scoped team visibility
- `HR` - broader operational access
- `ADMIN` - full system access

Important runtime reality:

- frontend navigation is role-aware, but hard enforcement still depends on backend middleware and service-level scope checks
- some pages are client-rendered and redirect after client bootstrap rather than via server middleware

## 5. Core business flows

### Auth/session

- login with username or email + password
- backend returns access token in response body
- backend sets refresh token in `httpOnly` cookie
- frontend persists access token and user data in `localStorage`
- axios interceptor calls `/api/auth/refresh-token` on `401`

### Leave lifecycle

- employee creates leave request with full-day, half-day, or hourly-like date/time shaping from shared helpers/UI
- backend validates overlap, dates, policies, approver resolution, and balances
- approver or privileged roles approve/reject
- cancellation and balance restoration depend on status and role

### Overtime and comp-off

- employee submits overtime
- approver approves/rejects
- approved overtime can produce comp-off credit
- daily cron handles comp-off expiration logic

### Attendance

- employee checks in / checks out
- backend persists one record per `(userId, date)`
- dashboard/profile pages reuse attendance-derived summaries and visualizations

### Notifications

- notifications are stored in database
- frontend reads list and unread counters via REST
- frontend listens to `/api/notifications/stream` via SSE

### Operational admin extensions

- device inventory, assignment, maintenance, and device audit logs
- skill categories, skills, and user skill mappings
- global audit log visibility for permitted roles
- mail settings and template-driven mail sending support

## 6. Runtime architecture snapshot

- frontend is mostly client-rendered
- shared dashboard shell: `app/dashboard/layout.tsx` -> `components/app-layout.tsx`
- shared API client: `lib/api-client.ts`
- shared business/date helpers: `lib/hr-utils.ts`
- backend follows `router -> controller -> service -> validation`
- backend entry points: `backend/src/app.ts` and `backend/src/server.ts`
- database source of truth: `backend/prisma/schema.prisma`

## 7. Important implementation realities

- `next.config.mjs` sets `typescript.ignoreBuildErrors = true`
- frontend build runs Prettier before `next build`
- backend build runs Prettier before `tsc`
- backend tests exist only lightly; coverage is still sparse
- Swagger is mounted only when `NODE_ENV=development`
- uploads are stored on local disk and served from `/uploads`
- SSE fanout is in-memory and therefore single-instance oriented

## 8. Docs reading order

Read in this order when reloading context:

1. `docs/project-overview-pdr.md`
2. `docs/codebase-summary.md`
3. `docs/system-architecture.md`
4. `docs/deployment-guide.md`
5. `docs/code-standards.md`

## 9. High-value source files

- Frontend root layout: `app/layout.tsx`
- Frontend login page: `app/page.tsx`
- Dashboard shell: `components/app-layout.tsx`
- API/session client: `lib/api-client.ts`
- Shared HR helpers: `lib/hr-utils.ts`
- Backend app composition: `backend/src/app.ts`
- Backend bootstrap: `backend/src/server.ts`
- Prisma schema: `backend/prisma/schema.prisma`
- Seed data: `backend/prisma/seed.ts`
