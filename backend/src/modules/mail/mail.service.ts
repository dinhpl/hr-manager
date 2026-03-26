import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import prisma from '../../config/prisma';
import { getMailSettings } from '../settings/settings.service';

type MailClient = {
  sendMail: (mail: SendMailOptions) => Promise<unknown>;
};

type MailResult = { skipped: true; reason: string } | { skipped: false; messageId?: string | null };
type MailSendBehavior = { skipSystemDisable?: boolean };
type MailTemplateBehavior = MailSendBehavior & { template: MailTemplateType };
type MailServiceOptions = {
  templateEnabledResolver?: (template: MailTemplateType) => Promise<boolean>;
  hrRecipientsResolver?: () => Promise<string[]>;
};

type LeaveRequestCreatedEmailParams = {
  approverEmail?: string | null;
  approverName?: string | null;
  requesterName: string;
  handoverName?: string | null;
  leaveTypeName: string;
  fromDateLabel: string;
  toDateLabel: string;
  totalDaysLabel: string;
  reason: string;
  detailUrl?: string | null;
};

type LeaveRequestDecisionEmailParams = {
  requesterEmail?: string | null;
  requesterName: string;
  approverName: string;
  handoverName?: string | null;
  leaveTypeName: string;
  fromDateLabel: string;
  toDateLabel: string;
  totalDaysLabel: string;
  note?: string | null;
  detailUrl?: string | null;
};

export type MailTemplateType =
  | 'leave_request_created'
  | 'leave_request_approved'
  | 'leave_request_rejected';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function normalizeMailTemplateSettings(value: unknown): Record<MailTemplateType, boolean> {
  const fallback: Record<MailTemplateType, boolean> = {
    leave_request_created: true,
    leave_request_approved: true,
    leave_request_rejected: true,
  };

  if (!value || typeof value !== 'object') return fallback;

  return {
    leave_request_created:
      typeof (value as Record<string, unknown>).leave_request_created === 'boolean'
        ? Boolean((value as Record<string, unknown>).leave_request_created)
        : fallback.leave_request_created,
    leave_request_approved:
      typeof (value as Record<string, unknown>).leave_request_approved === 'boolean'
        ? Boolean((value as Record<string, unknown>).leave_request_approved)
        : fallback.leave_request_approved,
    leave_request_rejected:
      typeof (value as Record<string, unknown>).leave_request_rejected === 'boolean'
        ? Boolean((value as Record<string, unknown>).leave_request_rejected)
        : fallback.leave_request_rejected,
  };
}

function normalizeAddressList(value: SendMailOptions['to'] | SendMailOptions['cc']): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeAddressList(item as SendMailOptions['to']))
      .filter(Boolean) as string[];
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object' && 'address' in value && typeof value.address === 'string') {
    return [value.address.trim()].filter(Boolean);
  }
  return [];
}

function buildMailShell(params: {
  title: string;
  intro: string;
  statusLabel: string;
  statusTone: 'warning' | 'success' | 'danger';
  sections: Array<{ label: string; value: string }>;
  note?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}) {
  // Card header: first section (person name) • second-to-last section (leave type)
  // Show remaining sections as simple lines
  const cardHeaderSection = params.sections.find((s) =>
    ['Người gửi', 'Nhân viên'].includes(s.label),
  );
  const leaveTypeSection = params.sections.find((s) => s.label === 'Loại nghỉ');
  const cardHeader =
    cardHeaderSection && leaveTypeSection
      ? `${escapeHtml(cardHeaderSection.value)} • ${escapeHtml(leaveTypeSection.value)}`
      : escapeHtml(params.sections[0]?.value ?? '');

  const detailSections = params.sections.filter(
    (s) => !['Người gửi', 'Nhân viên', 'Loại nghỉ'].includes(s.label),
  );

  const approverLabels = ['Người duyệt', 'Người xử lý'];
  const detailLinesHtml = detailSections
    .map((s, i) => {
      const content = approverLabels.includes(s.label)
        ? `${escapeHtml(s.label)}: ${escapeHtml(s.value)}`
        : escapeHtml(s.value);
      return `<div style="margin-top:${i === 0 ? '6' : '4'}px;font-size:13px;color:#6b7280;">${content}</div>`;
    })
    .join('');

  const noteLineHtml = params.note
    ? `<div style="margin-top:8px;font-size:13px;color:#374151;">${escapeHtml(params.note)}</div>`
    : '';

  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `
        <div style="text-align:center;margin-top:20px;">
          <a href="${escapeHtml(params.ctaUrl)}"
            style="display:inline-block;background:#1db87a;color:#fff;
                   padding:10px 20px;border-radius:8px;
                   text-decoration:none;font-weight:bold;font-size:14px;">
            ${escapeHtml(params.ctaLabel)}
          </a>
        </div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
</head>
<body style="margin:0;padding:0;background:#f5f7f6;font-family:Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">

        <table width="400" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid #eee;">
              <div style="font-size:14px;font-weight:bold;color:#1db87a;">Leave Management</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">HR WORKSPACE</div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px;">

              <div style="font-size:18px;font-weight:bold;color:#111;">${escapeHtml(params.title)}</div>

              <div style="margin-top:16px;background:#f9fafb;border-radius:10px;padding:14px;">

                <div style="font-size:14px;font-weight:600;color:#111;">${cardHeader}</div>

                ${detailLinesHtml}
                ${noteLineHtml}

              </div>

              ${ctaHtml}

            </td>
          </tr>

          <tr>
            <td style="padding:16px 20px;border-top:1px solid #eee;background:#fafafa;">
              <div style="font-size:12px;color:#9ca3af;text-align:center;">
                Đây là email tự động, vui lòng không trả lời.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

function buildRangeLabel(fromDateLabel: string, toDateLabel: string) {
  return fromDateLabel === toDateLabel ? fromDateLabel : `${fromDateLabel} - ${toDateLabel}`;
}

function createTransporter() {
  if (!env.MAIL_ENABLED) return null;

  if (!env.MAIL_HOST) {
    throw new Error('MAIL_HOST is required when MAIL_ENABLED=true');
  }

  return nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_SECURE,
    auth:
      env.MAIL_USER && env.MAIL_PASSWORD
        ? {
            user: env.MAIL_USER,
            pass: env.MAIL_PASSWORD,
          }
        : undefined,
  });
}

export function createMailService(client?: MailClient, options?: MailServiceOptions) {
  const transporter = client ?? createTransporter();
  const resolveTemplateEnabled =
    options?.templateEnabledResolver ??
    (client
      ? async (_template: MailTemplateType) => true
      : async (template: MailTemplateType) => {
          const value = await getMailSettings();
          return normalizeMailTemplateSettings(value)[template];
        });
  const resolveHrRecipients =
    options?.hrRecipientsResolver ??
    (client
      ? async () => []
      : async () => {
          const hrUsers = await prisma.user.findMany({
            where: {
              role: 'HR',
              isActive: true,
            },
            select: {
              email: true,
            },
          });

          return hrUsers.map((user) => user.email).filter(Boolean);
        });

  return {
    async sendMail(options: SendMailOptions, behavior?: MailTemplateBehavior): Promise<MailResult> {
      if (!transporter) {
        return { skipped: true, reason: 'mail_disabled' };
      }

      if (behavior && !behavior.skipSystemDisable) {
        const templateEnabled = await resolveTemplateEnabled(behavior.template);
        if (!templateEnabled) {
          return { skipped: true, reason: 'mail_template_disabled' };
        }
      }

      const primaryRecipients = new Set([
        ...normalizeAddressList(options.to),
        ...normalizeAddressList(options.cc),
      ]);
      const hrRecipients = (await resolveHrRecipients()).filter(
        (email) => email && !primaryRecipients.has(email),
      );

      const result = (await transporter.sendMail({
        from: {
          address: env.MAIL_FROM_EMAIL,
          name: env.MAIL_FROM_NAME,
        },
        ...(env.MAIL_REPLY_TO ? { replyTo: env.MAIL_REPLY_TO } : {}),
        ...options,
        ...(hrRecipients.length
          ? {
              cc: [...normalizeAddressList(options.cc), ...hrRecipients].join(', '),
            }
          : {}),
      })) as { messageId?: string | null };

      return { skipped: false, messageId: result.messageId ?? null };
    },
  };
}

export const mailService = createMailService();

function getDetailUrl(pathname: string, detailUrl?: string | null) {
  return detailUrl || `${env.FRONTEND_URL}${pathname}`;
}

export async function sendLeaveRequestCreatedEmail(
  service: ReturnType<typeof createMailService>,
  params: LeaveRequestCreatedEmailParams,
  behavior?: MailSendBehavior,
) {
  if (!params.approverEmail) {
    return { skipped: true, reason: 'missing_approver_email' } satisfies MailResult;
  }

  const rangeLabel = buildRangeLabel(params.fromDateLabel, params.toDateLabel);
  return service.sendMail(
    {
      to: params.approverEmail,
      subject: `[OTA HR] Có yêu cầu nghỉ phép mới cần phê duyệt`,
      html: buildMailShell({
        title: 'Yêu cầu nghỉ phép mới',
        intro: `${params.requesterName} vừa gửi đơn nghỉ phép và đang chờ phê duyệt.`,
        statusLabel: 'Chờ phê duyệt',
        statusTone: 'warning',
        sections: [
          { label: 'Người gửi', value: params.requesterName },
          { label: 'Người duyệt', value: params.approverName || 'Cập nhật sau' },
          { label: 'Loại nghỉ', value: params.leaveTypeName },
          { label: 'Thời gian', value: rangeLabel },
          { label: 'Số ngày', value: params.totalDaysLabel },
          { label: 'Lý do', value: params.reason },
        ],
        ctaLabel: 'Xem yêu cầu',
        ctaUrl: getDetailUrl('/dashboard/approval', params.detailUrl),
      }),
    },
    { template: 'leave_request_created', ...behavior },
  );
}

export async function sendLeaveRequestApprovedEmail(
  service: ReturnType<typeof createMailService>,
  params: LeaveRequestDecisionEmailParams,
  behavior?: MailSendBehavior,
) {
  if (!params.requesterEmail) {
    return { skipped: true, reason: 'missing_requester_email' } satisfies MailResult;
  }

  const rangeLabel = buildRangeLabel(params.fromDateLabel, params.toDateLabel);
  return service.sendMail(
    {
      to: params.requesterEmail,
      subject: `[OTA HR] Đơn nghỉ phép đã được duyệt`,
      html: buildMailShell({
        title: 'Đơn nghỉ phép đã duyệt',
        intro: `${params.approverName} đã duyệt đơn nghỉ phép của bạn.`,
        statusLabel: 'Đã duyệt',
        statusTone: 'success',
        sections: [
          { label: 'Nhân viên', value: params.requesterName },
          { label: 'Người duyệt', value: params.approverName },
          { label: 'Loại nghỉ', value: params.leaveTypeName },
          { label: 'Thời gian', value: rangeLabel },
          { label: 'Số ngày', value: params.totalDaysLabel },
        ],
        note: params.note,
        ctaLabel: 'Xem chi tiết',
        ctaUrl: getDetailUrl('/dashboard/leave-history', params.detailUrl),
      }),
    },
    { template: 'leave_request_approved', ...behavior },
  );
}

export async function sendLeaveRequestRejectedEmail(
  service: ReturnType<typeof createMailService>,
  params: LeaveRequestDecisionEmailParams,
  behavior?: MailSendBehavior,
) {
  if (!params.requesterEmail) {
    return { skipped: true, reason: 'missing_requester_email' } satisfies MailResult;
  }

  const rangeLabel = buildRangeLabel(params.fromDateLabel, params.toDateLabel);
  return service.sendMail(
    {
      to: params.requesterEmail,
      subject: `[OTA HR] Đơn nghỉ phép bị từ chối`,
      html: buildMailShell({
        title: 'Đơn nghỉ phép bị từ chối',
        intro: `${params.approverName} đã từ chối đơn nghỉ phép của bạn.`,
        statusLabel: 'Bị từ chối',
        statusTone: 'danger',
        sections: [
          { label: 'Nhân viên', value: params.requesterName },
          { label: 'Người xử lý', value: params.approverName },
          { label: 'Loại nghỉ', value: params.leaveTypeName },
          { label: 'Thời gian', value: rangeLabel },
          { label: 'Số ngày', value: params.totalDaysLabel },
        ],
        note: params.note,
        ctaLabel: 'Xem chi tiết',
        ctaUrl: getDetailUrl('/dashboard/leave-history', params.detailUrl),
      }),
    },
    { template: 'leave_request_rejected', ...behavior },
  );
}

export function renderMailTemplatePreview(template: MailTemplateType) {
  const sample = {
    requesterName: 'Nguyen Van A',
    approverName: 'Tran Thi B',
    leaveTypeName: 'Nghi phep nam',
    fromDateLabel: '25/03/2026 08:00',
    toDateLabel: '25/03/2026 17:15',
    totalDaysLabel: '1 ngay',
    note: 'Đây là bản xem trước template mail.',
    reason: 'Xem giao diện mail trước khi gửi thực tế.',
    detailUrl: `${env.FRONTEND_URL}/dashboard/settings`,
  };

  if (template === 'leave_request_created') {
    const rangeLabel = buildRangeLabel(sample.fromDateLabel, sample.toDateLabel);
    return buildMailShell({
      title: 'Yêu cầu nghỉ phép mới',
      intro: `${sample.requesterName} vừa gửi đơn nghỉ phép và đang chờ phê duyệt.`,
      statusLabel: 'Chờ phê duyệt',
      statusTone: 'warning',
      sections: [
        { label: 'Người gửi', value: sample.requesterName },
        { label: 'Người duyệt', value: sample.approverName },
        { label: 'Loại nghỉ', value: sample.leaveTypeName },
        { label: 'Thời gian', value: rangeLabel },
        { label: 'Số ngày', value: sample.totalDaysLabel },
        { label: 'Lý do', value: sample.reason },
      ],
      ctaLabel: 'Xem yêu cầu',
      ctaUrl: sample.detailUrl,
    });
  }

  if (template === 'leave_request_approved') {
    const rangeLabel = buildRangeLabel(sample.fromDateLabel, sample.toDateLabel);
    return buildMailShell({
      title: 'Đơn nghỉ phép đã duyệt',
      intro: `${sample.approverName} đã duyệt đơn nghỉ phép của bạn.`,
      statusLabel: 'Đã duyệt',
      statusTone: 'success',
      sections: [
        { label: 'Nhân viên', value: sample.requesterName },
        { label: 'Người duyệt', value: sample.approverName },
        { label: 'Loại nghỉ', value: sample.leaveTypeName },
        { label: 'Thời gian', value: rangeLabel },
        { label: 'Số ngày', value: sample.totalDaysLabel },
      ],
      note: sample.note,
      ctaLabel: 'Xem chi tiết',
      ctaUrl: sample.detailUrl,
    });
  }

  const rangeLabel = buildRangeLabel(sample.fromDateLabel, sample.toDateLabel);
  return buildMailShell({
    title: 'Đơn nghỉ phép bị từ chối',
    intro: `${sample.approverName} đã từ chối đơn nghỉ phép của bạn.`,
    statusLabel: 'Bị từ chối',
    statusTone: 'danger',
    sections: [
      { label: 'Nhân viên', value: sample.requesterName },
      { label: 'Người xử lý', value: sample.approverName },
      { label: 'Loại nghỉ', value: sample.leaveTypeName },
      { label: 'Thời gian', value: rangeLabel },
      { label: 'Số ngày', value: sample.totalDaysLabel },
    ],
    note: sample.note,
    ctaLabel: 'Xem chi tiết',
    ctaUrl: sample.detailUrl,
  });
}

export async function sendMailTemplateTest(
  service: ReturnType<typeof createMailService>,
  recipientEmail: string,
  template: MailTemplateType,
) {
  const sample = {
    requesterName: 'Nguyen Van A',
    approverName: 'Tran Thi B',
    leaveTypeName: 'Nghi phep nam',
    fromDateLabel: '25/03/2026 08:00',
    toDateLabel: '25/03/2026 17:15',
    totalDaysLabel: '1 ngay',
    note: 'Đây là email test từ trang Setting Mail.',
    reason: 'Gửi email mẫu để kiểm tra cấu hình SMTP.',
    detailUrl: `${env.FRONTEND_URL}/dashboard/settings`,
  };

  if (template === 'leave_request_created') {
    return sendLeaveRequestCreatedEmail(
      service,
      {
        approverEmail: recipientEmail,
        approverName: sample.approverName,
        requesterName: sample.requesterName,
        leaveTypeName: sample.leaveTypeName,
        fromDateLabel: sample.fromDateLabel,
        toDateLabel: sample.toDateLabel,
        totalDaysLabel: sample.totalDaysLabel,
        reason: sample.reason,
        detailUrl: sample.detailUrl,
      },
      { skipSystemDisable: true },
    );
  }

  if (template === 'leave_request_approved') {
    return sendLeaveRequestApprovedEmail(
      service,
      {
        requesterEmail: recipientEmail,
        requesterName: sample.requesterName,
        approverName: sample.approverName,
        leaveTypeName: sample.leaveTypeName,
        fromDateLabel: sample.fromDateLabel,
        toDateLabel: sample.toDateLabel,
        totalDaysLabel: sample.totalDaysLabel,
        note: sample.note,
        detailUrl: sample.detailUrl,
      },
      { skipSystemDisable: true },
    );
  }

  return sendLeaveRequestRejectedEmail(
    service,
    {
      requesterEmail: recipientEmail,
      requesterName: sample.requesterName,
      approverName: sample.approverName,
      leaveTypeName: sample.leaveTypeName,
      fromDateLabel: sample.fromDateLabel,
      toDateLabel: sample.toDateLabel,
      totalDaysLabel: sample.totalDaysLabel,
      note: sample.note,
      detailUrl: sample.detailUrl,
    },
    { skipSystemDisable: true },
  );
}

export type MailService = ReturnType<typeof createMailService>;
export type MailTransporter = Transporter;
