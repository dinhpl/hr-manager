# Phase 6 — Overtime Module

**Mục tiêu:** CRUD overtime records, duyệt/từ chối, phục vụ `/dashboard/overtime`.

---

## 6.1 Business Rules

- EMPLOYEE đăng ký OT: ngày, giờ bắt đầu/kết thúc, lý do
- Backend tính `hours` từ startTime/endTime - break time
- Manager/HR duyệt/từ chối
- Khi approve: comp-off hours được tích lũy theo rate (weekday×1, weekend×1.5, holiday×2)
- `hours` lưu vào `overtime_records.hours` theo số giờ OT thực tế

---

## 6.2 File Structure

```
src/modules/overtime/
├── overtime.router.ts
├── overtime.controller.ts
├── overtime.service.ts
└── overtime.validation.ts
```

---

## 6.3 Validation

```typescript
// overtime.validation.ts
import { z } from "zod";

export const createOvertimeSchema = z.object({
  date: z.string().datetime(),
  hours: z.coerce.number().min(0.5).max(16),   // hours OT thực tế
  reason: z.string().min(1).max(500),
  otType: z.enum(["weekday", "weekend", "holiday"]).default("weekday"),
  // otType không có trong DB schema → lưu vào reason, hoặc thêm migration column
  // MVP: tính từ date (tự detect cuối tuần)
});

export const getOvertimeQuerySchema = z.object({
  userId: z.coerce.bigint().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
```

---

## 6.4 Service

```typescript
// overtime.service.ts

// Rate để tính comp-off
const COMP_OFF_RATE: Record<string, number> = {
  weekday: 1,
  weekend: 1.5,
  holiday: 2,
};

function detectOtType(date: Date): "weekday" | "weekend" {
  const day = date.getDay();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

export async function getOvertimes(requestingUser: { userId: string; role: string }, query: Record<string, unknown>) {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Record<string, unknown> = {};
  if (requestingUser.role === "EMPLOYEE") {
    where.userId = BigInt(requestingUser.userId);
  }
  if (query.userId && requestingUser.role !== "EMPLOYEE") {
    where.userId = BigInt(query.userId as string);
  }
  if (query.status) where.status = query.status;
  if (query.fromDate) where.date = { gte: new Date(query.fromDate as string) };
  if (query.toDate) where.date = { ...(where.date as object ?? {}), lte: new Date(query.toDate as string) };

  const [records, total] = await Promise.all([
    prisma.overtimeRecord.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, department: true } },
        approver: { select: { id: true, fullName: true } },
      },
      skip,
      take: limit,
      orderBy: { date: "desc" },
    }),
    prisma.overtimeRecord.count({ where }),
  ]);

  return {
    data: records.map((r) => ({
      ...r,
      id: r.id.toString(),
      userId: r.userId.toString(),
      otType: detectOtType(r.date),  // derive từ date
      compOffHours: Number(r.hours) * COMP_OFF_RATE[detectOtType(r.date)],
    })),
    meta: buildMeta(total, page, limit),
  };
}

export async function createOvertime(userId: string, data: Record<string, unknown>) {
  const record = await prisma.overtimeRecord.create({
    data: {
      userId: BigInt(userId),
      date: new Date(data.date as string),
      hours: data.hours as number,
      reason: data.reason as string,
      status: "PENDING",
    },
    include: { user: { select: { id: true, fullName: true } } },
  });
  return { ...record, id: record.id.toString() };
}

export async function approveOvertime(id: string, approverId: string) {
  const record = await prisma.overtimeRecord.findUnique({ where: { id: BigInt(id) } });
  if (!record || record.status !== "PENDING") throw Object.assign(new Error("Cannot approve"), { status: 400 });

  // Note: comp-off record creation happens in Phase 7 (comp-off module)
  // Khi approve OT → chỉ update status. Comp-off được tạo riêng khi employee dùng.
  // Hoặc tự động tạo comp-off record — MVP: tự động tạo khi approve OT
  const otType = detectOtType(record.date);
  const compOffHours = Number(record.hours) * COMP_OFF_RATE[otType];

  return prisma.$transaction(async (tx) => {
    const updated = await tx.overtimeRecord.update({
      where: { id: BigInt(id) },
      data: { status: "APPROVED", approverId: BigInt(approverId), approvedAt: new Date() },
    });

    // Tự động tạo comp-off record với hours available
    await tx.compOffRecord.create({
      data: {
        userId: record.userId,
        overtimeId: record.id,
        fromDate: new Date(),    // start available from today
        toDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),  // expire 90 days
        totalDays: compOffHours / 8,   // convert hours → days
        reason: `Comp-off từ OT ngày ${record.date.toLocaleDateString("vi-VN")}`,
        status: "APPROVED",    // auto-approved khi tạo từ OT
      },
    });

    return { ...updated, id: updated.id.toString(), compOffHours };
  });
}

export async function rejectOvertime(id: string, approverId: string) {
  const record = await prisma.overtimeRecord.findUnique({ where: { id: BigInt(id) } });
  if (!record || record.status !== "PENDING") throw Object.assign(new Error("Cannot reject"), { status: 400 });

  const updated = await prisma.overtimeRecord.update({
    where: { id: BigInt(id) },
    data: { status: "REJECTED", approverId: BigInt(approverId), approvedAt: new Date() },
  });
  return { ...updated, id: updated.id.toString() };
}

// Thống kê OT cho dashboard
export async function getOvertimeSummary(userId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const records = await prisma.overtimeRecord.findMany({
    where: { userId: BigInt(userId), date: { gte: start, lte: end } },
  });

  const totalHours = records.filter((r) => r.status === "APPROVED").reduce((sum, r) => sum + Number(r.hours), 0);
  const pendingHours = records.filter((r) => r.status === "PENDING").reduce((sum, r) => sum + Number(r.hours), 0);

  return { totalHours, pendingHours };
}
```

---

## 6.5 Router

```typescript
// overtime.router.ts
overtimeRouter.use(authMiddleware);

overtimeRouter.get("/", ctrl.getAll);
overtimeRouter.get("/:id", ctrl.getOne);
overtimeRouter.post("/", ctrl.create);
overtimeRouter.patch("/:id/approve", requireRole("MANAGER", "HR", "ADMIN"), ctrl.approve);
overtimeRouter.patch("/:id/reject", requireRole("MANAGER", "HR", "ADMIN"), ctrl.reject);
```

---

## 6.6 Frontend Integration

**Overtime page (`/dashboard/overtime`):**
```typescript
// OT History — thay OT_HISTORY mock
const res = await fetch(`${API_URL}/api/overtime?limit=10`, {
  headers: { Authorization: `Bearer ${token}` },
});

// Đăng ký OT — thay setTimeout mock
const res = await fetch(`${API_URL}/api/overtime`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ date: workDate, hours: calc.otHrs, reason }),
});

// Stats
const stats = await fetch(`${API_URL}/api/overtime/summary`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

---

## Checklist Phase 6

- [x] `GET /api/overtime` — scope by role
- [x] `GET /api/overtime/:id` — detail
- [x] `POST /api/overtime` — đăng ký OT
- [x] `PATCH /api/overtime/:id/approve` — duyệt + tự động tạo comp-off record
- [x] `PATCH /api/overtime/:id/reject` — từ chối
- [x] Detect weekend từ date (Sat/Sun = weekend)
- [x] CompOff auto-created khi approve OT
