import { Request, Response, NextFunction } from 'express';
import { auditLogQuerySchema } from './audit-logs.validation';
import { getAuditLogs } from './audit-logs.service';
import { sendSuccess } from '../../utils/response';

export const auditLogsController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = auditLogQuerySchema.parse(req.query);
      const { data, meta } = await getAuditLogs(query, req.user!);
      sendSuccess(res, data, meta);
    } catch (err) {
      next(err);
    }
  },
};
