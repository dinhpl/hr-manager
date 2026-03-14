import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

// RBAC guard — restrict route to specific roles
export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    const hasRole = roles.includes(req.user.role);
    const hasSystemAdmin = roles.includes('ADMIN') && req.user.systemRole === 'ADMIN';

    if (!hasRole && !hasSystemAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }

    next();
  };
}
