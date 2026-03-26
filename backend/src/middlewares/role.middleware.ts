import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { hasAppRole, isSystemSuperAdmin } from '../utils/authz';

// RBAC guard — restrict route to specific roles
export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    const hasRole = hasAppRole(req.user, ...roles);
    const hasSystemAdmin = roles.includes('ADMIN') && isSystemSuperAdmin(req.user);

    if (!hasRole && !hasSystemAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }

    next();
  };
}
