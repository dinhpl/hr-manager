# Phase 7 — Comp-off Module

**Mục tiêu:** Quản lý comp-off records: xem, đăng ký dùng, track expiry. Phục vụ `/dashboard/compoff`.

---

## 7.1 Business Rules

- CompOff records được tạo tự động khi OT được approve (Phase 6)
- Employee có thể đăng ký dùng comp-off (tạo leave-request loại CO)
- `fromDate`/`toDate` trong comp_off_records = ngày employee đăng ký nghỉ bù
- Expiry = 90 ngày từ ngày OT
- Status: `PENDING` → `APPROVED`/`REJECTED`

---

## 7.2 File Structure

```
src/modules/comp-off/
├── comp-off.router.ts
├── comp-off.controller.ts
└── comp-off.service.ts
```

---

## 7.3 Service

```typescript
// comp-off.service.ts

const COMP_OFF_INCLUDE = {
  user: { select: { id: true, fullName: true, department: true } },
  overtime: { select: { id: true, date: true, hours: true } },
  approver: { select: { id: true, fullName: true } },
} as const;

export async function getCompOffs(
  requestingUser: { userId: string; role: string },
  query: Record<string, unknown>
) {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Record<string, unknown> = {};
  if (requestingUser.role === "EMPLOYEE") {
    where.userId = BigInt(requestingUser.userId);
  }
  if (query.userId && requestingUser.role !== "EMPLOYEE") {
    where.userId = BigInt(query.userId as string);
  }
  if (query.status) where.status = query.status;

  // Filter by ot_type — derive từ overtime.date
  // Complex: skip ở MVP, let frontend filter

  // Sort by expiry
  const orderBy: Record<string, string> = {};
  if (query.sortBy === "expiry_asc") orderBy.toDate = "asc";
  else if (query.sortBy === "expiry_desc") orderBy.toDate = "desc";
  else if (query.sortBy === "hours_desc") orderBy.totalDays = "desc";
  else orderBy.createdAt = "desc";

  const [records, total] = await Promise.all([
    prisma.compOffRecord.findMany({
      where,
      include: COMP_OFF_INCLUDE,
      skip,
      take: limit,
      orderBy,
    }),
    prisma.compOffRecord.count({ where }),
  ]);

  const now = new Date();
  return {
    data: records.map((r) => {
      const expireDays = Math.floor((new Date(r.toDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...r,
        id: r.id.toString(),
        userId: r.userId.toString(),
        totalHours: Number(r.totalDays) * 8,   // convert days → hours for display
        expireDays,
        derivedStatus: expireDays < 0 ? "expired" : expireDays < 30 ? "expiring" : "available",
      };
    }),
    meta: buildMeta(total, page, limit),
  };
}

// Employee đăng ký dùng comp-off
export async function createCompOff(userId: string, data: {
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  overtimeId?: string;
}) {
  const record = await prisma.compOffRecord.create({
    data: {
      userId: BigInt(userId),
      overtimeId: data.overtimeId ? BigInt(data.overtimeId) : null,
      fromDate: new Date(data.fromDate),
      toDate: new Date(data.toDate),
      totalDays: data.totalDays,
      reason: data.reason,
      status: "PENDING",
    },
    include: COMP_OFF_INCLUDE,
  });
  return { ...record, id: record.id.toString() };
}

export async function approveCompOff(id: string, approverId: string) {
  const record = await prisma.compOffRecord.findUnique({ where: { id: BigInt(id) } });
  if (!record || record.status !== "PENDING") throw Object.assign(new Error("Cannot approve"), { status: 400 });

  const updated = await prisma.compOffRecord.update({
    where: { id: BigInt(id) },
    data: { status: "APPROVED", approverId: BigInt(approverId), approvedAt: new Date() },
  });
  return { ...updated, id: updated.id.toString() };
}

export async function rejectCompOff(id: string, approverId: string) {
  const updated = await prisma.compOffRecord.update({
    where: { id: BigInt(id) },
    data: { status: "REJECTED", approverId: BigInt(approverId), approvedAt: new Date() },
  });
  return { ...updated, id: updated.id.toString() };
}

// Summary cho sidebar
export async function getCompOffSummary(userId: string) {
  const records = await prisma.compOffRecord.findMany({
    where: { userId: BigInt(userId), status: "APPROVED" },
  });

  const now = new Date();
  const totalHours = records.reduce((sum, r) => sum + Number(r.totalDays) * 8, 0);
  const expiredHours = records
    .filter((r) => new Date(r.toDate) < now)
    .reduce((sum, r) => sum + Number(r.totalDays) * 8, 0);
  const expiringHours = records
    .filter((r) => {
      const days = Math.floor((new Date(r.toDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days < 30;
    })
    .reduce((sum, r) => sum + Number(r.totalDays) * 8, 0);

  return { totalHours, expiredHours, expiringHours, availableHours: totalHours - expiredHours };
}
```

---

## 7.4 Router

```typescript
// comp-off.router.ts
compOffRouter.use(authMiddleware);

compOffRouter.get("/", ctrl.getAll);
compOffRouter.get("/summary", ctrl.getSummary);    // stats cho sidebar/overtime page
compOffRouter.get("/:id", ctrl.getOne);
compOffRouter.post("/", ctrl.create);
compOffRouter.patch("/:id/approve", requireRole("MANAGER", "HR", "ADMIN"), ctrl.approve);
compOffRouter.patch("/:id/reject", requireRole("MANAGER", "HR", "ADMIN"), ctrl.reject);
```

---

## 7.5 Frontend Integration

**Compoff page (`/dashboard/compoff`):**
```typescript
// Thay ITEMS mock data
const res = await fetch(`${API_URL}/api/comp-off?${filterQuery}`, {
  headers: { Authorization: `Bearer ${token}` },
});

// Summary sidebar
const summary = await fetch(`${API_URL}/api/comp-off/summary`, {
  headers: { Authorization: `Bearer ${token}` },
});

// Đăng ký nghỉ bù
const res = await fetch(`${API_URL}/api/comp-off`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ fromDate, toDate, totalDays, reason, overtimeId }),
});
```

**Overtime page — comp-off overview table:**
```typescript
// Thay COMPOFF_ROWS mock
const res = await fetch(`${API_URL}/api/comp-off?limit=5&sortBy=expiry_asc`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

---

---

## 7.5 Cron Job — Auto-expire Comp-off

```bash
pnpm add node-cron
pnpm add -D @types/node-cron
```

**`src/jobs/expire-compoff.job.ts`**
```typescript
import cron from "node-cron";
import prisma from "../config/prisma";

// Chạy hàng ngày lúc 00:05
export function startExpireCompOffJob() {
  cron.schedule("5 0 * * *", async () => {
    const now = new Date();
    const result = await prisma.compOffRecord.updateMany({
      where: {
        status: "APPROVED",
        toDate: { lt: now },    // đã quá ngày hết hạn
      },
      data: { status: "REJECTED" },  // dùng REJECTED để mark expired (không có EXPIRED enum)
      // Hoặc: thêm migration với enum value EXPIRED
    });
    console.log(`[cron] Expired ${result.count} comp-off records`);
  });
}
```

**Khởi chạy trong `src/server.ts`:**
```typescript
import { startExpireCompOffJob } from "./jobs/expire-compoff.job";
// ...
app.listen(env.PORT, () => {
  startExpireCompOffJob();
  console.log(`Server running on :${env.PORT}`);
});
```

> **Note:** `EXPIRED` không có trong enum `leave_request_status` hiện tại. 2 options:
> - Option A: Thêm `EXPIRED` vào enum qua migration (recommended — semantic rõ hơn)
> - Option B: Dùng `REJECTED` + check `toDate < now` để derive expired status ở API response (không cần migration)
>
> **Chọn Option B** cho MVP — không cần migration enum, derive `derivedStatus` ở service layer.

---

## Checklist Phase 7

- [x] `GET /api/comp-off` — scope by role, filter by status
- [x] `GET /api/comp-off/summary` — tổng hợp giờ
- [x] `GET /api/comp-off/:id` — detail + overtime gốc
- [x] `POST /api/comp-off` — đăng ký nghỉ bù
- [x] `PATCH /api/comp-off/:id/approve` — duyệt
- [x] `PATCH /api/comp-off/:id/reject` — từ chối
- [x] `derivedStatus` tính từ `toDate` (expired/expiring/available)
- [x] Cron job `expire-compoff.job.ts` chạy 00:05 hàng ngày
- [x] Cron log số records expired mỗi lần chạy
