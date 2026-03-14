# Phase 1 Plan — Stability & Consolidation

**Date:** 2026-03-10
**Branch:** develop-v0-dev
**Priority:** P0

---

## 1. Overview

Phase 1 tập trung vào ổn định hệ thống trước khi tiếp tục feature development:
1. Unify leave request UX (1 flow thay vì 2)
2. Tighten RBAC/backend scoping
3. Remove TypeScript ignoreBuildErrors
4. Add basic backend tests

---

## 2. Tasks

### 2.1 Unify Leave Request UX

**Mục tiêu:** Xóa duplicate code, chỉ giữ 1 luồng leave request

**Files:**
- `components/leave-request-modal.tsx` — modal flow (GIỮ)
- `app/dashboard/leave-request/page.tsx` — standalone page (XÓA hoặc redirect)

**Steps:**
1. [ ] Kiểm tra `leave-request-modal.tsx` có đầy đủ chức năng chưa
2. [ ] Kiểm tra `app/dashboard/leave-request/page.tsx` có tính năng gì khác modal
3. [ ] Nếu page có gì đặc biệt → merge vào modal
4. [ ] Redirect `/dashboard/leave-request` → `/dashboard` (mở modal)
5. [ ] Update sidebar navigation nếu cần

**Checklist features cần có trong modal:**
- [ ] Leave type selection
- [ ] Date range picker
- [ ] Duration mode (full-day, half-day, hourly)
- [ ] Time picker cho hourly
- [ ] Balance display
- [ ] Reason textarea
- [ ] Handover person dropdown
- [ ] File attachment upload
- [ ] Submit → API call

---

### 2.2 Tighten RBAC & Manager Scoping

**Mục tiêu:** Đảm bảo backend enforce đúng role, manager chỉ thấy data của team

**Files cần check:**
- `backend/src/middlewares/` — có auth middleware chưa
- `backend/src/modules/leave-requests/leave-requests.service.ts`
- `backend/src/modules/users/users.service.ts`
- `backend/src/modules/dashboard/dashboard.service.ts`
- `backend/src/modules/reports/reports.service.ts`

**Steps:**
1. [ ] Review current auth middleware implementation
2. [ ] Thêm role check ở service layer (không chỉ controller)
3. [ ] Manager scoping: chỉ thấy subordinates
   - `LeaveRequest.findMany({ where: { user: { managerId: currentUser.id } } })`
   - Hoặc `userId: { in: subordinateIds }`
4. [ ] Add test cases cho từng role scenarios

**RBAC Rules cần enforce:**

| Role | Can View | Can Create | Can Approve | Can Admin |
|------|----------|------------|-------------|-----------|
| EMPLOYEE | own requests | yes (own) | no | no |
| MANAGER | own + team | yes (own) | team | no |
| HR | all | yes | all | employees only |
| ADMIN | all | yes | all | all |

---

### 2.3 Remove TypeScript ignoreBuildErrors

**Mục tiêu:** Dọn dẹp type errors để build clean

**File:** `next.config.mjs`

**Steps:**
1. [ ] Set `ignoreBuildErrors: false`
2. [ ] Run `pnpm build` để xem lỗi
3. [ ] Fix từng lỗi:
   - Import errors
   - Type mismatches
   - Missing props
   - etc.
4. [ ] Repeat until build passes

**Expected errors:**
- Unused variables
- Missing type annotations
- Module resolution issues

---

### 2.4 Add Backend Integration Tests

**Mục tiêu:** Có baseline tests cho auth và leave request lifecycle

**Files:**
- `backend/tests/auth.test.ts`
- `backend/tests/leave-requests.test.ts`
- `backend/tests/setup.ts`

**Test Coverage:**

**Auth Tests:**
- [ ] Login success với correct credentials
- [ ] Login fail với wrong password
- [ ] Login fail với non-existent user
- [ ] Refresh token works
- [ ] Logout clears cookie

**Leave Request Tests:**
- [ ] Create leave request (EMPLOYEE)
- [ ] Get own leave requests
- [ ] Approve leave request (MANAGER)
- [ ] Reject leave request (MANAGER)
- [ ] Cancel own request (EMPLOYEE)
- [ ] Balance deducted on approval
- [ ] Balance restored on cancel

**Setup:**
- [ ] Test database (separate from dev)
- [ ] Seed minimal test data
- [ ] Auth helper (login + get token)
- [ ] Teardown after each test

---

## 3. Dependencies

| Task | Depends On |
|------|------------|
| 2.2 RBAC | 2.1 Unified UX |
| 2.3 Types | None |
| 2.4 Tests | 2.2 RBAC (for role-based tests) |

---

## 4. Acceptance Criteria

- [ ] Chỉ 1 leave request flow tồn tại
- [ ] Manager không thể xem/approve request ngoài team
- [ ] `pnpm build` pass không có ignoreBuildErrors
- [ ] Auth tests pass
- [ ] Leave request lifecycle tests pass

---

## 5. Questions

1. Modal leave request có đủ features chưa, hay page có gì extra cần merge?
2. Manager scoping: chỉ direct reports hay full department tree?
3. Test database: dùng SQLite cho test hoặc PostgreSQL test container?

---

## 6. Files có thể thay đổi

```
components/leave-request-modal.tsx
app/dashboard/leave-request/page.tsx
next.config.mjs
backend/src/middlewares/auth.middleware.ts
backend/src/middlewares/role.middleware.ts
backend/src/modules/*/services/*.service.ts
backend/tests/auth.test.ts
backend/tests/leave-requests.test.ts
backend/tests/setup.ts
```
