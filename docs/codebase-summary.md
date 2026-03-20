# Codebase Summary

## 1. Repository layout

```text
.
|- app/                    # Next.js App Router pages
|- components/             # Shared layout, domain modals, UI primitives
|- hooks/                  # Client hooks
|- lib/                    # Frontend API and business helpers
|- public/                 # Static assets
|- backend/                # Express + Prisma backend app
|- reports/                # Prior analysis notes
|- plans/                  # Implementation plans / historical planning docs
|- docs/                   # Persistent onboarding docs
```

## 2. Frontend summary

### 2.1 Frontend architecture

- App Router is used for routing, but almost all real pages are client components.
- There is no frontend state manager like Redux/Zustand/TanStack Query.
- State is local to each page with `useState`, `useEffect`, `useMemo`, `useCallback`.
- Data fetching is browser-side through Axios wrapper `lib/api-client.ts`.
- Shared shell is `app/dashboard/layout.tsx` -> `components/app-layout.tsx`.

### 2.2 Main routes

| Route                      | Purpose                                 | Main audience    |
| -------------------------- | --------------------------------------- | ---------------- |
| `/`                        | Login screen                            | all              |
| `/dashboard`               | Dashboard summary and quick actions     | all              |
| `/dashboard/leave-history` | Leave history and actions               | all              |
| `/dashboard/approval`      | Approval inbox                          | manager/hr/admin |
| `/dashboard/employees`     | Employee admin                          | hr/admin         |
| `/dashboard/settings`      | Leave policy and approval flow settings | hr/admin         |
| `/dashboard/profile`       | Personal profile/password/avatar        | all              |
| `/dashboard/reports`       | Reports and export CSV                  | manager/hr/admin |
| `/dashboard/attendance`    | Attendance check-in/check-out tracking  | all              |
| `/dashboard/leave-balances`| Leave balance overview per user/year    | all              |
| `/dashboard/leave-detail/[id]` | Leave request detail view           | all              |
| `/dashboard/leave-request` | Legacy standalone leave form            | all              |
| `/dashboard/overtime`      | Overtime request and review             | mixed            |
| `/dashboard/compoff`       | Comp-off records                        | mixed            |

### 2.3 Important frontend files

- `app/layout.tsx` - metadata, Google font, toaster, analytics.
- `app/globals.css` - design tokens, palette, Tailwind theme bindings.
- `app/page.tsx` - login flow and demo account UI.
- `components/app-layout.tsx` - auth bootstrap, sidebar, header, notifications, logout.
- `components/leave-request-modal.tsx` - main reusable leave request workflow.
- `components/leave-detail-modal.tsx` - leave request detail display.
- `components/calendar-day-detail-modal.tsx` - daily calendar detail modal.
- `hooks/use-notifications.ts` - notification REST + SSE client logic.
- `lib/api-client.ts` - token storage, refresh flow, API error normalization.
- `lib/hr-utils.ts` - date parsing, role mapping, leave-mode payload helpers.
- `lib/notification-utils.ts` - notification view model helpers and deep links.

### 2.4 Frontend API/session pattern

- Base URL comes from `NEXT_PUBLIC_API_URL`, fallback `http://localhost:4000`.
- Access token is stored in browser storage.
- Refresh token is kept in cookie and used with `withCredentials: true`.
- On expired access token, interceptor refreshes and retries once.
- If refresh fails, frontend clears session and redirects to `/`.

### 2.5 Frontend UX/design system pattern

- Tailwind v4 + CSS variables in `app/globals.css`.
- Public Sans via `next/font/google`.
- Jade/green brand palette.
- shadcn/Radix components in `components/ui/`.
- Some pages use utility classes heavily; some also use inline styles for exact brand colors.

## 3. Backend summary

### 3.1 Backend architecture

- Express app with global middlewares in `backend/src/app.ts`.
- Modules follow `router / controller / service / validation` split.
- Services contain most business logic.
- Prisma singleton in `backend/src/config/prisma.ts` talks to PostgreSQL.
- BigInt values are serialized as strings globally before JSON responses.

### 3.2 Backend route map

| Prefix                | Main responsibility                                   |
| --------------------- | ----------------------------------------------------- |
| `/api/auth`           | login, refresh, logout, me, profile, password, avatar |
| `/api/users`          | employee directory and admin operations               |
| `/api/leave-types`    | leave type catalog                                    |
| `/api/leave-balances` | balance list/init/recalculate/adjust                  |
| `/api/leave-requests` | leave request CRUD + approval actions                 |
| `/api/overtime`       | overtime submit/approve/reject                        |
| `/api/comp-off`       | comp-off list/summary/approval                        |
| `/api/dashboard`      | summary, calendar, recent requests                    |
| `/api/reports`        | leave, overtime, department, top users, CSV export    |
| `/api/settings`       | leave policy and approval flow JSON settings          |
| `/api/departments`    | department dropdown data                              |
| `/api/notifications`  | list/read/read-all/stream                             |

### 3.3 Important backend files

- `backend/src/app.ts` - middleware and router mounting.
- `backend/src/server.ts` - HTTP start and cron start.
- `backend/src/config/env.ts` - env validation.
- `backend/src/utils/jwt.ts` - access/refresh signing and verification.
- `backend/src/modules/auth/auth.service.ts` - auth/session logic.
- `backend/src/modules/leave-requests/leave-requests.service.ts` - core leave workflow.
- `backend/src/modules/overtime/overtime.service.ts` - overtime rules and comp-off generation.
- `backend/src/modules/notifications/notifications.stream.ts` - SSE connection registry.
- `backend/src/jobs/expire-compoff.job.ts` - daily expiration cron.
- `backend/prisma/schema.prisma` - full DB model.
- `backend/prisma/seed.ts` - seed data and default settings/users.

## 4. Database/domain model

### Core entities

- `User` - identity, role, org info, manager relation, active flag.
- `LeaveType` - leave catalog like AL, SL, WFH.
- `LeaveBalance` - per user, leave type, year.
- `LeaveRequest` - leave workflow records.
- `OvertimeRecord` - overtime workflow records.
- `CompOffRecord` - compensatory leave records.
- `Attendance` - daily check-in/check-out records, unique per (userId, date).
- `Setting` - JSON storage for leave policy and approval flow.
- `Department` - simple master table for active departments.
- `Notification` - per-user inbox items.

### Key enums

- `UserRole`: `EMPLOYEE`, `MANAGER`, `HR`, `ADMIN`
- `LeaveRequestStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`
- `OvertimeStatus`: `PENDING`, `APPROVED`, `REJECTED`

## 5. Runtime/deployment shape

### Local non-Docker

- Frontend usually on `3000`.
- Backend usually on `4000`.
- Postgres from local machine or custom container.

### Docker stack in repo

- Frontend on `5500`.
- Backend on `5501`.
- Postgres on `5532`.
- Frontend proxies `/uploads/*` to backend via `BACKEND_URL` rewrite.

## 6. Build/test status observed from repo

- Frontend build script runs formatter before `next build`.
- Backend build script runs formatter before `tsc`.
- Backend depends on generated Prisma client before build succeeds.
- `backend/tests/setup.ts` exists, but repo currently lacks meaningful backend test files.
- `next.config.mjs` ignores TypeScript build errors.

## 7. Most important code-level caveats

- Two leave request UI flows exist; prefer consolidating around modal-based flow.
- Frontend route protection is client-side only.
- Token in browser storage is XSS-sensitive.
- Settings are stored as loose JSON and some seeded keys do not match runtime-used keys exactly.
- SSE notification connections are in-memory only; no multi-instance fanout.
- `Department` table is not enforced as a relation from `User.department`.

## 8. Good files to inspect first when changing behavior

- Auth/session issue: `lib/api-client.ts`, `backend/src/modules/auth/auth.service.ts`
- Leave request issue: `components/leave-request-modal.tsx`, `backend/src/modules/leave-requests/leave-requests.service.ts`
- Notification issue: `hooks/use-notifications.ts`, `backend/src/modules/notifications/*`
- Role/scope issue: `components/app-layout.tsx`, backend routers + leave/dashboard/report services
- Deployment issue: `docker-compose.dev.yml`, `docker-compose.yml`, `next.config.mjs`, `backend/.env.example`
