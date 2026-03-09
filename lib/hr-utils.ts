export type FrontendRole = 'employee' | 'manager' | 'hr' | 'admin';
export type LeaveRequestMode = 'FULL_DAY' | 'MORNING_HALF_DAY' | 'AFTERNOON_HALF_DAY' | 'HOURLY';

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

export const HOURLY_LEAVE_TIME_MIN = '08:00';
export const HOURLY_LEAVE_TIME_MAX = '17:15';
export const HOURLY_LEAVE_TIME_STEP_SECONDS = 15 * 60;

export const LEAVE_REQUEST_MODE_CONFIG: Record<
  LeaveRequestMode,
  {
    label: string;
    apiDurationMode: 'FULL_DAY' | 'HALF_DAY' | 'HOURLY';
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
  MORNING_HALF_DAY: {
    label: 'Nghỉ buổi sáng',
    apiDurationMode: 'HALF_DAY',
    defaultFromTime: '08:00',
    defaultToTime: '11:45',
  },
  AFTERNOON_HALF_DAY: {
    label: 'Nghỉ buổi chiều',
    apiDurationMode: 'HALF_DAY',
    defaultFromTime: '13:00',
    defaultToTime: '17:15',
  },
  HOURLY: {
    label: 'Theo giờ',
    apiDurationMode: 'HOURLY',
    defaultFromTime: HOURLY_LEAVE_TIME_MIN,
    defaultToTime: HOURLY_LEAVE_TIME_MAX,
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

export function getLeaveRequestTimeRange(
  mode: LeaveRequestMode,
  startTime?: string,
  endTime?: string,
) {
  const config = LEAVE_REQUEST_MODE_CONFIG[mode];

  if (mode === 'HOURLY') {
    return {
      fromTime: startTime || config.defaultFromTime,
      toTime: endTime || config.defaultToTime,
    };
  }

  return {
    fromTime: config.defaultFromTime,
    toTime: config.defaultToTime,
  };
}

export function getLeaveRequestApiPayload(params: {
  date: string;
  endDate?: string;
  mode: LeaveRequestMode;
  startTime?: string;
  endTime?: string;
}) {
  const { fromTime, toTime } = getLeaveRequestTimeRange(
    params.mode,
    params.startTime,
    params.endTime,
  );
  const toDate = params.mode === 'HOURLY' ? params.date : params.endDate || params.date;

  return {
    durationMode: LEAVE_REQUEST_MODE_CONFIG[params.mode].apiDurationMode,
    fromDate: buildApiDateTime(params.date, fromTime),
    toDate: buildApiDateTime(toDate, toTime),
    fromTime,
    toTime,
  };
}

export function getTimeInputValue(value?: string | Date | null) {
  const formatted = formatApiDateTime(value);
  return formatted ? formatted.slice(11, 16) : '';
}

export function inferLeaveRequestModeFromRange(
  fromDate?: string | Date | null,
  toDate?: string | Date | null,
  reason?: string | null,
) {
  if (reason?.includes('Hình thức nghỉ: Nghỉ buổi sáng')) {
    return 'MORNING_HALF_DAY' satisfies LeaveRequestMode;
  }
  if (reason?.includes('Hình thức nghỉ: Nghỉ buổi chiều')) {
    return 'AFTERNOON_HALF_DAY' satisfies LeaveRequestMode;
  }
  if (reason?.includes('Hình thức nghỉ: Theo giờ') || reason?.includes('Khung giờ:')) {
    return 'HOURLY' satisfies LeaveRequestMode;
  }

  const fromTime = getTimeInputValue(fromDate);
  const toTime = getTimeInputValue(toDate);

  if (!fromTime || !toTime) return 'FULL_DAY' satisfies LeaveRequestMode;
  if (fromTime === '08:00' && toTime === '11:45')
    return 'MORNING_HALF_DAY' satisfies LeaveRequestMode;
  if (fromTime === '13:00' && toTime === '17:15') {
    return 'AFTERNOON_HALF_DAY' satisfies LeaveRequestMode;
  }
  if (fromTime !== '08:00' || toTime !== '17:15') return 'HOURLY' satisfies LeaveRequestMode;
  return 'FULL_DAY' satisfies LeaveRequestMode;
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

export function buildLeavePolicyHints(
  leavePolicy?: LeavePolicyConfig | null,
  approvalFlow?: ApprovalFlowConfig | null,
) {
  const hints: string[] = [];

  if (typeof leavePolicy?.advanceRequestDays === 'number') {
    hints.push(`Gửi trước ít nhất ${leavePolicy.advanceRequestDays} ngày.`);
  }

  if (typeof leavePolicy?.maxConsecutiveDays === 'number') {
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

  if (typeof leavePolicy?.advanceRequestDays === 'number') {
    const earliestAllowedDate = addDaysToDateInput(
      getVietnamTodayDateInput(),
      leavePolicy.advanceRequestDays,
    );

    if (earliestAllowedDate && fromDate < earliestAllowedDate) {
      return `Đơn nghỉ phải được gửi trước ít nhất ${leavePolicy.advanceRequestDays} ngày.`;
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
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}) {
  return (
    user.fullName ??
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ??
    user.username ??
    'Người dùng'
  );
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
