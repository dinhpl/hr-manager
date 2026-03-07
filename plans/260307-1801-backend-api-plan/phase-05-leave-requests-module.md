# Phase 5 — Leave Requests Module

**Mục tiêu:** Full lifecycle quản lý đơn nghỉ phép: tạo, sửa, gửi, duyệt, từ chối, hủy, bulk approve. **Dùng transaction** để đảm bảo balance consistency.

---

## 5.1 Business Rules

| Action | Actor | Condition | Side Effect |
|---|---|---|---|
| CREATE | EMPLOYEE | — | Status = PENDING (không có DRAFT) |
| APPROVE | MANAGER/HR | Status = PENDING | Status → APPROVED, deduct balance |
| REJECT | MANAGER/HR | Status = PENDING | Status → REJECTED |
| CANCEL | EMPLOYEE | Status = PENDING | Status → CANCELLED |
| BULK_APPROVE | MANAGER/HR | Multiple PENDING | Approve tất cả, deduct balances |

**Scope theo role:**
- `EMPLOYEE`: chỉ thấy leave requests của mình
- `MANAGER`: thấy của team mình (subordinates)
- `HR/ADMIN`: thấy tất cả

---

## 5.2 File Structure

```
src/modules/leave-requests/
├── leave-requests.router.ts
├── leave-requests.controller.ts
├── leave-requests.service.ts
└── leave-requests.validation.ts
```

---

## 5.3 Validation

```typescript
// leave-requests.validation.ts
import { z } from "zod";
import { LeaveRequestStatus } from "@prisma/client";

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.coerce.bigint(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  totalDays: z.coerce.number().min(0.5),
  reason: z.string().min(1).max(1000),
  handoverNote: z.string().optional(),
  // Không có DRAFT — luôn tạo PENDING
});

export const getLeaveRequestsQuerySchema = z.object({
  status: z.nativeEnum(LeaveRequestStatus).optional(),
  userId: z.coerce.bigint().optional(),
  leaveTypeId: z.coerce.bigint().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  department: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const approveRejectSchema = z.object({
  note: z.string().optional(),
});

export const bulkApproveSchema = z.object({
  ids: z.array(z.coerce.bigint()).min(1),
  note: z.string().optional(),
});
```

---

## 5.4 Service

```typescript
// leave-requests.service.ts
import prisma from "../../config/prisma";
import { deductBalance, restoreBalance } from "../leave-balances/leave-balances.service";
import { getPaginationParams, buildMeta } from "../../utils/pagination";
import { UserRole } from "@prisma/client";

const LEAVE_REQUEST_INCLUDE = {
  user: { select: { id: true, fullName: true, username: true, department: true } },
  leaveType: { select: { id: true, code: true, name: true, color: true } },
  approver: { select: { id: true, fullName: true } },
} as const;

// Scope filter theo role
function buildWhereByRole(requestingUser: { userId: string; role: string }, overrideQuery: Record<string, unknown>) {
  const base: Record<string, unknown> = {};

  if (requestingUser.role === "EMPLOYEE") {
    base.userId = BigInt(requestingUser.userId);
  } else if (requestingUser.role === "MANAGER") {
    // chỉ thấy subordinates + chính mình
    base.user = { OR: [{ id: BigInt(requestingUser.userId) }, { managerId: BigInt(requestingUser.userId) }] };
  }
  // HR/ADMIN: không filter userId

  // Query overrides (HR/ADMIN có thể filter by user)
  if (overrideQuery.userId) base.userId = BigInt(overrideQuery.userId as string);
  if (overrideQuery.leaveTypeId) base.leaveTypeId = BigInt(overrideQuery.leaveTypeId as string);
  if (overrideQuery.status) base.status = overrideQuery.status;
  if (overrideQuery.department) base.user = { ...(base.user as object ?? {}), department: overrideQuery.department };
  if (overrideQuery.fromDate) base.fromDate = { gte: new Date(overrideQuery.fromDate as string) };
  if (overrideQuery.toDate) base.toDate = { lte: new Date(overrideQuery.toDate as string) };

  return base;
}

export async function getLeaveRequests(
  requestingUser: { userId: string; role: string },
  query: Record<string, unknown>
) {
  const { page, limit, skip } = getPaginationParams(query);
  const where = buildWhereByRole(requestingUser, query);

  const [requests, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: LEAVE_REQUEST_INCLUDE,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return {
    data: requests.map((r) => ({ ...r, id: r.id.toString(), userId: r.userId.toString() })),
    meta: buildMeta(total, page, limit),
  };
}

export async function getLeaveRequestById(id: string, requestingUser: { userId: string; role: string }) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: BigInt(id) },
    include: LEAVE_REQUEST_INCLUDE,
  });

  if (!request) throw Object.assign(new Error("Leave request not found"), { status: 404 });

  // EMPLOYEE chỉ xem của mình
  if (requestingUser.role === "EMPLOYEE" && request.userId.toString() !== requestingUser.userId) {
    throw Object.assign(new Error("Access denied"), { status: 403 });
  }

  return { ...request, id: request.id.toString(), userId: request.userId.toString() };
}

export async function createLeaveRequest(userId: string, data: Record<string, unknown>) {
  const request = await prisma.leaveRequest.create({
    data: {
      userId: BigInt(userId),
      leaveTypeId: data.leaveTypeId as bigint,
      fromDate: new Date(data.fromDate as string),
      toDate: new Date(data.toDate as string),
      totalDays: data.totalDays as number,
      reason: data.reason as string,
      status: (data.status as string) ?? "PENDING",
    },
    include: LEAVE_REQUEST_INCLUDE,
  });
  return { ...request, id: request.id.toString() };
}

export async function approveLeaveRequest(id: string, approverId: string, note?: string) {
  // Transaction: update status + deduct balance
  return prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({ where: { id: BigInt(id) } });
    if (!request) throw Object.assign(new Error("Not found"), { status: 404 });
    if (request.status !== "PENDING") throw Object.assign(new Error("Cannot approve non-pending request"), { status: 400 });

    const updated = await tx.leaveRequest.update({
      where: { id: BigInt(id) },
      data: {
        status: "APPROVED",
        approverId: BigInt(approverId),
        approvedAt: new Date(),
        approvedNote: note,
      },
      include: LEAVE_REQUEST_INCLUDE,
    });

    // Deduct leave balance
    await tx.leaveBalance.updateMany({
      where: {
        userId: request.userId,
        leaveTypeId: request.leaveTypeId,
        year: new Date(request.fromDate).getFullYear(),
      },
      data: { usedDays: { increment: Number(request.totalDays) } },
    });

    return { ...updated, id: updated.id.toString() };
  });
}

export async function rejectLeaveRequest(id: string, approverId: string, note?: string) {
  const request = await prisma.leaveRequest.findUnique({ where: { id: BigInt(id) } });
  if (!request || request.status !== "PENDING") throw Object.assign(new Error("Cannot reject"), { status: 400 });

  const updated = await prisma.leaveRequest.update({
    where: { id: BigInt(id) },
    data: { status: "REJECTED", approverId: BigInt(approverId), approvedAt: new Date(), approvedNote: note },
    include: LEAVE_REQUEST_INCLUDE,
  });
  return { ...updated, id: updated.id.toString() };
}

export async function cancelLeaveRequest(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({ where: { id: BigInt(id) } });
    if (!request) throw Object.assign(new Error("Not found"), { status: 404 });
    if (request.userId.toString() !== userId) throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (!["PENDING", "DRAFT"].includes(request.status)) {
      throw Object.assign(new Error("Cannot cancel approved/rejected request"), { status: 400 });
    }

    const updated = await tx.leaveRequest.update({
      where: { id: BigInt(id) },
      data: { status: "CANCELLED" },
    });

    // Nếu đã APPROVED trước đó (edge case: đang cancel khi approved) → restore balance
    if (request.status === "APPROVED") {
      await tx.leaveBalance.updateMany({
        where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year: new Date(request.fromDate).getFullYear() },
        data: { usedDays: { decrement: Number(request.totalDays) } },
      });
    }

    return updated;
  });
}

export async function bulkApproveLeaveRequests(ids: bigint[], approverId: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const requests = await tx.leaveRequest.findMany({
      where: { id: { in: ids }, status: "PENDING" },
    });

    await tx.leaveRequest.updateMany({
      where: { id: { in: requests.map((r) => r.id) } },
      data: { status: "APPROVED", approverId: BigInt(approverId), approvedAt: new Date(), approvedNote: note },
    });

    // Deduct all balances
    for (const r of requests) {
      await tx.leaveBalance.updateMany({
        where: { userId: r.userId, leaveTypeId: r.leaveTypeId, year: new Date(r.fromDate).getFullYear() },
        data: { usedDays: { increment: Number(r.totalDays) } },
      });
    }

    return { approved: requests.length };
  });
}
```

---

## 5.5 Router

```typescript
// leave-requests.router.ts
leaveRequestsRouter.use(authMiddleware);

leaveRequestsRouter.get("/", ctrl.getAll);
leaveRequestsRouter.get("/:id", ctrl.getOne);
leaveRequestsRouter.post("/", upload.single("attachment"), ctrl.create);  // multipart/form-data
leaveRequestsRouter.patch("/:id/approve", requireRole("MANAGER", "HR", "ADMIN"), ctrl.approve);
leaveRequestsRouter.patch("/:id/reject", requireRole("MANAGER", "HR", "ADMIN"), ctrl.reject);
leaveRequestsRouter.patch("/:id/cancel", ctrl.cancel);
leaveRequestsRouter.post("/bulk-approve", requireRole("MANAGER", "HR", "ADMIN"), ctrl.bulkApprove);
```

---

## 5.6 Frontend Integration

**Leave-request form (`/dashboard/leave-request`):**
```typescript
// Thay handleSubmit localStorage → API call
const res = await fetch(`${API_URL}/api/leave-requests`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ leaveTypeId, fromDate, toDate, totalDays: days, reason, status: isDraft ? "DRAFT" : "PENDING" }),
});
```

**Leave history (`/dashboard/leave-history`):**
```typescript
const res = await fetch(`${API_URL}/api/leave-requests?page=${page}&limit=20`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Approval page (`/dashboard/approval`):**
```typescript
// Approve
await fetch(`${API_URL}/api/leave-requests/${id}/approve`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ note: notes[id] }),
});

// Bulk approve
await fetch(`${API_URL}/api/leave-requests/bulk-approve`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ ids: selectedIds }),
});
```

---

## 5.7 File Attachment (Local Storage)

```bash
pnpm add multer
pnpm add -D @types/multer
```

**`src/utils/upload.ts`**
```typescript
import multer from "multer";
import path from "path";
import { nanoid } from "nanoid";   // hoặc crypto.randomUUID()

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/leave-attachments/"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${nanoid(8)}${ext}`);
  },
});

const ALLOWED_TYPES = ["application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png"];

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("File type not allowed"));
  },
});
```

**Serve files (trong `app.ts`):**
```typescript
import path from "path";
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
```

**Lưu path vào DB:** Khi tạo leave-request có file, lưu `file.filename` vào field `approved_note` hoặc cần thêm column `attachment_url TEXT` vào bảng `leave_requests` qua migration.

> **Migration cần:** `ALTER TABLE leave_requests ADD COLUMN attachment_url TEXT;`

---

## Checklist Phase 5

- [ ] `GET /api/leave-requests` — scope by role (employee own, manager team, hr all)
- [ ] `GET /api/leave-requests/:id` — detail
- [ ] `POST /api/leave-requests` — tạo PENDING (không có DRAFT), upload file nếu có
- [ ] `PATCH /api/leave-requests/:id/approve` — duyệt + deduct balance (transaction)
- [ ] `PATCH /api/leave-requests/:id/reject` — từ chối
- [ ] `PATCH /api/leave-requests/:id/cancel` — hủy (chỉ PENDING)
- [ ] `POST /api/leave-requests/bulk-approve` — duyệt hàng loạt
- [ ] `uploads/leave-attachments/` directory tạo sẵn (gitignore nội dung)
- [ ] Migration `attachment_url` column
- [ ] Static serve `/uploads/` endpoint
