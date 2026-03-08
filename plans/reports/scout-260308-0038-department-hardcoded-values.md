# Scout Report: Department Hardcoded Values & Usage Analysis

**Date:** 2026-03-08 | **Time:** ~00:38  
**Scope:** Codebase scan for all "department" usage locations  
**Focus:** Hardcoded department values, dropdowns, API endpoints, form fields

---

## Executive Summary

Found **2 major hardcoded department lists** and a **model mismatch**:
1. **Frontend:** `DEFAULT_DEPARTMENTS` hardcoded in employees page (5 departments)
2. **Seed data:** `Department` model in DB has 3 departments (seeded)
3. **Current usage:** Department field is simple string on User model (not FK to Department table)

---

## FRONTEND — Hardcoded Departments

### 1. **app/dashboard/employees/page.tsx** ⚠️ CRITICAL
- **Line 97:** `const DEFAULT_DEPARTMENTS = ['Engineering', 'Marketing', 'Operations', 'HR', 'Sales'];`
- **Lines 117-123:** Hardcoded `DEPARTMENT_COLORS` mapping (5 departments with specific colors)
  ```typescript
  Engineering: { color: '#3b82f6', bg: '#eff6ff' },
  Marketing: { color: '#f59e0b', bg: '#fffbeb' },
  Operations: { color: '#1DB87A', bg: '#f0fdf9' },
  HR: { color: '#06b6d4', bg: '#ecfeff' },
  Sales: { color: '#8b5cf6', bg: '#f5f3ff' },
  ```
- **Line 179:** State initialized with `DEFAULT_DEPARTMENTS`
- **Line 203:** Department list fetched from `/api/users/dropdown` then merged with defaults
- **Lines 548-550, 733-735, 1228-1230:** Select dropdowns that display department list
- **Lines 255-274:** Department distribution chart calculation using hardcoded color map

### 2. **app/dashboard/approval/page.tsx** ⚠️
- **Lines 55, 145, 159:** Department field in request/interface objects
- **Line 276:** `departmentOptions` computed from leave requests (dynamic, not hardcoded)
- **Line 538:** Department filter in dropdown
- **Lines 625, 678:** Display department from request data

### 3. **app/dashboard/reports/page.tsx** ⚠️
- **Line 148:** `DepartmentReportRow` interface (has department field)
- **Line 173:** Department passed as query param to `/api/reports/leave`
- **Line 178:** Calls `/api/reports/department` endpoint (exists)
- **Lines 211-230:** Filter & display department reports
- **Line 287:** Department trend metadata calculation

### 4. **app/dashboard/leave-history/page.tsx**
- **Line 79:** Department field in interface (read-only, displayed from data)

### 5. **app/dashboard/leave-request/page.tsx**
- **Line 60:** Department in interface (read-only, displayed from auth user data)

---

## BACKEND — Database & Seed Data

### 1. **backend/prisma/schema.prisma**
- **Line 40:** `department String? @db.VarChar(100)` — Field on User model (simple string, NOT FK)
- **Lines 172-182:** `Department` model exists but **NOT linked to User**
  ```prisma
  model Department {
    id        BigInt
    code      String   @unique
    name      String
    isActive  Boolean
    createdAt DateTime
    updatedAt DateTime
    @@map("departments")
  }
  ```

### 2. **backend/prisma/seed.ts**
- **Lines 132-140:** 3 departments seeded:
  ```
  1. EXISTING (code) / Existing (name)
  2. MK (code) / MK (name)
  3. NEXCONSTRUCT (code) / Nexconstruct (name)
  ```
- User model does NOT get departments assigned in seed (no department field population)

---

## BACKEND — API Routes & Endpoints

### 1. **No `/api/departments` endpoint exists** ❌
- Verified: No `departments.router.ts` or `departments` module
- No dedicated GET endpoint to list departments

### 2. **Department filtering used in existing endpoints:**

#### `GET /api/users` (backend/src/modules/users/users.service.ts)
- **Line 37:** Accepts `department` query param
- **Line 48:** Filters by `department` string
- **Lines 134-138:** `getDropdown()` returns users with department field

#### `GET /api/leave-requests` (backend/src/modules/leave-requests/leave-requests.service.ts)
- **Line 18:** Includes user with `department` field
- **Line 33-36:** Filters by `department` query param
- **Validation (line 18):** `department: z.string().optional()`

#### `GET /api/reports/leave` (backend/src/modules/reports/reports.service.ts)
- **Line 5:** Accepts `department` param
- **Line 21:** Filters reports by `user.department`

#### `GET /api/reports/department` (backend/src/modules/reports/reports.router.ts:12)
- **Route:** `/api/reports/department` ✓ EXISTS
- **Service:** `getDepartmentReport()` (lines 37-73)
- **Query:** Fetches all departments from `user.department` (DISTINCT)
- **Returns:** Department stats (totalDays, employeeCount, otHours, avgDays)

#### `POST /api/users` (Create User)
- **Validation (users.validation.ts:21):** `department: z.string().optional()`
- **Service:** Can create/update user with department string

#### `POST /api/auth/login` (backend/src/modules/auth/auth.service.ts)
- **Lines 37, 70:** Returns `department` in JWT payload & user response

### 3. **Department usage in services:**
- **reports.service.ts:79, 125, 136:** Select department from user in reports
- **users.service.ts:15:** Select department from user in dropdown
- **leave-requests.service.ts:8:** Select department from user in include
- **overtime.service.ts:18:** Select department from user in include
- **comp-off.service.ts:6:** Select department from user in include

---

## ISSUE: Model Mismatch ⚠️

**Problem:** 
- `Department` model exists in schema (lines 172-182) but is **never used**
- User table has `department` as plain `String` (line 40)
- No foreign key relationship between User → Department
- Seed data creates 3 Department records that are never referenced

**Consequence:**
- Frontend uses hardcoded department list: `['Engineering', 'Marketing', 'Operations', 'HR', 'Sales']`
- Backend DB has 3 departments: `['Existing', 'MK', 'Nexconstruct']`
- User creation accepts ANY string as department (no validation against Department table)
- This creates a "free text department" system, not a managed list

---

## API Functions/Calls for Departments

### Frontend (lib/api-client.ts)
- **Generic `apiClient.get()`, `apiClient.post()`, `apiClient.patch()`** — No specialized department functions
- **Used in pages:**
  - `apiClient.get('/api/users/dropdown')` — Get users with departments
  - `apiClient.get('/api/users?department=X')` — Filter users by department
  - `apiClient.get('/api/reports/department')` — Get department report
  - `apiClient.get('/api/reports/leave?department=X')` — Filter leave report by department

### Backend Endpoints
```
GET  /api/users?department=<string>                    — Filter users
GET  /api/users/dropdown                               — Get dropdown (includes dept)
POST /api/users                                        — Create user (accepts dept)
GET  /api/leave-requests?department=<string>           — Filter requests by dept
GET  /api/reports/department                           — Get department report
GET  /api/reports/leave?department=<string>            — Filter leave report
```

---

## Summary Table

| File | Type | Line(s) | Details |
|------|------|---------|---------|
| `app/dashboard/employees/page.tsx` | Frontend | 97, 117-123 | **HARDCODED:** 5 departments + colors |
| `backend/prisma/seed.ts` | Data | 132-140 | **DB SEED:** 3 departments |
| `backend/prisma/schema.prisma` | Model | 40, 172-182 | Department string on User + unused Department model |
| `backend/src/modules/users/users.service.ts` | API | 15, 37, 48, 136 | Department in queries & selects |
| `backend/src/modules/reports/reports.service.ts` | API | 5, 21, 79, 125, 136 | Department in filters & selects |
| `backend/src/modules/leave-requests/leave-requests.service.ts` | API | 8, 18, 33-36 | Department in include & filters |
| `backend/src/modules/reports/reports.router.ts` | Router | 12 | `/api/reports/department` endpoint |
| `app/dashboard/approval/page.tsx` | Frontend | 276-281, 538 | Dynamic dept options from data |
| `app/dashboard/reports/page.tsx` | Frontend | 148, 173, 178, 211-230 | Department report display |

---

## File Paths — Complete List (All Department References)

### Frontend Components & Pages (6 files)
1. `app/page.tsx` — Line 92 (interface)
2. `app/dashboard/approval/page.tsx` — Lines 55, 145, 159, 227, 276-281, 538, 625, 678
3. `app/dashboard/employees/page.tsx` — Lines 56, 70, 81, 92, 97, 117-123, 171, 179, 187, 201-203, 221, 255-274, 306, 315, 345, 548-550, 678, 722-771, 877-902, 977, 990, 995, 1006, 1016, 1018, 1221-1230
4. `app/dashboard/leave-history/page.tsx` — Line 79
5. `app/dashboard/leave-request/page.tsx` — Line 60
6. `app/dashboard/reports/page.tsx` — Lines 55, 64, 148, 170, 173, 178, 188, 211-212, 224, 230, 243, 287, 317, 325
7. `components/leave-request-modal.tsx` — Line 64

### Backend Routes & Services (6 files)
1. `backend/src/modules/auth/auth.service.ts` — Lines 37, 70
2. `backend/src/modules/users/users.validation.ts` — Lines 6, 21
3. `backend/src/modules/users/users.service.ts` — Lines 15, 37, 48, 136
4. `backend/src/modules/leave-requests/leave-requests.validation.ts` — Line 18
5. `backend/src/modules/leave-requests/leave-requests.service.ts` — Lines 8, 18, 33-36
6. `backend/src/modules/reports/reports.controller.ts` — Lines 8, 10
7. `backend/src/modules/reports/reports.service.ts` — Lines 5, 21, 37-73, 79, 125, 136
8. `backend/src/modules/reports/reports.router.ts` — Line 12
9. `backend/src/modules/overtime/overtime.service.ts` — Line 18
10. `backend/src/modules/comp-off/comp-off.service.ts` — Line 6

### Data & Schema (2 files)
1. `backend/prisma/schema.prisma` — Lines 40, 172-182
2. `backend/prisma/seed.ts` — Lines 62-122 (users with dept refs), 132-140 (dept seed)

---

## Unresolved Questions ❓

1. **Should Department be a managed enum or FK reference?**
   - Currently: Free text string on User
   - Alternative: Foreign key to Department table
   - Impact: Frontend needs API to fetch dept list vs hardcoding

2. **Why does frontend have 5 departments but seed has 3?**
   - Frontend defaults: Engineering, Marketing, Operations, HR, Sales
   - Seed creates: Existing, MK, Nexconstruct
   - These don't align — which is the source of truth?

3. **Does User.department need to be required or optional?**
   - Currently: Optional (nullable string)
   - Affects: Reports may have NULL departments

4. **Should there be a `/api/departments` endpoint?**
   - Currently: NO
   - Needed for: Dynamic department list management
   - Currently: Frontend hardcodes defaults + fetches from user dropdown

5. **Is Department model dead code?**
   - Exists in schema but not used anywhere
   - Should it be removed or integrated?

