# Project Roadmap

## 1. Current maturity snapshot

The project is beyond mockup stage. Core frontend screens and matching backend APIs already exist. Main remaining work is consolidation, hardening, and production-grade policy enforcement rather than first-pass scaffolding.

## 2. What already works

### Core workflows

- login, refresh token, logout, profile, password change, avatar upload
- leave request create, list, detail, edit some pending states, approve, reject, cancel, bulk approve
- dashboard summaries and leave calendar
- employee listing and admin management actions
- reports for leave, overtime, department, top users, and CSV export
- overtime and comp-off read flows
- attendance check-in/check-out tracking with work hours calculation
- leave balances dedicated page with carry-over expiry warnings
- realtime notifications with unread count and read actions

## 3. Highest-priority product debt

### P0 - consolidate source of truth

- merge leave request UX into one reusable flow
- remove or repurpose legacy standalone leave-request page

### P0 - harden access control

- tighten backend scope checks for manager-visible data
- ensure user detail endpoints and reports are role-scoped correctly
- add stronger protected-route behavior on frontend if needed

### P0 - improve delivery safety

- add real automated tests for auth, leave request lifecycle, approval, balance changes
- stop relying on `ignoreBuildErrors` in Next build
- ensure Prisma generate is automatic in backend build/CI pipeline

## 4. High-value backend improvements

- strengthen settings JSON schema and align seed keys with runtime keys
- enforce full leave policy from settings, not just partial fields
- improve carry-over, tenure rules, and annual leave recalculation
- make `Department` relational or at least synchronized with `User.department`
- separate comp-off expiry from reject semantics
- add proper refresh token persistence/rotation if security requirements increase

## 5. High-value frontend improvements

- replace duplicated leave request logic with one shared form engine
- add route-level auth guarding strategy
- finish incomplete reports UX controls and drill-down flows
- complete employee import/export if still required by business
- finish comp-off and overtime UX gaps
- wire theme support only if product actually needs it; otherwise remove dead theme code

## 6. Suggested implementation sequence

### Phase A - stability

1. unify leave request flow
2. tighten RBAC and manager/team scoping
3. add backend integration tests for leave and auth
4. remove TypeScript build-ignore dependency

### Phase B - policy correctness

1. align settings schema and seed defaults
2. enforce leave policy and approval-flow rules consistently
3. improve leave balance engine and carry-over logic

### Phase C - production readiness

1. redesign notification fanout for multi-instance deployment
2. move uploads to object storage if needed
3. strengthen session/revocation strategy
4. add CI for format/build/test/db generate

## 7. Open technical questions

- Is the intended long-term UX the modal leave request flow or a dedicated page flow?
- Should manager reporting/dashboard be scoped only to direct reports or full department/team trees?
- Is comp-off supposed to be a separate asset ledger or just an overtime side effect?
- Should `Department` remain soft master-data only or become a real foreign key relation?
- Is browser-stored access token acceptable for target security posture?
