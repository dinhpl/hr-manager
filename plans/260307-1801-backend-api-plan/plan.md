# Backend API Plan — HR Leave Management System

**Date:** 2026-03-07
**Branch:** develop-v0-dev
**Scope:** Backend từ đầu + tích hợp vào frontend Next.js hiện tại

---

## 1. Tổng quan

Frontend hiện tại (`Next.js`) đang dùng mock data (hardcode + localStorage) cho toàn bộ tính năng. Mục tiêu plan này là:

1. **Xây dựng backend** `Express.js + TypeScript + Prisma + PostgreSQL` trong thư mục `backend/`
2. **Expose REST API** đầy đủ cho mọi trang frontend
3. **Tích hợp frontend** — thay thế mock data bằng API calls thật

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express.js |
| Language | TypeScript |
| Database | PostgreSQL (từ `hr_leave_db.sql`) |
| ORM | Prisma ORM |
| Auth | JWT (access + refresh token), bcrypt |
| Validation | Zod |
| API Docs | Swagger/OpenAPI (swagger-jsdoc + swagger-ui-express) |
| Logging | Pino |
| Security | helmet, cors, express-rate-limit |
| Testing | Vitest + Supertest |
| Deploy | Docker + docker-compose |
| Process | PM2 (production) |
| File Storage | Local disk (`uploads/` dir), served via Express static |
| Cron | `node-cron` — auto-expire comp-off records hàng ngày |

---

## 3. Cấu trúc thư mục backend

```
backend/
├── uploads/                    # Local file storage (gitignore)
│   └── leave-attachments/
├── src/
│   ├── app.ts                  # Express app config
│   ├── server.ts               # HTTP server entry
│   ├── jobs/
│   │   └── expire-compoff.job.ts  # Cron: mark expired comp-off daily
│   ├── config/
│   │   ├── env.ts              # Env vars schema (Zod)
│   │   └── prisma.ts           # Prisma client singleton
│   ├── middlewares/
│   │   ├── auth.middleware.ts  # JWT verify
│   │   ├── role.middleware.ts  # RBAC guard
│   │   └── error.middleware.ts # Global error handler
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.router.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.validation.ts
│   │   ├── users/
│   │   ├── leave-types/
│   │   ├── leave-requests/
│   │   ├── overtime/
│   │   ├── comp-off/
│   │   ├── leave-balances/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   └── settings/
│   ├── utils/
│   │   ├── jwt.ts              # Token helpers
│   │   ├── hash.ts             # bcrypt helpers
│   │   ├── pagination.ts       # Cursor/offset pagination
│   │   └── response.ts         # Standard API response
│   └── types/
│       └── express.d.ts        # Extend Request với user
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── auth.test.ts
│   ├── leave-requests.test.ts
│   └── ...
├── .env.example
├── .env
├── Dockerfile
├── docker-compose.yml
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## 4. Mapping API → Frontend Pages

### 4.1 Auth (`/` — Login Page)
| Method | Endpoint | Mô tả | Frontend dùng ở |
|---|---|---|---|
| POST | `/api/auth/login` | Đăng nhập, trả access+refresh token | Login form |
| POST | `/api/auth/refresh-token` | Làm mới access token | Auto refresh |
| POST | `/api/auth/logout` | Xóa refresh token | Sidebar logout |
| GET | `/api/auth/me` | Lấy thông tin user hiện tại | Dashboard layout |

### 4.2 Users (`/dashboard/employees`)
| Method | Endpoint | Mô tả | Roles |
|---|---|---|---|
| GET | `/api/users` | Danh sách nhân viên (filter, paginate) | HR, ADMIN |
| GET | `/api/users/:id` | Chi tiết nhân viên | ALL |
| POST | `/api/users` | Tạo nhân viên mới | ADMIN, HR |
| PATCH | `/api/users/:id` | Cập nhật nhân viên | ADMIN, HR |
| DELETE | `/api/users/:id` | Soft delete (is_active=false) | ADMIN |

Query params: `?search=&department=&role=&status=&page=&limit=`

### 4.3 Leave Types (`/dashboard/settings`, `/dashboard/leave-request`)
| Method | Endpoint | Mô tả | Roles |
|---|---|---|---|
| GET | `/api/leave-types` | Danh sách loại nghỉ | ALL |
| POST | `/api/leave-types` | Tạo loại nghỉ | ADMIN, HR |
| PATCH | `/api/leave-types/:id` | Cập nhật loại nghỉ | ADMIN, HR |
| DELETE | `/api/leave-types/:id` | Xóa loại nghỉ | ADMIN |

### 4.4 Leave Requests (`/dashboard/leave-request`, `/dashboard/leave-history`, `/dashboard/approval`)
| Method | Endpoint | Mô tả | Roles |
|---|---|---|---|
| GET | `/api/leave-requests` | Danh sách (filter nhiều điều kiện) | ALL (scope by role) |
| GET | `/api/leave-requests/:id` | Chi tiết | ALL |
| POST | `/api/leave-requests` | Tạo yêu cầu nghỉ | EMPLOYEE, HR |
| PATCH | `/api/leave-requests/:id` | Sửa draft | EMPLOYEE |
| PATCH | `/api/leave-requests/:id/submit` | Gửi draft → pending | EMPLOYEE |
| PATCH | `/api/leave-requests/:id/approve` | Duyệt | MANAGER, HR |
| PATCH | `/api/leave-requests/:id/reject` | Từ chối | MANAGER, HR |
| PATCH | `/api/leave-requests/:id/cancel` | Hủy | EMPLOYEE (own) |
| POST | `/api/leave-requests/bulk-approve` | Duyệt hàng loạt | MANAGER, HR |

Query params: `?status=&user_id=&leave_type_id=&from_date=&to_date=&department=&page=&limit=`

### 4.5 Overtime (`/dashboard/overtime`)
| Method | Endpoint | Mô tả | Roles |
|---|---|---|---|
| GET | `/api/overtime` | Danh sách OT records | ALL (scope by role) |
| GET | `/api/overtime/:id` | Chi tiết OT | ALL |
| POST | `/api/overtime` | Đăng ký OT | EMPLOYEE |
| PATCH | `/api/overtime/:id/approve` | Duyệt OT | MANAGER, HR |
| PATCH | `/api/overtime/:id/reject` | Từ chối OT | MANAGER, HR |

Query params: `?user_id=&status=&from_date=&to_date=&page=&limit=`

### 4.6 Comp-off (`/dashboard/compoff`)
| Method | Endpoint | Mô tả | Roles |
|---|---|---|---|
| GET | `/api/comp-off` | Danh sách comp-off | ALL (scope by role) |
| GET | `/api/comp-off/:id` | Chi tiết comp-off | ALL |
| POST | `/api/comp-off` | Đăng ký nghỉ bù | EMPLOYEE |
| PATCH | `/api/comp-off/:id/approve` | Duyệt nghỉ bù | MANAGER, HR |
| PATCH | `/api/comp-off/:id/reject` | Từ chối nghỉ bù | MANAGER, HR |

Query params: `?user_id=&status=&ot_type=&sort_by=&page=&limit=`

### 4.7 Leave Balances (`/dashboard/leave-request`, `/dashboard/dashboard`)
| Method | Endpoint | Mô tả | Roles |
|---|---|---|---|
| GET | `/api/leave-balances` | Balance của user hiện tại (hoặc chỉ định) | ALL |
| GET | `/api/leave-balances/:userId` | Balance của user cụ thể | MANAGER, HR, ADMIN |
| POST | `/api/leave-balances/initialize` | Khởi tạo balance cho năm mới | ADMIN, HR |
| PATCH | `/api/leave-balances/:id` | Điều chỉnh balance | ADMIN, HR |

Query params: `?year=`

### 4.8 Dashboard (`/dashboard`)
| Method | Endpoint | Mô tả | Roles |
|---|---|---|---|
| GET | `/api/dashboard/summary` | Stats tổng hợp (role-based response) | ALL |
| GET | `/api/dashboard/calendar` | Dữ liệu lịch nghỉ (year+month) | ALL |
| GET | `/api/dashboard/recent-requests` | 5-10 yêu cầu gần đây | ALL |

### 4.9 Reports (`/dashboard/reports`)
| Method | Endpoint | Mô tả | Roles |
|---|---|---|---|
| GET | `/api/reports/leave` | Thống kê nghỉ phép theo tháng/năm | HR, ADMIN |
| GET | `/api/reports/overtime` | Thống kê OT theo phòng ban | HR, ADMIN |
| GET | `/api/reports/department` | Thống kê theo phòng ban | HR, ADMIN |
| GET | `/api/reports/export` | Export CSV/Excel | HR, ADMIN |

Query params: `?year=&month=&department=&leave_type_id=&format=csv|excel`

### 4.10 Settings (`/dashboard/settings`)
| Method | Endpoint | Mô tả | Roles |
|---|---|---|---|
| GET | `/api/settings/leave-policy` | Lấy chính sách nghỉ phép | HR, ADMIN |
| PATCH | `/api/settings/leave-policy` | Cập nhật chính sách | ADMIN |
| GET | `/api/settings/approval-flow` | Lấy luồng duyệt | HR, ADMIN |
| PATCH | `/api/settings/approval-flow` | Cập nhật luồng duyệt | ADMIN |

---

## 5. Prisma Schema (mapping từ hr_leave_db.sql)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  EMPLOYEE
  MANAGER
  HR
  ADMIN
}

enum LeaveRequestStatus {
  // DRAFT removed — không dùng, chỉ submit thẳng PENDING
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum OvertimeStatus {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id               BigInt    @id @default(autoincrement())
  email            String    @unique @db.VarChar(255)
  username         String    @unique @db.VarChar(100)
  password         String
  fullName         String    @map("full_name") @db.VarChar(255)
  firstName        String?   @map("first_name") @db.VarChar(100)
  lastName         String?   @map("last_name") @db.VarChar(100)
  role             UserRole  @default(EMPLOYEE)
  systemRole       String?   @map("system_role") @db.VarChar(100)
  department       String?   @db.VarChar(100)
  position         String?   @db.VarChar(150)
  avatar           String?
  teamId           Int?      @map("team_id")
  isCountable      Boolean   @default(true) @map("is_countable")
  companyJoinDate  DateTime? @map("company_join_date")
  managerId        BigInt?   @map("manager_id")
  isActive         Boolean   @default(true) @map("is_active")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  manager          User?           @relation("UserManager", fields: [managerId], references: [id])
  subordinates     User[]          @relation("UserManager")
  leaveRequests    LeaveRequest[]  @relation("UserLeaveRequests")
  approvedRequests LeaveRequest[]  @relation("ApproverLeaveRequests")
  overtimeRecords  OvertimeRecord[] @relation("UserOvertimeRecords")
  approvedOT       OvertimeRecord[] @relation("ApproverOvertimeRecords")
  compOffRecords   CompOffRecord[] @relation("UserCompOffRecords")
  approvedCompOff  CompOffRecord[] @relation("ApproverCompOffRecords")
  leaveBalances    LeaveBalance[]

  @@map("users")
}

model LeaveType {
  id          BigInt   @id @default(autoincrement())
  code        String   @unique @db.VarChar(20)
  name        String   @db.VarChar(255)
  description String?
  defaultDays Decimal  @default(0) @map("default_days") @db.Decimal(10, 2)
  isPaid      Boolean  @default(true) @map("is_paid")
  color       String   @default("#1DB87A") @db.VarChar(20)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  leaveRequests LeaveRequest[]
  leaveBalances LeaveBalance[]

  @@map("leave_types")
}

model LeaveRequest {
  id           BigInt             @id @default(autoincrement())
  userId       BigInt             @map("user_id")
  leaveTypeId  BigInt             @map("leave_type_id")
  fromDate     DateTime           @map("from_date")
  toDate       DateTime           @map("to_date")
  totalDays    Decimal            @map("total_days") @db.Decimal(10, 2)
  reason       String
  status       LeaveRequestStatus @default(PENDING)
  approverId   BigInt?            @map("approver_id")
  approvedAt   DateTime?          @map("approved_at")
  approvedNote String?            @map("approved_note")
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt @map("updated_at")

  user      User      @relation("UserLeaveRequests", fields: [userId], references: [id])
  leaveType LeaveType @relation(fields: [leaveTypeId], references: [id])
  approver  User?     @relation("ApproverLeaveRequests", fields: [approverId], references: [id])

  @@map("leave_requests")
}

model OvertimeRecord {
  id         BigInt         @id @default(autoincrement())
  userId     BigInt         @map("user_id")
  date       DateTime
  hours      Decimal        @db.Decimal(10, 2)
  reason     String
  status     OvertimeStatus @default(PENDING)
  approverId BigInt?        @map("approver_id")
  approvedAt DateTime?      @map("approved_at")
  createdAt  DateTime       @default(now()) @map("created_at")
  updatedAt  DateTime       @updatedAt @map("updated_at")

  user       User            @relation("UserOvertimeRecords", fields: [userId], references: [id])
  approver   User?           @relation("ApproverOvertimeRecords", fields: [approverId], references: [id])
  compOffs   CompOffRecord[]

  @@map("overtime_records")
}

model CompOffRecord {
  id         BigInt             @id @default(autoincrement())
  userId     BigInt             @map("user_id")
  overtimeId BigInt?            @map("overtime_id")
  fromDate   DateTime           @map("from_date")
  toDate     DateTime           @map("to_date")
  totalDays  Decimal            @map("total_days") @db.Decimal(10, 2)
  reason     String
  status     LeaveRequestStatus @default(PENDING)
  approverId BigInt?            @map("approver_id")
  approvedAt DateTime?          @map("approved_at")
  createdAt  DateTime           @default(now()) @map("created_at")
  updatedAt  DateTime           @updatedAt @map("updated_at")

  user     User            @relation("UserCompOffRecords", fields: [userId], references: [id])
  overtime OvertimeRecord? @relation(fields: [overtimeId], references: [id])
  approver User?           @relation("ApproverCompOffRecords", fields: [approverId], references: [id])

  @@map("comp_off_records")
}

model LeaveBalance {
  id          BigInt   @id @default(autoincrement())
  userId      BigInt   @map("user_id")
  leaveTypeId BigInt   @map("leave_type_id")
  year        Int
  totalDays   Decimal  @default(0) @map("total_days") @db.Decimal(10, 2)
  usedDays    Decimal  @default(0) @map("used_days") @db.Decimal(10, 2)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user      User      @relation(fields: [userId], references: [id])
  leaveType LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@unique([userId, leaveTypeId, year])
  @@map("leave_balances")
}
```

---

## 6. RBAC Rules

| Role | Quyền |
|---|---|
| EMPLOYEE | Xem/tạo leave request của mình, xem OT của mình, xem comp-off của mình |
| MANAGER | Tất cả quyền EMPLOYEE + duyệt/từ chối request của team |
| HR | Tất cả quyền MANAGER + quản lý employee, leave types, reports, settings |
| ADMIN | Full access |

Middleware flow: `authMiddleware` → `roleMiddleware(allowedRoles)` → controller

---

## 7. Standard API Response

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 }  // paginated only
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": [...]  // optional Zod errors
  }
}
```

---

## 8. Authentication Flow

```
POST /api/auth/login
  → verify username/password (bcrypt)
  → issue accessToken (15m) + refreshToken (7d)
  → refreshToken stored in httpOnly cookie

POST /api/auth/refresh-token
  → verify refreshToken from cookie
  → issue new accessToken

Authorization header: Bearer <accessToken>
```

---

## 9. Các Phase triển khai

| Phase | Nội dung | File |
|---|---|---|
| Phase 1 | Project Setup | `phase-01-project-setup.md` |
| Phase 2 | Auth Module | `phase-02-auth-module.md` |
| Phase 3 | Users Module | `phase-03-users-module.md` |
| Phase 4 | Leave Types & Balances | `phase-04-leave-types-balances.md` |
| Phase 5 | Leave Requests Module | `phase-05-leave-requests-module.md` |
| Phase 6 | Overtime Module | `phase-06-overtime-module.md` |
| Phase 7 | Comp-off Module | `phase-07-compoff-module.md` |
| Phase 8 | Dashboard & Reports | `phase-08-dashboard-reports.md` |
| Phase 9 | Settings Module | `phase-09-settings-module.md` |
| Phase 10 | Frontend Integration | `phase-10-frontend-integration.md` |

---

## 10. Môi trường

### Local
- Backend: `http://localhost:4000`
- Frontend: `http://localhost:3000` → `NEXT_PUBLIC_API_URL=http://localhost:4000`
- DB: PostgreSQL local hoặc Docker

### Docker Compose
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: hr_leave_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://postgres:secret@db:5432/hr_leave_db
```

---

## 11. Đã xác nhận

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | File attachment storage | **Local disk** — lưu vào `backend/uploads/leave-attachments/`, serve qua Express static |
| 2 | Comp-off expiry job | **Có cron** — `node-cron` chạy hàng ngày 00:00, tìm comp-off `toDate < today` → mark EXPIRED |
| 3 | DRAFT status | **Không dùng** — leave-request chỉ có PENDING/APPROVED/REJECTED/CANCELLED |
| 4 | Notifications | **Không trong MVP** (đã comment `[MVP-HIDDEN]` ở settings) |
| 5 | Settings storage | **DB** — bảng `settings` (JSONB), migration riêng |
