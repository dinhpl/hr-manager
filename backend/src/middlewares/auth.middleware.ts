import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

// Verify Bearer token and attach user payload to req.user
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing access token" } });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: BigInt(payload.id),
      email: payload.email,
      role: payload.role,
      username: payload.username,
    };
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
  }
}
