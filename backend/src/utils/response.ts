import { Response } from "express";

// Standard success response
export function sendSuccess<T>(res: Response, data: T, meta?: object, status = 200) {
  return res.status(status).json({ success: true, data, ...(meta && { meta }) });
}

// Standard error response
export function sendError(
  res: Response,
  message: string,
  code: string,
  status = 400,
  details?: unknown
) {
  const errorBody: Record<string, unknown> = { code, message };
  if (details !== undefined) errorBody.details = details;
  return res.status(status).json({ success: false, error: errorBody });
}
