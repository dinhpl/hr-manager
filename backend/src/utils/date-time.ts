const API_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const VN_OFFSET_HOURS = 7;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

export function parseVietnamDateTime(value: string) {
  const match = API_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) {
    throw Object.assign(new Error('Invalid datetime format. Expected YYYY-MM-DD HH:mm'), {
      status: 400,
    });
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  return new Date(Date.UTC(year, month - 1, day, hour - VN_OFFSET_HOURS, minute, 0, 0));
}

export function formatVietnamDateTime(value: Date | string | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const vietnamTime = new Date(date.getTime() + VN_OFFSET_HOURS * 60 * 60 * 1000);
  return `${vietnamTime.getUTCFullYear()}-${pad2(vietnamTime.getUTCMonth() + 1)}-${pad2(
    vietnamTime.getUTCDate(),
  )} ${pad2(vietnamTime.getUTCHours())}:${pad2(vietnamTime.getUTCMinutes())}`;
}

export function getVietnamDatePart(value: Date | string) {
  const formatted = formatVietnamDateTime(value);
  if (!formatted) {
    throw Object.assign(new Error('Invalid leave request dates'), { status: 400 });
  }

  return formatted.slice(0, 10);
}

export function countInclusiveVietnamDates(startValue: Date | string, endValue: Date | string) {
  const startDate = `${getVietnamDatePart(startValue)}T00:00:00.000Z`;
  const endDate = `${getVietnamDatePart(endValue)}T00:00:00.000Z`;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw Object.assign(new Error('toDate must be greater than or equal to fromDate'), {
      status: 400,
    });
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}

type SerializableLeaveRequest = {
  fromDate: Date | string;
  toDate: Date | string;
  createdAt?: Date | string | null;
  approvedAt?: Date | string | null;
};

export function serializeLeaveRequestDates<T extends SerializableLeaveRequest>(request: T) {
  return {
    ...request,
    fromDate: formatVietnamDateTime(request.fromDate),
    toDate: formatVietnamDateTime(request.toDate),
    createdAt: request.createdAt ? formatVietnamDateTime(request.createdAt) : request.createdAt,
    approvedAt: request.approvedAt ? formatVietnamDateTime(request.approvedAt) : request.approvedAt,
  };
}
