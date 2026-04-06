# Codebase Summary

## 1. Repository layout

```text
.
|- app/                    # Next.js App Router pages
|- components/             # Shared UI shell, feature components, shadcn primitives
|- hooks/                  # Client hooks such as notifications
|- lib/                    # Frontend API/session/business helpers
|- public/                 # Static assets
|- styles/                 # Additional global styling assets
|- backend/                # Express + Prisma backend app
|- docs/                   # Maintained onboarding and runtime docs
|- plans/                  # Historical planning artifacts, not source of truth
```

## 2. Frontend summary

### 2.1 Architecture

- App Router is used for routing
- many pages are client components and fetch after mount
- there is no centralized store like Redux/Zustand/TanStack Query
- session state is inferred from browser storage plus `/api/auth/me`
- shared layout comes from `app/dashboard/layout.tsx` and `components/app-layout.tsx`

### 2.2 Main routes in repo

| Route | Purpose | Audience |
| --- | --- | --- |
| `/` | Login screen | all |
| `/dashboard` | Summary dashboard | all authenticated users |
| `/dashboard/activity-log` | Audit log visibility | HR/admin-eligible |
| `/dashboard/approval` | Leave approval inbox | manager/hr/admin |
| `/dashboard/attendance` | Attendance actions and daily detail | all |
| `/dashboard/compoff` | Comp-off records | mixed |
| `/dashboard/devices` | Device inventory and lifecycle | privileged roles |
| `/dashboard/employees` | Employee management | HR/admin |
| `/dashboard/leave-balances` | Leave balance overview | all authenticated users with role-based scope |
| `/dashboard/leave-detail/[id]` | Leave detail page | scoped |
| `/dashboard/leave-history` | Leave history and actions | scoped |
| `/dashboard/leave-request` | Legacy standalone leave request form | all |
| `/dashboard/overtime` | Overtime request/review | mixed |
| `/dashboard/profile` | Profile, avatar, password, widgets | all |
| `/dashboard/reports` | Reports and export flows | manager/hr/admin |
| `/dashboard/settings` | System settings and mail controls | HR/admin |
| `/dashboard/skills` | Skills matrix and management | scoped/privileged |
| `/dashboard/skills/settings` | Skills settings UI | privileged |
| `/guild-ui` | UI/design-system sandbox | internal |

### 2.3 Important frontend files

- `app/layout.tsx` - global HTML shell, Inter font, toaster, analytics
- `app/globals.css` - design tokens and global utility classes
- `app/page.tsx` - login page
- `components/app-layout.tsx` - dashboard bootstrap, sidebar, topbar, notifications, logout
- `components/leave-request-modal.tsx` - primary reusable leave request flow
- `components/leave-detail-modal.tsx` - leave detail modal
- `components/calendar-day-detail-modal.tsx` - attendance/calendar detail modal
- `hooks/use-notifications.ts` - notification REST + SSE client logic
- `lib/api-client.ts` - access token persistence, refresh flow, API error normalization
- `lib/hr-utils.ts` - shared date/role/leave helper logic
- `lib/notification-utils.ts` - notification formatting and deep-link helpers

### 2.4 Session and API pattern

- base URL comes from `NEXT_PUBLIC_API_URL`, fallback `http://localhost:4000`
- access token is stored in `localStorage`
- refresh token is kept in cookie and sent with `withCredentials: true`
- axios interceptor retries once after refresh
- if refresh fails, frontend clears session and redirects to `/`

### 2.5 UI system

- Tailwind v4 + CSS variables in `app/globals.css`
- font is `Inter` from `next/font/google`
- default palette is jade/green with light neutral backgrounds
- reusable primitives live in `components/ui/*`
- the app includes light animation helpers such as `animate-fade-in` and stagger classes

## 3. Backend summary

### 3.1 Architecture

- Express app is composed in `backend/src/app.ts`
- modules follow `router / controller / service / validation`
- Zod validates request bodies, params, and queries in module-specific validation files
- Prisma singleton in `backend/src/config/prisma.ts` talks to PostgreSQL
- JSON responses serialize `BigInt` values as strings globally

### 3.2 API route map

| Prefix | Responsibility |
| --- | --- |
| `/api/auth` | login, refresh, logout, me, profile, password, avatar |
| `/api/users` | employee directory and admin operations |
| `/api/leave-types` | leave type catalog |
| `/api/leave-balances` | balance list, recalc, adjust |
| `/api/leave-requests` | leave request CRUD and approvals |
| `/api/overtime` | overtime submit/approve/reject |
| `/api/comp-off` | comp-off list/summary/approval |
| `/api/attendances` | attendance operations |
| `/api/holidays` | holiday calendar |
| `/api/dashboard` | dashboard aggregates |
| `/api/reports` | reporting and exports |
| `/api/settings` | system settings including mail-related settings |
| `/api/departments` | department dropdown/master data |
| `/api/notifications` | list/read/read-all/stream |
| `/api/devices` | device inventory, assignment, maintenance |
| `/api/skills` | skills and categories |
| `/api/user-skills` | user skill mapping |
| `/api/audit-logs` | audit log listing |

### 3.3 Important backend files

- `backend/src/app.ts` - middleware, CORS, rate limit, router mounting
- `backend/src/server.ts` - HTTP bootstrap and cron startup
- `backend/src/config/env.ts` - env loading and validation
- `backend/src/config/swagger.ts` - Swagger setup for development
- `backend/src/utils/jwt.ts` - access/refresh signing and verification
- `backend/src/modules/auth/auth.service.ts` - auth/session logic
- `backend/src/modules/leave-requests/leave-requests.service.ts` - main leave workflow
- `backend/src/modules/leave-balances/leave-balances.service.ts` - balance calculations and adjustments
- `backend/src/modules/overtime/overtime.service.ts` - overtime rules and comp-off generation
- `backend/src/modules/notifications/notifications.stream.ts` - SSE registry
- `backend/src/modules/mail/mail.service.ts` - outbound mail support
- `backend/src/jobs/expire-compoff.job.ts` - scheduled expiration job
- `backend/prisma/schema.prisma` - DB schema source of truth
- `backend/prisma/seed.ts` - default seed data

## 4. Database and domain model

### Core HR entities

- `User`
- `LeaveType`
- `LeaveBalance`
- `LeaveRequest`
- `OvertimeRecord`
- `CompOffRecord`
- `Attendance`
- `Holiday`
- `Department`
- `Setting`
- `Notification`

### Operational extension entities

- `Device`
- `DeviceImage`
- `DeviceSpec`
- `DeviceAssignment`
- `DeviceMaintenanceLog`
- `DeviceAuditLog`
- `AuditLog`
- `SkillCategory`
- `Skill`
- `UserSkill`

### Key enums present in schema

- `UserRole`
- `LeaveRequestStatus`
- `DurationMode`
- `OvertimeStatus`
- `CompensationType`
- `NotificationType`
- `NotificationEntityType`
- `DeviceStatus`
- `DeviceType`
- `AssignmentStatus`
- `MaintenanceStatus`
- `DeviceAuditAction`
- `AuditAction`
- `AuditModule`

## 5. Runtime and deployment shape

### Local non-Docker defaults

- frontend: `3000`
- backend: `4000`
- database: external/local PostgreSQL if not using Docker

### Docker ports used by the repo

- frontend: `5500`
- backend: `5501`
- PostgreSQL: `5532`

### Upload and static file behavior

- backend serves local files from `/uploads`
- frontend rewrites `/uploads/:path*` to `BACKEND_URL`
- uploaded files are persisted to `backend/uploads`

## 6. Current build and test reality

- root `pnpm build` runs Prettier before `next build`
- `next.config.mjs` sets `typescript.ignoreBuildErrors = true`
- `pnpm -C backend build` runs Prettier before `tsc`
- backend build depends on generated Prisma client
- backend has `vitest`, but automated coverage is still limited
- frontend has no dedicated test setup in this repo

## 7. Repo caveats worth remembering

- two leave request UI flows still exist: modal-based reusable flow and legacy standalone page
- frontend protected-route behavior is still client-side oriented
- access token lives in browser storage, so XSS sensitivity remains relevant
- settings are stored as JSON in `Setting.value`
- SSE registry is in-memory only and is not horizontally scalable as-is
- `Department` remains soft master data rather than a strict relation from `User.department`
