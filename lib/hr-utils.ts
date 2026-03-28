export type FrontendRole = 'employee' | 'manager' | 'hr' | 'admin';
export type LeaveRequestMode = 'FULL_DAY' | 'HALF_DAY_AM' | 'HALF_DAY_PM';

export type LeavePolicyConfig = {
  advanceRequestDays?: number;
  maxConsecutiveDays?: number;
};

export type ApprovalFlowConfig = {
  autoApproveWFH?: boolean;
  requireDocumentTypes?: string[];
};

const API_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const VN_OFFSET_MINUTES = 7 * 60;

export const LEAVE_REQUEST_MODE_CONFIG: Record<
  LeaveRequestMode,
  {
    label: string;
    apiDurationMode: 'FULL_DAY' | 'HALF_DAY_AM' | 'HALF_DAY_PM';
    defaultFromTime: string;
    defaultToTime: string;
  }
> = {
  FULL_DAY: {
    label: 'Cả ngày',
    apiDurationMode: 'FULL_DAY',
    defaultFromTime: '08:00',
    defaultToTime: '17:15',
  },
  HALF_DAY_AM: {
    label: 'Nghỉ buổi sáng',
    apiDurationMode: 'HALF_DAY_AM',
    defaultFromTime: '08:00',
    defaultToTime: '11:45',
  },
  HALF_DAY_PM: {
    label: 'Nghỉ buổi chiều',
    apiDurationMode: 'HALF_DAY_PM',
    defaultFromTime: '13:00',
    defaultToTime: '17:15',
  },
};

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function parseDateOnlyParts(value: string) {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return { year, month, day };
}

function toUtcDateFromVietnamParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0, 0));
}

function toVietnamDateParts(date: Date) {
  const vietnamTime = new Date(date.getTime() + VN_OFFSET_MINUTES * 60 * 1000);
  return {
    year: vietnamTime.getUTCFullYear(),
    month: vietnamTime.getUTCMonth() + 1,
    day: vietnamTime.getUTCDate(),
    hour: vietnamTime.getUTCHours(),
    minute: vietnamTime.getUTCMinutes(),
  };
}

export function toFrontendRole(role?: string | null): FrontendRole {
  switch ((role ?? '').toUpperCase()) {
    case 'MANAGER':
      return 'manager';
    case 'HR':
      return 'hr';
    case 'ADMIN':
      return 'admin';
    default:
      return 'employee';
  }
}

export function toBackendRole(role?: string | null): string {
  return (role ?? '').toUpperCase();
}

export function getRoleLabel(role?: string | null) {
  switch (toBackendRole(role)) {
    case 'MANAGER':
      return 'Quản lý';
    case 'HR':
      return 'HR';
    case 'ADMIN':
      return 'Admin';
    default:
      return 'Nhân viên';
  }
}

export function getStatusLabel(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'PENDING':
      return 'pending';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'draft';
  }
}

export function parseApiDateTime(value?: string | Date | null) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  const customMatch = API_DATE_TIME_PATTERN.exec(trimmed);
  if (customMatch) {
    return toUtcDateFromVietnamParts(
      Number(customMatch[1]),
      Number(customMatch[2]),
      Number(customMatch[3]),
      Number(customMatch[4]),
      Number(customMatch[5]),
    );
  }

  const dateOnlyParts = parseDateOnlyParts(trimmed);
  if (dateOnlyParts) {
    return toUtcDateFromVietnamParts(
      dateOnlyParts.year,
      dateOnlyParts.month,
      dateOnlyParts.day,
      0,
      0,
    );
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatApiDateTime(value?: string | Date | null) {
  const date = parseApiDateTime(value);
  if (!date) return '';

  const parts = toVietnamDateParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function toDateInputValue(value?: string | Date | null) {
  if (!value) return '';

  if (typeof value === 'string') {
    const dateOnlyParts = parseDateOnlyParts(value.trim());
    if (dateOnlyParts) {
      return `${dateOnlyParts.year}-${pad2(dateOnlyParts.month)}-${pad2(dateOnlyParts.day)}`;
    }

    const customMatch = API_DATE_TIME_PATTERN.exec(value.trim());
    if (customMatch) {
      return `${customMatch[1]}-${customMatch[2]}-${customMatch[3]}`;
    }
  }

  return formatApiDateTime(value).slice(0, 10);
}

export function buildApiDateTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return '';
  return `${dateValue} ${timeValue}`;
}

export function toIsoDateTime(value: string, endOfDay = false) {
  if (!value) return '';
  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  return new Date(`${value}${suffix}`).toISOString();
}

export function getLeaveRequestTimeRange(mode: LeaveRequestMode) {
  const config = LEAVE_REQUEST_MODE_CONFIG[mode];
  return {
    fromTime: config.defaultFromTime,
    toTime: config.defaultToTime,
  };
}

export function getLeaveRequestApiPayload(params: {
  date: string;
  endDate?: string;
  mode: LeaveRequestMode;
}) {
  const { fromTime, toTime } = getLeaveRequestTimeRange(params.mode);
  const toDate = params.endDate || params.date;

  return {
    durationMode: LEAVE_REQUEST_MODE_CONFIG[params.mode].apiDurationMode,
    fromDate: buildApiDateTime(params.date, fromTime),
    toDate: buildApiDateTime(toDate, toTime),
  };
}

export function getTimeInputValue(value?: string | Date | null) {
  const formatted = formatApiDateTime(value);
  return formatted ? formatted.slice(11, 16) : '';
}

export function inferLeaveRequestModeFromDbValue(
  durationMode?: string | null,
): LeaveRequestMode {
  if (durationMode === 'HALF_DAY_AM') return 'HALF_DAY_AM';
  if (durationMode === 'HALF_DAY_PM') return 'HALF_DAY_PM';
  return 'FULL_DAY';
}

export function getLeaveRequestReasonInput(reason?: string | null) {
  if (!reason) return '';

  return reason
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed !== '' &&
        !trimmed.startsWith('Hình thức nghỉ:') &&
        !trimmed.startsWith('Khung giờ:')
      );
    })
    .join('\n')
    .trim();
}

export function getVietnamTodayDateInput() {
  return formatApiDateTime(new Date()).slice(0, 10);
}

export function addDaysToDateInput(value: string, days: number) {
  const date = parseApiDateTime(value);
  if (!date) return '';

  const nextDate = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return toDateInputValue(nextDate);
}

export function shouldEnforceAdvanceRequestDays(
  fromDate: string,
  advanceRequestDays?: number | null,
) {
  if (!fromDate || typeof advanceRequestDays !== 'number' || advanceRequestDays <= 0) {
    return false;
  }

  const today = getVietnamTodayDateInput();
  return fromDate > today;
}

export function buildLeavePolicyHints(
  leavePolicy?: LeavePolicyConfig | null,
  approvalFlow?: ApprovalFlowConfig | null,
) {
  const hints: string[] = [];

  if (typeof leavePolicy?.advanceRequestDays === 'number' && leavePolicy.advanceRequestDays > 0) {
    hints.push(
      `Ngày tương lai phải gửi trước ít nhất ${leavePolicy.advanceRequestDays} ngày. Đơn bổ sung cho ngày đã qua vẫn được phép tạo.`,
    );
  }

  if (typeof leavePolicy?.maxConsecutiveDays === 'number' && leavePolicy.maxConsecutiveDays > 0) {
    hints.push(`Tối đa ${leavePolicy.maxConsecutiveDays} ngày nghỉ liên tiếp mỗi đơn.`);
  }

  // if ((approvalFlow?.requireDocumentTypes ?? []).length > 0) {
  //   hints.push(
  //     `Bắt buộc đính kèm file với: ${(approvalFlow?.requireDocumentTypes ?? []).join(', ')}.`,
  //   );
  // }

  if (approvalFlow?.autoApproveWFH) {
    hints.push('WFH có thể được duyệt tự động theo cấu hình hiện tại.');
  }

  return hints;
}

export function getLeaveRequestPolicyValidation(params: {
  fromDate: string;
  toDate: string;
  days: number;
  leaveTypeCode?: string;
  hasAttachment: boolean;
  leavePolicy?: LeavePolicyConfig | null;
  approvalFlow?: ApprovalFlowConfig | null;
}) {
  const { fromDate, toDate, days, leaveTypeCode, hasAttachment, leavePolicy, approvalFlow } =
    params;

  if (!fromDate || !toDate || days <= 0) return null;

  if (shouldEnforceAdvanceRequestDays(fromDate, leavePolicy?.advanceRequestDays)) {
    const earliestAllowedDate = addDaysToDateInput(
      getVietnamTodayDateInput(),
      leavePolicy?.advanceRequestDays ?? 0,
    );

    if (earliestAllowedDate && fromDate < earliestAllowedDate) {
      return `Đơn nghỉ cho ngày tương lai phải được gửi trước ít nhất ${leavePolicy?.advanceRequestDays} ngày.`;
    }
  }

  if (
    typeof leavePolicy?.maxConsecutiveDays === 'number' &&
    countCalendarDays(fromDate, toDate) > leavePolicy.maxConsecutiveDays
  ) {
    return `Số ngày nghỉ liên tiếp vượt giới hạn ${leavePolicy.maxConsecutiveDays} ngày.`;
  }

  // if (
  //   leaveTypeCode &&
  //   (approvalFlow?.requireDocumentTypes ?? []).includes(leaveTypeCode) &&
  //   !hasAttachment
  // ) {
  //   return `Loại nghỉ ${leaveTypeCode} bắt buộc đính kèm hồ sơ/giấy tờ.`;
  // }

  return null;
}

export function countCalendarDays(fromDate: string, toDate: string): number {
  const startParts = parseDateOnlyParts(fromDate);
  const endParts = parseDateOnlyParts(toDate);
  if (!startParts || !endParts) return 0;

  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  if (endUtc < startUtc) return 0;

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endUtc - startUtc) / millisecondsPerDay) + 1;
}

export function getDateTimeValue(value?: string | Date | null) {
  return parseApiDateTime(value)?.getTime() ?? Number.NaN;
}

// Format date as DD/MM/YYYY (no time). Accepts ISO string, YYYY-MM-DD, or Date.
export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  // Fast path: date-only string YYYY-MM-DD
  if (typeof value === 'string') {
    const m = DATE_ONLY_PATTERN.exec(value.trim());
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const date = parseApiDateTime(value);
  if (!date) return '—';
  const parts = toVietnamDateParts(date);
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

export function formatDateVN(value?: string | Date | null) {
  const date = parseApiDateTime(value);
  if (!date) return '-';
  const parts = toVietnamDateParts(date);
  return `${pad2(parts.hour)}:${pad2(parts.minute)} ${parts.day}/${parts.month}/${parts.year}`;
}

export function formatDateTimeVN(value?: string | Date | null) {
  return formatDateVN(value);
}

export function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number(String(value));
  }
  return 0;
}

export function getFullName(user: {
  fullName?: string | null;
  username?: string | null;
}) {
  return user.fullName?.trim() || user.username || 'Người dùng';
}

export function buildQuery(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString();
}
