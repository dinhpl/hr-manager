import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { env } from '../../config/env';

type MailClient = {
  sendMail: (mail: SendMailOptions) => Promise<unknown>;
};

type MailResult = { skipped: true; reason: string } | { skipped: false; messageId?: string | null };

type LeaveRequestCreatedEmailParams = {
  approverEmail?: string | null;
  approverName?: string | null;
  requesterName: string;
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
  leaveTypeName: string;
  fromDateLabel: string;
  toDateLabel: string;
  totalDaysLabel: string;
  note?: string | null;
  detailUrl?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMailShell(params: {
  eyebrow: string;
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
    warning: { bg: '#FFF7E8', fg: '#9A6700', border: '#F3D08B' },
    success: { bg: '#ECFDF3', fg: '#027A48', border: '#ABEFC6' },
    danger: { bg: '#FEF3F2', fg: '#B42318', border: '#FECDCA' },
  } as const;

  const tone = toneMap[params.statusTone];
  const sectionsHtml = params.sections
    .map(
      (section) => `
        <tr>
          <td style="padding: 0 0 14px; vertical-align: top;">
            <div style="font-size: 12px; color: #667085; margin-bottom: 4px;">${escapeHtml(section.label)}</div>
            <div style="font-size: 15px; line-height: 22px; color: #101828; font-weight: 600;">${escapeHtml(section.value)}</div>
          </td>
        </tr>`,
    )
    .join('');

  const noteHtml = params.note
    ? `
      <div style="margin-top: 20px; padding: 16px 18px; border-radius: 14px; background: #F8FAFC; border: 1px solid #E2E8F0;">
        <div style="font-size: 12px; color: #475467; margin-bottom: 6px;">Ghi chu</div>
        <div style="font-size: 14px; line-height: 22px; color: #0F172A;">${escapeHtml(params.note)}</div>
      </div>`
    : '';

  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `
        <div style="margin-top: 28px;">
          <a href="${escapeHtml(params.ctaUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #111827; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600;">
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
      <body style="margin: 0; padding: 24px; background: #F4F7FB; font-family: Arial, Helvetica, sans-serif; color: #101828;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; margin: 0 auto;">
          <tr>
            <td>
              <div style="padding: 28px; border-radius: 24px; background: linear-gradient(135deg, #0F172A 0%, #1D4ED8 100%); color: #FFFFFF;">
                <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.8;">${escapeHtml(params.eyebrow)}</div>
                <div style="margin-top: 10px; font-size: 28px; line-height: 34px; font-weight: 700;">${escapeHtml(params.title)}</div>
                <div style="margin-top: 12px; font-size: 15px; line-height: 24px; max-width: 520px; color: rgba(255, 255, 255, 0.88);">
                  ${escapeHtml(params.intro)}
                </div>
              </div>

              <div style="margin-top: 18px; padding: 28px; border-radius: 24px; background: #FFFFFF; border: 1px solid #E4E7EC; box-shadow: 0 16px 50px rgba(15, 23, 42, 0.08);">
                <div style="display: inline-block; padding: 8px 12px; border-radius: 999px; background: ${tone.bg}; border: 1px solid ${tone.border}; color: ${tone.fg}; font-size: 12px; font-weight: 700; letter-spacing: 0.02em;">
                  ${escapeHtml(params.statusLabel)}
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                  ${sectionsHtml}
                </table>

                ${noteHtml}
                ${ctaHtml}
              </div>

              <div style="margin-top: 18px; text-align: center; font-size: 12px; line-height: 20px; color: #667085;">
                Email duoc gui tu he thong OTA HR. Vui long khong tra loi truc tiep email nay.
              </div>
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

export function createMailService(client?: MailClient) {
  const transporter = client ?? createTransporter();

  return {
    async sendMail(options: SendMailOptions): Promise<MailResult> {
      if (!transporter) {
        return { skipped: true, reason: 'mail_disabled' };
      }

      const result = (await transporter.sendMail({
        from: {
          address: env.MAIL_FROM_EMAIL,
          name: env.MAIL_FROM_NAME,
        },
        ...(env.MAIL_REPLY_TO ? { replyTo: env.MAIL_REPLY_TO } : {}),
        ...options,
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
) {
  if (!params.approverEmail) {
    return { skipped: true, reason: 'missing_approver_email' } satisfies MailResult;
  }

  const rangeLabel = buildRangeLabel(params.fromDateLabel, params.toDateLabel);
  return service.sendMail({
    to: params.approverEmail,
    subject: `[OTA HR] Co yeu cau nghi phep moi can phe duyet`,
    html: buildMailShell({
      eyebrow: 'Leave Request',
      title: 'Co yeu cau nghi phep moi',
      intro: `${params.requesterName} vua gui mot don nghi phep moi va dang cho phe duyet.`,
      statusLabel: 'Cho phe duyet',
      statusTone: 'warning',
      sections: [
        { label: 'Nguoi gui don', value: params.requesterName },
        { label: 'Nguoi phe duyet', value: params.approverName || 'Cap nhat sau' },
        { label: 'Loai nghi', value: params.leaveTypeName },
        { label: 'Thoi gian', value: rangeLabel },
        { label: 'Tong so ngay', value: params.totalDaysLabel },
        { label: 'Ly do', value: params.reason },
      ],
      ctaLabel: 'Mo yeu cau nghi phep',
      ctaUrl: getDetailUrl('/dashboard/approval', params.detailUrl),
    }),
  });
}

export async function sendLeaveRequestApprovedEmail(
  service: ReturnType<typeof createMailService>,
  params: LeaveRequestDecisionEmailParams,
) {
  if (!params.requesterEmail) {
    return { skipped: true, reason: 'missing_requester_email' } satisfies MailResult;
  }

  const rangeLabel = buildRangeLabel(params.fromDateLabel, params.toDateLabel);
  return service.sendMail({
    to: params.requesterEmail,
    subject: `[OTA HR] Don nghi phep da duoc duyet`,
    html: buildMailShell({
      eyebrow: 'Leave Approval',
      title: 'Don nghi phep da duoc duyet',
      intro: `${params.approverName} da phe duyet don nghi phep cua ban.`,
      statusLabel: 'Da duyet',
      statusTone: 'success',
      sections: [
        { label: 'Nhan vien', value: params.requesterName },
        { label: 'Nguoi phe duyet', value: params.approverName },
        { label: 'Loai nghi', value: params.leaveTypeName },
        { label: 'Thoi gian', value: rangeLabel },
        { label: 'Tong so ngay', value: params.totalDaysLabel },
      ],
      note: params.note,
      ctaLabel: 'Xem lich su nghi phep',
      ctaUrl: getDetailUrl('/dashboard/leave-history', params.detailUrl),
    }),
  });
}

export async function sendLeaveRequestRejectedEmail(
  service: ReturnType<typeof createMailService>,
  params: LeaveRequestDecisionEmailParams,
) {
  if (!params.requesterEmail) {
    return { skipped: true, reason: 'missing_requester_email' } satisfies MailResult;
  }

  const rangeLabel = buildRangeLabel(params.fromDateLabel, params.toDateLabel);
  return service.sendMail({
    to: params.requesterEmail,
    subject: `[OTA HR] Don nghi phep bi tu choi`,
    html: buildMailShell({
      eyebrow: 'Leave Rejection',
      title: 'Don nghi phep bi tu choi',
      intro: `${params.approverName} da tu choi don nghi phep cua ban. Vui long xem ghi chu va cap nhat lai neu can.`,
      statusLabel: 'Bi tu choi',
      statusTone: 'danger',
      sections: [
        { label: 'Nhan vien', value: params.requesterName },
        { label: 'Nguoi xu ly', value: params.approverName },
        { label: 'Loai nghi', value: params.leaveTypeName },
        { label: 'Thoi gian', value: rangeLabel },
        { label: 'Tong so ngay', value: params.totalDaysLabel },
      ],
      note: params.note,
      ctaLabel: 'Xem lai don nghi phep',
      ctaUrl: getDetailUrl('/dashboard/leave-history', params.detailUrl),
    }),
  });
}

export type MailService = ReturnType<typeof createMailService>;
export type MailTransporter = Transporter;
