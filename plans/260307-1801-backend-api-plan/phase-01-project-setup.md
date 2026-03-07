# Phase 1 — Project Setup

**Mục tiêu:** Tạo thư mục `backend/`, cài đặt dependencies, cấu hình TypeScript + Prisma + Docker, chạy được server rỗng.

---

## 1.1 Khởi tạo project

```bash
mkdir backend && cd backend
pnpm init
```

**`package.json` scripts:**
```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## 1.2 Dependencies

```bash
# Production
pnpm add express cors helmet express-rate-limit jsonwebtoken bcrypt \
  zod dotenv pino pino-http @prisma/client \
  swagger-jsdoc swagger-ui-express

# Dev
pnpm add -D typescript tsx @types/node @types/express \
  @types/jsonwebtoken @types/bcrypt @types/cors \
  @types/swagger-jsdoc @types/swagger-ui-express \
  prisma eslint prettier vitest supertest @types/supertest
```

---

## 1.3 TypeScript Config

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## 1.4 Env Config

```bash
# .env.example
DATABASE_URL=postgresql://postgres:secret@localhost:5432/hr_leave_db
JWT_ACCESS_SECRET=your-access-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**`src/config/env.ts`** — validate env với Zod khi startup:
```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
```

---

## 1.5 Prisma Setup

```bash
pnpm prisma init
```

Copy `schema.prisma` từ plan.md (Section 5).

```bash
# Apply schema to existing DB (chạy hr_leave_db.sql trước)
pnpm prisma db pull   # introspect existing DB
# hoặc
pnpm prisma migrate dev --name init
```

---

## 1.6 Express App

**`src/config/prisma.ts`**
```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
});

export default prisma;
```

**`src/app.ts`**
```typescript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { errorMiddleware } from "./middlewares/error.middleware";

// Module routers imported here
import { authRouter } from "./modules/auth/auth.router";
import { usersRouter } from "./modules/users/users.router";
// ... other routers

export function createApp() {
  const app = express();

  // Security
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(pinoHttp());

  // Health check
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Routes
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  // ... other routers

  // Swagger docs (dev only)
  if (env.NODE_ENV === "development") {
    const swaggerUi = require("swagger-ui-express");
    const swaggerSpec = require("./config/swagger");
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  // Error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
```

**`src/server.ts`**
```typescript
import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
```

---

## 1.7 Utilities

**`src/utils/response.ts`**
```typescript
import { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, meta?: object, status = 200) {
  return res.status(status).json({ success: true, data, ...(meta && { meta }) });
}

export function sendError(res: Response, message: string, code: string, status = 400, details?: unknown) {
  return res.status(status).json({ success: false, error: { code, message, ...(details && { details }) } });
}
```

**`src/utils/pagination.ts`**
```typescript
export function getPaginationParams(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildMeta(total: number, page: number, limit: number) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}
```

---

## 1.8 Error Middleware

**`src/middlewares/error.middleware.ts`**
```typescript
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid request data", details: err.errors },
    });
  }

  if (err instanceof Error) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({
      success: false,
      error: { code: "SERVER_ERROR", message: err.message },
    });
  }

  return res.status(500).json({ success: false, error: { code: "UNKNOWN_ERROR", message: "Something went wrong" } });
}
```

---

## 1.9 Docker Setup

**`Dockerfile`**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

**`docker-compose.yml`** (root level)
```yaml
version: "3.8"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: hr_leave_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./hr_leave_db.sql:/docker-entrypoint-initdb.d/init.sql

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://postgres:secret@db:5432/hr_leave_db
      JWT_ACCESS_SECRET: change-me-in-production
      JWT_REFRESH_SECRET: change-me-in-production-too
      FRONTEND_URL: http://localhost:3000
    volumes:
      - ./backend/.env:/app/.env

volumes:
  pgdata:
```

---

## Checklist Phase 1

- [x] `backend/` directory tạo xong
- [x] pnpm install thành công
- [x] TypeScript compile không lỗi
- [x] Prisma schema sync với DB
- [x] `GET /health` trả về `{ status: "ok" }`
- [x] Docker compose chạy được DB
- [x] `.env.example` đầy đủ
