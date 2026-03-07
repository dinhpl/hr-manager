# Phase 3 — Users Module

**Mục tiêu:** CRUD employees, phục vụ trang `/dashboard/employees` và dropdown "người bàn giao" trong leave-request.

---

## 3.1 File Structure

```
src/modules/users/
├── users.router.ts
├── users.controller.ts
├── users.service.ts
└── users.validation.ts
```

---

## 3.2 Validation

**`src/modules/users/users.validation.ts`**
```typescript
import { z } from "zod";
import { UserRole } from "@prisma/client";

export const getUsersQuerySchema = z.object({
  search: z.string().optional(),
  department: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(100),
  password: z.string().min(6),
  fullName: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.nativeEnum(UserRole).default("EMPLOYEE"),
  department: z.string().optional(),
  position: z.string().optional(),
  managerId: z.coerce.bigint().optional(),
  companyJoinDate: z.string().datetime().optional(),
});

export const updateUserSchema = createUserSchema
  .omit({ email: true, username: true, password: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });
```

---

## 3.3 Service

**`src/modules/users/users.service.ts`**
```typescript
import bcrypt from "bcrypt";
import prisma from "../../config/prisma";
import { getPaginationParams, buildMeta } from "../../utils/pagination";

// Chỉ trả về các field an toàn (không có password)
const USER_SELECT = {
  id: true, email: true, username: true, fullName: true,
  firstName: true, lastName: true, role: true, department: true,
  position: true, avatar: true, teamId: true, isCountable: true,
  companyJoinDate: true, isActive: true, createdAt: true,
  manager: { select: { id: true, fullName: true } },
} as const;

export async function getUsers(query: Record<string, unknown>) {
  const { search, department, role, status, page, limit } = query as {
    search?: string; department?: string; role?: string;
    status?: string; page: number; limit: number;
  };
  const { skip } = getPaginationParams(query);

  const where = {
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { username: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(department && { department }),
    ...(role && { role: role as any }),
    ...(status === "active" && { isActive: true }),
    ...(status === "inactive" && { isActive: false }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: USER_SELECT, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users.map((u) => ({ ...u, id: u.id.toString() })),
    meta: buildMeta(total, page, limit),
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(id) },
    select: {
      ...USER_SELECT,
      leaveBalances: {
        where: { year: new Date().getFullYear() },
        include: { leaveType: { select: { code: true, name: true, color: true } } },
      },
    },
  });
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  return { ...user, id: user.id.toString() };
}

export async function createUser(data: Record<string, unknown>) {
  const { password, ...rest } = data as { password: string; [key: string]: unknown };
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check unique email/username
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: rest.email as string }, { username: rest.username as string }] },
  });
  if (existing) throw Object.assign(new Error("Email or username already exists"), { status: 409 });

  const user = await prisma.user.create({
    data: { ...rest, password: hashedPassword } as any,
    select: USER_SELECT,
  });
  return { ...user, id: user.id.toString() };
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const user = await prisma.user.update({
    where: { id: BigInt(id) },
    data: data as any,
    select: USER_SELECT,
  });
  return { ...user, id: user.id.toString() };
}

export async function deleteUser(id: string) {
  // Soft delete — chỉ set isActive=false
  await prisma.user.update({ where: { id: BigInt(id) }, data: { isActive: false } });
}

// Dùng cho dropdown "người bàn giao" trong leave-request form
export async function getUsersDropdown() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, username: true, department: true },
    orderBy: { fullName: "asc" },
  });
  return users.map((u) => ({ ...u, id: u.id.toString() }));
}
```

---

## 3.4 Controller & Router

**`src/modules/users/users.controller.ts`** — thin controller, gọi service, dùng `sendSuccess`:

```typescript
// Mỗi handler: try { validate → service → sendSuccess } catch (err) { next(err) }
// Pattern đồng nhất với auth controller
```

**`src/modules/users/users.router.ts`**
```typescript
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import * as ctrl from "./users.controller";

export const usersRouter = Router();

usersRouter.use(authMiddleware);

usersRouter.get("/", requireRole("HR", "ADMIN", "MANAGER"), ctrl.getUsers);
usersRouter.get("/dropdown", ctrl.getUsersDropdown);   // ALL roles — cho form bàn giao
usersRouter.get("/:id", ctrl.getUserById);
usersRouter.post("/", requireRole("HR", "ADMIN"), ctrl.createUser);
usersRouter.patch("/:id", requireRole("HR", "ADMIN"), ctrl.updateUser);
usersRouter.delete("/:id", requireRole("ADMIN"), ctrl.deleteUser);
```

---

## 3.5 Frontend Integration

**`/dashboard/employees`:**
```typescript
// Thay MOCK_EMPLOYEES
const res = await fetch(`${API_URL}/api/users?${queryString}`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const { data: employees, meta } = await res.json();
```

**Leave-request form — dropdown handover:**
```typescript
// Thay HANDOVER_PERSONS hardcode
const res = await fetch(`${API_URL}/api/users/dropdown`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const handoverOptions = await res.json();
```

---

## Checklist Phase 3

- [x] `GET /api/users` — list với filter search/dept/role/status + paginate
- [x] `GET /api/users/dropdown` — list rút gọn (id, fullName, username)
- [x] `GET /api/users/:id` — detail + leave balances năm nay
- [x] `POST /api/users` — tạo user, hash password
- [x] `PATCH /api/users/:id` — cập nhật
- [x] `DELETE /api/users/:id` — soft delete
- [x] Không trả `password` field trong bất kỳ response nào
