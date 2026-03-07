import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

// Global error handler — must be registered last in Express middleware chain
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid request data", details: err.errors },
    });
  }

  if (err instanceof Error) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({
      success: false,
      error: { code: "SERVER_ERROR", message: err.message },
    });
  }

  return res
    .status(500)
    .json({ success: false, error: { code: "UNKNOWN_ERROR", message: "Something went wrong" } });
}
