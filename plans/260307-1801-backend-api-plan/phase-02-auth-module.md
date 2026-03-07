# Phase 2 — Auth Module

**Mục tiêu:** Implement auth với JWT (access + refresh token), bcrypt, RBAC middleware.

---

## 2.1 File Structure

```
src/modules/auth/
├── auth.router.ts
├── auth.controller.ts
├── auth.service.ts
└── auth.validation.ts

src/middlewares/
├── auth.middleware.ts   # verifyAccessToken
└── role.middleware.ts   # checkRole(roles[])
```

---

## 2.2 JWT Utilities

**`src/utils/jwt.ts`**
```typescript
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  userId: string;   // BigInt serialized as string
  role: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
```

---

## 2.3 Auth Middleware

**`src/middlewares/auth.middleware.ts`**
```typescript
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing token" } });
  }

  try {
    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);
    req.user = payload;  // extended via types/express.d.ts
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: "TOKEN_INVALID", message: "Invalid or expired token" } });
  }
}
```

**`src/middlewares/role.middleware.ts`**
```typescript
import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } });
    }
    next();
  };
}
```

**`src/types/express.d.ts`**
```typescript
import { JwtPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
```

---

## 2.4 Auth Validation

**`src/modules/auth/auth.validation.ts`**
```typescript
import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }),
});

export const refreshSchema = z.object({
  cookies: z.object({
    refreshToken: z.string().min(1),
  }),
});
```

---

## 2.5 Auth Service

**`src/modules/auth/auth.service.ts`**
```typescript
import bcrypt from "bcrypt";
import prisma from "../../config/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";

export async function login(username: string, password: string) {
  // Find by username OR email
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
      isActive: true,
    },
  });

  if (!user) throw Object.assign(new Error("Invalid credentials"), { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw Object.assign(new Error("Invalid credentials"), { status: 401 });

  const payload = { userId: user.id.toString(), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      avatar: user.avatar,
    },
  };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({ userId: payload.userId, role: payload.role });
    return { accessToken };
  } catch {
    throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  }
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      id: true, username: true, email: true, fullName: true,
      role: true, department: true, position: true, avatar: true,
      manager: { select: { id: true, fullName: true } },
    },
  });

  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

  return { ...user, id: user.id.toString() };
}
```

---

## 2.6 Auth Controller

**`src/modules/auth/auth.controller.ts`**
```typescript
import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";
import { loginSchema } from "./auth.validation";
import { sendSuccess } from "../../utils/response";

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const { body } = loginSchema.parse({ body: req.body });
    const result = await authService.login(body.username, body.password);

    // Set refreshToken in httpOnly cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, { accessToken: result.accessToken, user: result.user }, undefined, 200);
  } catch (err) {
    next(err);
  }
}

export async function refreshController(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: { code: "NO_REFRESH_TOKEN", message: "No refresh token" } });
    }
    const result = await authService.refreshAccessToken(refreshToken);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function logoutController(_req: Request, res: Response) {
  res.clearCookie("refreshToken");
  sendSuccess(res, { message: "Logged out successfully" });
}

export async function meController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}
```

---

## 2.7 Auth Router

**`src/modules/auth/auth.router.ts`**
```typescript
import { Router } from "express";
import { loginController, refreshController, logoutController, meController } from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const authRouter = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 */
authRouter.post("/login", loginController);
authRouter.post("/refresh-token", refreshController);
authRouter.post("/logout", logoutController);
authRouter.get("/me", authMiddleware, meController);
```

---

## 2.8 Frontend Integration (Auth)

Thay `handleSubmit` trong `app/page.tsx`:
```typescript
// Hiện tại: check DEMO_ACCOUNTS
// Thay thành:
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
  credentials: "include",  // để nhận refreshToken cookie
});
const data = await response.json();
if (data.success) {
  // Lưu accessToken vào memory/context, user info vào storage
  localStorage/sessionStorage.setItem("accessToken", data.data.accessToken);
  localStorage/sessionStorage.setItem("userInfo", JSON.stringify(data.data.user));
  router.push("/dashboard");
} else {
  setError(data.error.message);
}
```

---

## Checklist Phase 2

- [ ] `POST /api/auth/login` — đăng nhập thành công trả access + refresh token
- [ ] `POST /api/auth/refresh-token` — làm mới access token từ cookie
- [ ] `POST /api/auth/logout` — xóa cookie
- [ ] `GET /api/auth/me` — lấy info user hiện tại
- [ ] `authMiddleware` chặn request không có token
- [ ] `requireRole()` chặn sai role
- [ ] Test: login với admin@company.com từ seed data
