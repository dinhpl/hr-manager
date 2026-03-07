import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Singleton Prisma client to avoid multiple connections in development
const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

export default prisma;
