# Phase 4 — Leave Types & Leave Balances

**Mục tiêu:** CRUD leave types + balance management. Phục vụ: leave-request dropdown, settings page, dashboard.

---

## 4.1 Leave Types

### File Structure
```
src/modules/leave-types/
├── leave-types.router.ts
├── leave-types.controller.ts
└── leave-types.service.ts
```

### Service
```typescript
// leave-types.service.ts

export async function getLeaveTypes(activeOnly = true) {
  return prisma.leaveType.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { code: "asc" },
  });
}

export async function createLeaveType(data: {
  code: string; name: string; description?: string;
  defaultDays: number; isPaid: boolean; color: string;
}) {
  const exists = await prisma.leaveType.findUnique({ where: { code: data.code } });
  if (exists) throw Object.assign(new Error("Leave type code already exists"), { status: 409 });
  return prisma.leaveType.create({ data: data as any });
}

export async function updateLeaveType(id: string, data: Partial<{
  name: string; description: string; defaultDays: number;
  isPaid: boolean; color: string; isActive: boolean;
}>) {
  return prisma.leaveType.update({ where: { id: BigInt(id) }, data: data as any });
}

export async function deleteLeaveType(id: string) {
  // Check if any leave request uses this type
  const count = await prisma.leaveRequest.count({ where: { leaveTypeId: BigInt(id) } });
  if (count > 0) throw Object.assign(new Error("Leave type in use, cannot delete"), { status: 409 });
  await prisma.leaveType.update({ where: { id: BigInt(id) }, data: { isActive: false } });
}
```

### Router
```typescript
// leave-types.router.ts
leaveTypesRouter.get("/", authMiddleware, ctrl.getAll);   // ALL roles
leaveTypesRouter.post("/", authMiddleware, requireRole("HR", "ADMIN"), ctrl.create);
leaveTypesRouter.patch("/:id", authMiddleware, requireRole("HR", "ADMIN"), ctrl.update);
leaveTypesRouter.delete("/:id", authMiddleware, requireRole("ADMIN"), ctrl.remove);
```

---

## 4.2 Leave Balances

### Mục đích
- Employee xem balance của mình khi tạo leave request
- HR/Admin xem/điều chỉnh balance của nhân viên
- Tự động khởi tạo balance năm mới từ `leave_types.default_days`

### File Structure
```
src/modules/leave-balances/
├── leave-balances.router.ts
├── leave-balances.controller.ts
└── leave-balances.service.ts
```

### Service
```typescript
// leave-balances.service.ts

// Lấy balance của user (year mặc định = năm hiện tại)
export async function getUserBalances(userId: string, year?: number) {
  const targetYear = year ?? new Date().getFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { userId: BigInt(userId), year: targetYear },
    include: { leaveType: { select: { code: true, name: true, color: true } } },
    orderBy: { leaveType: { code: "asc" } },
  });
  return balances.map((b) => ({
    ...b,
    id: b.id.toString(),
    userId: b.userId.toString(),
    leaveTypeId: b.leaveTypeId.toString(),
    remaining: Number(b.totalDays) - Number(b.usedDays),
  }));
}

// Khởi tạo balance từ leave_types.default_days cho một user
export async function initializeBalancesForUser(userId: string, year: number) {
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });

  const data = leaveTypes.map((lt) => ({
    userId: BigInt(userId),
    leaveTypeId: lt.id,
    year,
    totalDays: lt.defaultDays,
    usedDays: 0,
  }));

  // upsert — không tạo duplicate
  await Promise.all(
    data.map((d) =>
      prisma.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId: d.userId, leaveTypeId: d.leaveTypeId, year: d.year } },
        create: d,
        update: {}, // không ghi đè nếu đã tồn tại
      })
    )
  );
}

// HR/Admin điều chỉnh balance
export async function adjustBalance(id: string, totalDays: number) {
  return prisma.leaveBalance.update({
    where: { id: BigInt(id) },
    data: { totalDays },
  });
}

// Sau khi approve leave request: trừ usedDays
export async function deductBalance(userId: string, leaveTypeId: string, days: number, year: number) {
  await prisma.leaveBalance.updateMany({
    where: { userId: BigInt(userId), leaveTypeId: BigInt(leaveTypeId), year },
    data: { usedDays: { increment: days } },
  });
}

// Sau khi cancel/reject: hoàn lại usedDays
export async function restoreBalance(userId: string, leaveTypeId: string, days: number, year: number) {
  await prisma.leaveBalance.updateMany({
    where: { userId: BigInt(userId), leaveTypeId: BigInt(leaveTypeId), year },
    data: { usedDays: { decrement: days } },
  });
}
```

### Router
```typescript
// leave-balances.router.ts
balancesRouter.get("/", authMiddleware, ctrl.getMyBalances);          // EMPLOYEE: balance của mình
balancesRouter.get("/:userId", authMiddleware, requireRole("MANAGER", "HR", "ADMIN"), ctrl.getUserBalances);
balancesRouter.post("/initialize", authMiddleware, requireRole("HR", "ADMIN"), ctrl.initializeBalances);
balancesRouter.patch("/:id", authMiddleware, requireRole("HR", "ADMIN"), ctrl.adjustBalance);
```

---

## 4.3 Frontend Integration

**Leave-request form — hiển thị balance:**
```typescript
// Thay LEAVE_BALANCE hardcode
const res = await fetch(`${API_URL}/api/leave-balances`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const balances = await res.json();
// Map để hiển thị granted/used/remaining cho loại phép đã chọn
```

**Settings page — leave types management:**
```typescript
// Thay hardcode leave types list
const res = await fetch(`${API_URL}/api/leave-types?activeOnly=false`);
```

---

## Checklist Phase 4

- [x] `GET /api/leave-types` — list all active leave types
- [x] `POST /api/leave-types` — tạo loại nghỉ mới
- [x] `PATCH /api/leave-types/:id` — cập nhật
- [x] `DELETE /api/leave-types/:id` — soft delete (check nếu đang dùng)
- [x] `GET /api/leave-balances` — balance năm hiện tại của user đang login
- [x] `GET /api/leave-balances/:userId` — balance của user cụ thể (MANAGER+)
- [x] `POST /api/leave-balances/initialize` — khởi tạo balance năm mới
- [x] `PATCH /api/leave-balances/:id` — điều chỉnh balance
- [x] `deductBalance` / `restoreBalance` utilities sẵn sàng cho Phase 5
