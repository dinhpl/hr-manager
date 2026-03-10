# Code Standards

## 1. Goal

These standards describe how this repo is already structured and how new changes should align with it.

## 2. Frontend standards

### Routing and page composition

- Use App Router pages under `app/`.
- Keep dashboard pages under `app/dashboard/*`.
- Reuse `components/app-layout.tsx` through `app/dashboard/layout.tsx` rather than rebuilding shell logic.

### Data fetching

- Use `lib/api-client.ts` for all API access.
- Do not call raw `fetch` or ad hoc Axios instances unless there is a strong reason.
- Preserve `ApiError` semantics so pages can branch on `status` and `code`.

### Session handling

- Reuse `getStoredToken`, `setAuthSession`, `clearAuthSession`, `refreshAccessToken` from `lib/api-client.ts`.
- Keep auth redirect behavior consistent with current app style.

### Shared business logic

- Put role/date/leave mode helper logic in `lib/hr-utils.ts` when shared by multiple screens.
- Avoid duplicating leave request payload shaping in each page.
- Prefer extending the modal-based leave request flow over reviving standalone duplicated logic.

### Components

- Reuse `components/ui/*` primitives first.
- Keep domain-specific UI in `components/`.
- Avoid large page-local duplication when logic belongs in shared modal or helper modules.

### Styling

- Use Tailwind utilities + CSS variables from `app/globals.css`.
- Respect existing brand palette and spacing rhythm.
- Keep responsive behavior explicit; most key views are desktop-heavy but must remain usable on mobile.

## 3. Backend standards

### Module structure

- Follow `router -> controller -> service -> validation`.
- Keep controllers thin.
- Put business rules in services.
- Put request schemas in `*.validation.ts` using Zod.

### Responses

- Prefer standardized response shape with `sendSuccess` and typed payloads.
- Keep BigInt-safe JSON behavior intact.
- Avoid introducing raw ad hoc response formats unless required by streaming or file download paths.

### Auth and RBAC

- Protect routes with `authMiddleware` first.
- Apply `requireRoles(...)` in routers when route audience is restricted.
- Do not rely only on route-level role checks; service-level scope checks are also needed for manager vs subordinate access.

### Prisma/data access

- Keep Prisma access in services, not controllers.
- Reuse `select`/`include` constants for stable payload shape where practical.
- Serialize BigInt IDs to strings before exposing them to frontend consumers.

### Validation

- Validate request bodies, params, and query strings with Zod.
- For JSON settings payloads, strengthen schema instead of storing arbitrary blobs unchecked.

## 4. Known repo-specific pitfalls to avoid

- Do not add more leave request logic to both `app/dashboard/leave-request/page.tsx` and `components/leave-request-modal.tsx`; choose one source of truth.
- Do not bypass `lib/api-client.ts`, or token refresh behavior will drift.
- Do not assume `Department` table is relationally enforced from `User.department`.
- Do not assume seeded settings keys always match runtime-used settings keys; verify before building new policy logic.
- Do not rely on frontend nav hiding as security.

## 5. Testing/build expectations

- Frontend build currently runs formatting before `next build`.
- Backend build currently runs formatting before `tsc` and needs generated Prisma client.
- Add tests when touching service-heavy logic, especially leave approval, balances, reports, or auth.
- Treat `typescript.ignoreBuildErrors = true` as temporary debt, not a pattern to depend on.

## 6. Recommended standards for future work

- Consolidate leave request UI into one reusable form flow.
- Add route-level protection for frontend if protected screens stay client-rendered.
- Introduce stronger typing for settings JSON.
- Add integration tests for auth, leave request lifecycle, OT approval, reports, notifications.
- Standardize all backend responses, including minor modules like departments.
