import { Request, Response, NextFunction } from 'express';
import * as service from './settings.service';
import { sendSuccess } from '../../utils/response';
import { createAuditLog, getClientIp } from '../audit-logs/audit-logs.service';
import {
  mailService,
  renderMailTemplatePreview,
  sendMailTemplateTest,
  type MailTemplateType,
} from '../mail/mail.service';

export async function getLeavePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const policy = await service.getLeavePolicy();
    sendSuccess(res, policy);
  } catch (err) {
    next(err);
  }
}

export async function updateLeavePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateLeavePolicy(req.body);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SETTING',
      entityName: 'Leave Policy',
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getApprovalFlow(req: Request, res: Response, next: NextFunction) {
  try {
    const flow = await service.getApprovalFlow();
    sendSuccess(res, flow);
  } catch (err) {
    next(err);
  }
}

export async function updateApprovalFlow(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateApprovalFlow(req.body);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SETTING',
      entityName: 'Approval Flow',
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getAttendance();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateAttendance(req.body);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SETTING',
      entityName: 'Attendance Settings',
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getMailSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getMailSettings();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateMailSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateMailSettings(req.body);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SETTING',
      entityName: 'Mail Settings',
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function testMailTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const recipientEmail = String(req.body?.recipientEmail ?? '').trim();
    const template = String(req.body?.template ?? '').trim() as MailTemplateType;

    if (!recipientEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw Object.assign(new Error('Email nhận test không hợp lệ'), { status: 400 });
    }

    if (
      template !== 'leave_request_created' &&
      template !== 'leave_request_approved' &&
      template !== 'leave_request_rejected'
    ) {
      throw Object.assign(new Error('Template mail test không hợp lệ'), { status: 400 });
    }

    const result = await sendMailTemplateTest(mailService, recipientEmail, template);

    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE',
      module: 'SETTING',
      entityName: `Mail Test: ${template}`,
      ipAddress: getClientIp(req),
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getWorkspaceMap(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getWorkspaceMap();
    sendSuccess(res, data ?? { items: [] });
  } catch (err) {
    next(err);
  }
}

export async function updateWorkspaceMap(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateWorkspaceMap(req.body);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SETTING',
      entityName: 'Workspace Map',
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function previewMailTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = String(req.query.template ?? '').trim() as MailTemplateType;

    if (
      template !== 'leave_request_created' &&
      template !== 'leave_request_approved' &&
      template !== 'leave_request_rejected'
    ) {
      throw Object.assign(new Error('Template mail preview không hợp lệ'), { status: 400 });
    }

    sendSuccess(res, { html: renderMailTemplatePreview(template) });
  } catch (err) {
    next(err);
  }
}
