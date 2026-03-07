import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";

// RBAC guard — restrict route to specific roles
export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    }

    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } });
    }

    next();
  };
}
