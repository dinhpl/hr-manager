import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { leaveTypesRouter } from './modules/leave-types/leave-types.router';
import { leaveBalancesRouter } from './modules/leave-balances/leave-balances.router';
import { leaveRequestsRouter } from './modules/leave-requests/leave-requests.router';
import { overtimeRouter } from './modules/overtime/overtime.router';
import { compOffRouter } from './modules/comp-off/comp-off.router';
import { dashboardRouter } from './modules/dashboard/dashboard.router';
import { reportsRouter } from './modules/reports/reports.router';
import { settingsRouter } from './modules/settings/settings.router';
import { departmentsRouter } from './modules/departments/departments.router';
import { notificationsRouter } from './modules/notifications/notifications.router';

export function createApp(): Application {
  const app = express();

  // Serialize BigInt values as strings in all JSON responses
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

  // Security headers — cho phép frontend (origin khác) nhúng tài nguyên /uploads (avatar, file)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS — allow frontend origins (production port 5500 + dev port 3000)
  const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5500'];
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, mobile apps) or matching allowed origins
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      credentials: true,
    }),
  );

  // Rate limiting: 200 requests per 1 minute per IP
  app.use(rateLimit({ windowMs: 1 * 60 * 1000, max: 200 }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Cookie parsing (needed for refreshToken httpOnly cookie)
  app.use(cookieParser());

  // Request logging
  app.use(pinoHttp());

  // Serve uploaded files (leave attachments + avatars)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Health check
  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', timestamp: new Date().toISOString() }),
  );

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/leave-types', leaveTypesRouter);
  app.use('/api/leave-balances', leaveBalancesRouter);
  app.use('/api/leave-requests', leaveRequestsRouter);
  app.use('/api/overtime', overtimeRouter);
  app.use('/api/comp-off', compOffRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/departments', departmentsRouter);
  app.use('/api/notifications', notificationsRouter);

  // Swagger docs (dev only)
  if (env.NODE_ENV === 'development') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const swaggerUi = require('swagger-ui-express');
    const { swaggerSpec } = require('./config/swagger');
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  // Global error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
