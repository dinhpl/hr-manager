# Project Overview / PDR

## 1. Project identity

- Name in code: `Leave Management System`.
- Repository shape: one frontend app at repo root and one backend app in `backend/`.
- Frontend stack: `Next.js 16` App Router, `React 19`, Tailwind CSS v4, shadcn/Radix UI, Recharts.
- Backend stack: `Express`, `Prisma`, `PostgreSQL`, `Zod`, JWT auth, SSE notifications.
- Main business domain: HR leave management, leave approval, overtime, comp-off, employee admin, reports, settings.

## 2. Product goal

This system manages employee leave requests end to end:

- employees log in, see balances, create leave requests, check history, update profile;
- managers/HR/admin approve or reject requests;
- HR/admin manage employees, settings, reports, leave types, balances;
- overtime approval can generate comp-off credit;
- in-app notifications are delivered by REST + Server-Sent Events.

## 3. Current product scope in code

### Frontend routes

- `/` - login.
- `/dashboard` - role-aware dashboard.
- `/dashboard/leave-history` - leave history, filters, detail, edit/cancel pending.
- `/dashboard/approval` - approval queue and bulk approve.
- `/dashboard/employees` - employee management for HR/admin.
- `/dashboard/settings` - leave policy and approval flow editor.
- `/dashboard/profile` - self profile, avatar, password.
- `/dashboard/reports` - analytics and CSV export.
- `/dashboard/attendance` - attendance check-in/check-out screen.
- `/dashboard/leave-balances` - leave balance overview (dedicated page).
- `/dashboard/leave-detail/[id]` - leave request detail view.
- `/dashboard/leave-request` - older standalone leave request page.
- `/dashboard/overtime` - overtime screen.
- `/dashboard/compoff` - comp-off screen.

### Backend modules

- `auth`
- `users`
- `leave-types`
- `leave-balances`
- `leave-requests`
- `overtime`
- `comp-off`
- `attendances`
- `dashboard`
- `reports`
- `settings`
- `departments`
- `notifications`

## 4. User roles

- `EMPLOYEE` - self-service leave and profile.
- `MANAGER` - own data plus approval responsibility for assigned staff.
- `HR` - broader approval and admin access.
- `ADMIN` - full access.

Important: frontend hides or shows navigation by role, but hard enforcement still depends on backend APIs.

## 5. Core business flows

### Login/session

- User logs in with username or email plus password.
- Backend returns access token in response body and refresh token in httpOnly cookie.
- Frontend stores access token in `localStorage` or `sessionStorage` depending on `remember me`.
- Axios interceptor refreshes access token on `401` by calling `/api/auth/refresh-token`.

### Leave request lifecycle

- User creates leave request with full-day, half-day, or hourly mode.
- Backend resolves approver from manager first, then falls back to active HR/admin.
- Backend checks date validity, overlap, balance, and some settings-based rules.
- Approver can approve/reject; employee or HR/admin can cancel depending on status.
- Approval deducts balance; approved cancel restores balance.

### Overtime -> comp-off

- User submits overtime record.
- Approver approves or rejects.
- Approved overtime auto-creates an approved comp-off record with 90-day validity.

### Notifications

- Backend creates notification records on leave/overtime events.
- Frontend loads list + unread count via REST.
- Frontend opens SSE connection to `/api/notifications/stream` for realtime updates.

## 6. Architecture snapshot

- Frontend is mostly client-rendered; pages fetch directly from backend in `useEffect`.
- Shared frontend layout lives in `components/app-layout.tsx`.
- Shared frontend API wrapper lives in `lib/api-client.ts`.
- Shared business/date helpers live in `lib/hr-utils.ts`.
- Backend uses `router -> controller -> service -> Prisma`.
- Global app composition is in `backend/src/app.ts`.
- Database schema source of truth is `backend/prisma/schema.prisma`.

## 7. Important implementation realities

- No `README.md` exists in the repo root at the time of this analysis.
- Frontend has no middleware-based route protection; redirect happens after client bootstraps.
- A legacy leave request page and a newer modal flow both exist; this is duplicated business UI.
- `next.config.mjs` sets `typescript.ignoreBuildErrors = true`.
- Backend tests are scaffolded but there are effectively no real test files.
- Swagger is mounted only in backend development mode at `/api/docs`.

## 8. Fast re-onboarding reading order

For the next session, load docs in this order:

1. `docs/project-overview-pdr.md`
2. `docs/codebase-summary.md`
3. `docs/system-architecture.md`
4. `docs/project-roadmap.md`
5. `docs/deployment-guide.md`

## 9. Key source files

- Frontend root layout: `app/layout.tsx`
- Login page: `app/page.tsx`
- Dashboard shell: `components/app-layout.tsx`
- API client: `lib/api-client.ts`
- Shared HR/date helpers: `lib/hr-utils.ts`
- Backend app composition: `backend/src/app.ts`
- Backend server bootstrap: `backend/src/server.ts`
- Prisma schema: `backend/prisma/schema.prisma`
- Seed data: `backend/prisma/seed.ts`

## 10. Current documentation intent

The docs in `docs/` are written so a future agent or developer can reload project context quickly without re-exploring the full codebase from zero.
