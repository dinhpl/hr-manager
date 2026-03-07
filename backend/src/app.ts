import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import path from "path";
import { env } from "./config/env";
import { errorMiddleware } from "./middlewares/error.middleware";
import { authRouter } from "./modules/auth/auth.router";

export function createApp(): Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — allow frontend origin with credentials for httpOnly cookies
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );

  // Rate limiting: 200 requests per 15 minutes per IP
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Cookie parsing (needed for refreshToken httpOnly cookie)
  app.use(cookieParser());

  // Request logging
  app.use(pinoHttp());

  // Serve uploaded files (leave attachments)
  app.use("/uploads", express.static(path.join(process.cwd(), env.UPLOAD_DIR, "..")));

  // Health check endpoint
  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  // API routes
  app.use("/api/auth", authRouter);
  // Phase 3+: thêm routers tiếp theo ở đây

  // Swagger docs (dev only)
  if (env.NODE_ENV === "development") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const swaggerUi = require("swagger-ui-express");
    const { swaggerSpec } = require("./config/swagger");
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  // Global error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
