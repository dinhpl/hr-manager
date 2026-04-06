# Code Standards

## 1. Purpose

These standards describe how the repo is currently organized and what new changes should align with.

## 2. Frontend standards

### Routing and composition

- keep routes under `app/`
- keep dashboard routes under `app/dashboard/*`
- reuse `app/dashboard/layout.tsx` and `components/app-layout.tsx` instead of rebuilding shell logic

### API access and session handling

- use `lib/api-client.ts` for API calls
- preserve `ApiError` behavior so pages can branch on `status`, `code`, and `details`
- reuse auth helpers from `lib/api-client.ts` rather than rolling a second token/session layer

### Shared business logic

- put shared HR/date/leave helpers in `lib/hr-utils.ts`
- avoid duplicating payload shaping across multiple pages
- prefer extending the modal-based leave request flow instead of growing the legacy standalone page

### Components

- reuse `components/ui/*` primitives first
- place domain-specific reusable flows in `components/`
- keep page files thinner by moving repeated UI or logic into shared components/helpers

### Styling

- use Tailwind utilities and CSS variables from `app/globals.css`
- preserve the existing jade/green system unless the product is explicitly being rebranded
- font baseline is `Inter` from `app/layout.tsx`

## 3. Backend standards

### Module shape

- keep the existing `router -> controller -> service -> validation` split
- keep controllers thin
- place business rules in services
- place request schemas in `*.validation.ts` with Zod

### Responses and serialization

- preserve the existing API response envelope patterns used by the modules
- do not break global `BigInt -> string` JSON serialization
- only use custom response types when streaming or file download behavior requires it

### Auth and RBAC

- protect routes with auth middleware first
- apply role middleware in routers where access is restricted
- keep service-level scope checks for manager/HR/admin data access; do not rely on nav hiding alone

### Prisma and data access

- keep Prisma access in services, not controllers
- avoid scattering inconsistent payload shaping for the same entity across modules
- validate assumptions around soft master data like `department` before introducing stricter logic

### Validation

- validate params, query, and body with Zod
- when editing settings JSON behavior, strengthen schema checks instead of accepting arbitrary shapes blindly

## 4. Repo-specific pitfalls

- do not add more parallel leave-request logic into both the legacy page and the modal flow
- do not bypass `lib/api-client.ts`, or refresh/session behavior will drift
- do not assume frontend role-based navigation is security
- do not assume SSE behavior is multi-instance safe
- do not assume `Department` is enforced as a relational foreign key from `User`

## 5. Build and test expectations

- frontend build runs formatting before `next build`
- backend build runs formatting before `tsc`
- backend logic changes should include tests when practical, especially for auth, leave, balances, attendance, reports, devices, and audit-sensitive behavior
- treat `typescript.ignoreBuildErrors = true` as technical debt, not a pattern to rely on
