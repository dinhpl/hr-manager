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

function getBrandLogoUrl() {
  return 'https://hr.onetech.vn/assets/logo_1.png';
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
  const toneMap = {
    warning: {
      pillBg: '#FFF3DB',
      pillFg: '#B54708',
      pillBorder: '#F7D9A3',
    },
    success: {
      pillBg: '#E8F7F0',
      pillFg: '#0E7A58',
      pillBorder: '#BDE3D1',
    },
    danger: {
      pillBg: '#FEF2F2',
      pillFg: '#B42318',
      pillBorder: '#FECDCA',
    },
  } as const;

  const tone = toneMap[params.statusTone];
  const sectionsHtml = params.sections
    .map(
      (section, index, array) => `
        <tr>
          <td style="padding: 9px 0; vertical-align: top; ${index < array.length - 1 ? 'border-bottom: 1px dashed #E2EDE9;' : ''}">
            <div style="font-size: 11px; line-height: 16px; color: #6B7F78; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px;">
              ${escapeHtml(section.label)}
            </div>
            <div style="font-size: 14px; line-height: 22px; color: #203430; font-weight: 600;">
              ${escapeHtml(section.value)}
            </div>
          </td>
        </tr>`,
    )
    .join('');

  const noteHtml = params.note
    ? `
      <div style="margin-top: 14px; padding: 14px 16px; border-radius: 14px; background: #F8FBFA; border: 1px solid #E2EDE9;">
        <div style="font-size: 11px; line-height: 16px; color: #6B7F78; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px;">
          Ghi chú
        </div>
        <div style="font-size: 13px; line-height: 21px; color: #203430;">
          ${escapeHtml(params.note)}
        </div>
      </div>`
    : '';

  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `
        <div style="margin-top: 18px; text-align: center;">
          <a href="${escapeHtml(params.ctaUrl)}" style="display: inline-block; min-width: 200px; padding: 12px 20px; border-radius: 12px; background: linear-gradient(135deg, #1DB87A 0%, #0E474E 100%); color: #FFFFFF; text-decoration: none; font-size: 13px; line-height: 18px; font-weight: 700; box-shadow: 0 8px 18px rgba(14, 71, 78, 0.18);">
            ${escapeHtml(params.ctaLabel)}
          </a>
        </div>`
      : '';

  return `
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(params.title)}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #F7F7F7; font-family: Arial, Helvetica, sans-serif; color: #203430;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #F7F7F7;">
          <tr>
            <td style="padding: 32px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2EDE9; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(32, 52, 48, 0.08);">
                <tr>
                  <td style="padding: 0;">
                    <div style="padding: 12px 22px; background: #FFFFFF; border-bottom: 1px solid #E2EDE9;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width: 48px; vertical-align: middle;">
                            <img
                              src="${escapeHtml(getBrandLogoUrl())}"
                              alt="Leave Management HR Workspace"
                              width="48"
                              height="48"
                              style="display: block; width: 48px; height: 48px; object-fit: contain;"
                            />
                          </td>
                          <td style="padding-left: 8px; vertical-align: middle;">
                            <div style="font-size: 18px; line-height: 22px; font-weight: 700; color: #203430;">
                              Leave Management
                            </div>
                            <div style="margin-top: 3px; font-size: 10px; line-height: 14px; letter-spacing: 0.18em; text-transform: uppercase; color: #6B7F78;">
                              HR WORKSPACE
                            </div>
                          </td>
                          <td style="width: 1%; white-space: nowrap; text-align: right; vertical-align: middle;">
                            <div style="display: inline-block; padding: 7px 12px; border-radius: 999px; background: ${tone.pillBg}; border: 1px solid ${tone.pillBorder}; color: ${tone.pillFg}; font-size: 12px; line-height: 18px; font-weight: 700;">
                              ${escapeHtml(params.statusLabel)}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <div style="padding: 20px 22px 8px; background: #FFFFFF;">
                      <div style="font-size: 24px; line-height: 30px; font-weight: 700; color: #203430;">
                        ${escapeHtml(params.title)}
                      </div>

                      <div style="margin-top: 8px; font-size: 14px; line-height: 22px; color: #6B7F78;">
                        ${escapeHtml(params.intro)}
                      </div>

                    </div>

                    <div style="padding: 8px 22px 20px;">
                      <div style="background: #F9FBFA; border: 1px solid #E2EDE9; border-radius: 18px; padding: 16px 16px 6px;">
                        <div style="font-size: 15px; line-height: 22px; font-weight: 700; color: #203430; margin-bottom: 2px;">
                          Thông tin chi tiết
                        </div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          ${sectionsHtml}
                        </table>
                      </div>

                      ${noteHtml}
                      ${ctaHtml}

                      <div style="margin-top: 16px; text-align: center; font-size: 11px; line-height: 18px; color: #6B7F78;">
                        Email được gửi từ hệ thống OTA HR. Vui lòng không trả lời trực tiếp email này.
                      </div>
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
          ...(params.handoverName
            ? [{ label: 'Bàn giao/hỗ trợ', value: params.handoverName }]
            : []),
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
          ...(params.handoverName
            ? [{ label: 'Bàn giao/hỗ trợ', value: params.handoverName }]
            : []),
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
          ...(params.handoverName
            ? [{ label: 'Bàn giao/hỗ trợ', value: params.handoverName }]
            : []),
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
    handoverName: 'Le Thi C',
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
        { label: 'Bàn giao/hỗ trợ', value: sample.handoverName },
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
        { label: 'Bàn giao/hỗ trợ', value: sample.handoverName },
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
      { label: 'Bàn giao/hỗ trợ', value: sample.handoverName },
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
    handoverName: 'Le Thi C',
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
        handoverName: sample.handoverName,
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
        handoverName: sample.handoverName,
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
      handoverName: sample.handoverName,
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
