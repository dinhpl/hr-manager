import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { verifyAccessToken } from '../utils/jwt';

// Verify Bearer token and attach user payload to req.user
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing access token' } });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: BigInt(payload.id) },
      select: {
        id: true,
        email: true,
        role: true,
        systemRole: true,
        username: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found or inactive' },
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      systemRole: user.systemRole,
      username: user.username,
    };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
}
