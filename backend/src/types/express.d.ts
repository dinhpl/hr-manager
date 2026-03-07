import { UserRole } from '@prisma/client';

// Extend Express Request to include authenticated user payload
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: bigint;
        email: string;
        role: UserRole;
        username: string;
      };
    }
  }
}
