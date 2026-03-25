import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

function loadEnvFiles() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, '../.env'),
    path.resolve(cwd, '../.env.local'),
    path.resolve(cwd, '.env'),
    path.resolve(cwd, '.env.local'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: false });
    }
  }
}

loadEnvFiles();

const booleanSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default('uploads/leave-attachments'),
  MAIL_ENABLED: booleanSchema.default(false),
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().default(587),
  MAIL_SECURE: booleanSchema.default(false),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM_EMAIL: z.string().email().default('no-reply@ota.local'),
  MAIL_FROM_NAME: z.string().default('OTA HR System'),
  MAIL_REPLY_TO: z.string().email().optional(),
});

export const env = envSchema.parse(process.env);
