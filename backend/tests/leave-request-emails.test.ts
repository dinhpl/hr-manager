import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMailService,
  sendMailTemplateTest,
  sendLeaveRequestApprovedEmail,
  sendLeaveRequestCreatedEmail,
  sendLeaveRequestRejectedEmail,
} from '../src/modules/mail/mail.service';

const sendMail = vi.fn();

describe('leave request email delivery', () => {
  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: 'mail-1' });
  });

  it('sends leave request created email to approver with request summary html', async () => {
    const mailer = createMailService({ sendMail });

    await sendLeaveRequestCreatedEmail(mailer, {
      approverEmail: 'manager@example.com',
      approverName: 'Tran Thi B',
      requesterName: 'Nguyen Van A',
      leaveTypeName: 'Nghi phep nam',
      fromDateLabel: '25/03/2026 08:00',
      toDateLabel: '25/03/2026 17:15',
      totalDaysLabel: '1 ngay',
      reason: 'Di kham benh',
      detailUrl: 'http://localhost:3000/dashboard/leave-request',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'manager@example.com',
        subject: expect.stringContaining('yeu cau nghi phep moi'),
        html: expect.stringContaining('Nguyen Van A'),
      }),
    );
  });

  it('sends leave approval email to requester with approver note html', async () => {
    const mailer = createMailService({ sendMail });

    await sendLeaveRequestApprovedEmail(mailer, {
      requesterEmail: 'employee@example.com',
      requesterName: 'Nguyen Van A',
      approverName: 'Tran Thi B',
      leaveTypeName: 'Nghi phep nam',
      fromDateLabel: '25/03/2026 08:00',
      toDateLabel: '25/03/2026 17:15',
      totalDaysLabel: '1 ngay',
      note: 'Da duyet. Ban giao day du.',
      detailUrl: 'http://localhost:3000/dashboard/leave-history',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.com',
        subject: expect.stringContaining('da duoc duyet'),
        html: expect.stringContaining('Da duyet. Ban giao day du.'),
      }),
    );
  });

  it('sends leave rejection email to requester with rejection note html', async () => {
    const mailer = createMailService({ sendMail });

    await sendLeaveRequestRejectedEmail(mailer, {
      requesterEmail: 'employee@example.com',
      requesterName: 'Nguyen Van A',
      approverName: 'Tran Thi B',
      leaveTypeName: 'Nghi phep nam',
      fromDateLabel: '25/03/2026 08:00',
      toDateLabel: '25/03/2026 17:15',
      totalDaysLabel: '1 ngay',
      note: 'Can bo sung ke hoach ban giao.',
      detailUrl: 'http://localhost:3000/dashboard/leave-history',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.com',
        subject: expect.stringContaining('bi tu choi'),
        html: expect.stringContaining('Can bo sung ke hoach ban giao.'),
      }),
    );
  });

  it('skips business mail when system mail toggle is disabled', async () => {
    const mailer = createMailService(
      { sendMail },
      {
        templateEnabledResolver: async () => false,
      },
    );

    const result = await sendLeaveRequestApprovedEmail(mailer, {
      requesterEmail: 'employee@example.com',
      requesterName: 'Nguyen Van A',
      approverName: 'Tran Thi B',
      leaveTypeName: 'Nghi phep nam',
      fromDateLabel: '25/03/2026 08:00',
      toDateLabel: '25/03/2026 17:15',
      totalDaysLabel: '1 ngay',
      note: 'Da duyet.',
    });

    expect(result).toEqual({ skipped: true, reason: 'mail_template_disabled' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends test mail even when system mail toggle is disabled', async () => {
    const mailer = createMailService(
      { sendMail },
      {
        templateEnabledResolver: async () => false,
      },
    );

    await sendMailTemplateTest(mailer, 'tester@example.com', 'leave_request_rejected');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'tester@example.com',
        subject: expect.stringContaining('bi tu choi'),
      }),
    );
  });
});
