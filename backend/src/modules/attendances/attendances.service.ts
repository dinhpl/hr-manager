import prisma from '../../config/prisma';
import { buildMeta, getPaginationParams } from '../../utils/pagination';
import {
  GetMonthlyAttendancesQuery,
  UpdateAttendanceDto,
  type AttendanceStatusValue,
} from './attendances.validation';
import * as XLSX from 'xlsx';
import { getHolidayMapForMonth } from '../holidays/holidays.service';

const USER_ATTENDANCE_SELECT = {
  id: true,
  username: true,
  employeeCode: true,
  fullName: true,
  firstName: true,
  lastName: true,
  department: true,
  position: true,
  avatar: true,
  isCountable: true,
  isAttendance: true,
} as const;

const REQUIRED_HEADERS = [
  'Mã nhân viên',
  'Tên nhân viên',
  'Ngày',
  'Giờ vào',
  'Giờ ra',
  'Trễ',
  'Sớm',
  'Công',
  'Tổng giờ',
  'Tăng ca',
  'Tổng toàn bộ',
  'Ca',
] as const;

type ImportRow = {
  rowNumber: number;
  employeeCode: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  workUnit: number;
  workHours: number;
  overtimeHours: number;
  totalHours: number;
  shiftCode: string;
  department: string | null;
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parseDateValue(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`;
}

function parseTimeValue(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return `${pad2(hours)}:${pad2(minutes)}`;
}

function toUtcDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function toUtcDateTime(dateValue: string, timeValue: string | null) {
  if (!timeValue) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours - 7, minutes, 0, 0));
}

function timeValueToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function deriveStatus(row: ImportRow): AttendanceStatusValue {
  if (row.lateMinutes > 0) return 'late';
  if (row.checkIn || row.workHours > 0) return 'present';
  if (!row.checkIn && !row.checkOut && row.workHours === 0 && row.shiftCode.toUpperCase() === 'V') {
    return 'absent';
  }

  return 'absent';
}

function buildAttendanceNote(row: ImportRow) {
  return [
    `Ca=${row.shiftCode || '-'}`,
    `Trễ=${row.lateMinutes}`,
    `Sớm=${row.earlyMinutes}`,
    `Công=${row.workUnit}`,
    `Tăng ca=${row.overtimeHours}`,
    `Tổng toàn bộ=${row.totalHours}`,
    ...(row.department ? [`Phòng ban file=${row.department}`] : []),
  ].join('; ');
}

function buildDayColumns(year: number, month: number) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index + 1, 0, 0, 0, 0));
    return {
      date: toIsoDate(date),
      day: index + 1,
      weekday: date.getUTCDay(),
      isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
    };
  });
}

function buildDayColumnsWithHoliday(
  year: number,
  month: number,
  holidayMap: Record<string, { id: string; name: string }[]>,
) {
  return buildDayColumns(year, month).map((day) => ({
    ...day,
    isHoliday: Boolean(holidayMap[day.date]?.length),
    holidayNames: holidayMap[day.date]?.map((holiday) => holiday.name) ?? [],
  }));
}

function buildUserSearchWhere(search?: string) {
  if (!search) return {};

  return {
    OR: [
      { fullName: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
      { username: { contains: search, mode: 'insensitive' as const } },
      { employeeCode: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

async function getPagedUsers(query: GetMonthlyAttendancesQuery) {
  const baseWhere = {
    isActive: true,
    isAttendance: true,
    ...buildUserSearchWhere(query.search),
  };

  if (!query.statuses?.length) {
    const { page, limit, skip } = getPaginationParams(query);
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: baseWhere,
        select: USER_ATTENDANCE_SELECT,
        orderBy: { fullName: 'asc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: baseWhere }),
    ]);

    return { users, total, page, limit };
  }

  const { start, end } = monthBounds(query.year, query.month);
  const matchedAttendances = await prisma.attendance.findMany({
    where: {
      date: { gte: start, lt: end },
      status: { in: query.statuses },
      user: baseWhere,
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  const matchedIds = matchedAttendances.map((item) => item.userId);
  const allUsers = matchedIds.length
    ? await prisma.user.findMany({
        where: { id: { in: matchedIds } },
        select: USER_ATTENDANCE_SELECT,
        orderBy: { fullName: 'asc' },
      })
    : [];

  const { page, limit } = getPaginationParams(query);
  const pagedUsers = allUsers.slice((page - 1) * limit, (page - 1) * limit + limit);
  return { users: pagedUsers, total: allUsers.length, page, limit };
}

export async function getAvailableMonths() {
  const result = await prisma.$queryRaw<Array<{ year: number; month: number }>>`
    SELECT DISTINCT 
      EXTRACT(YEAR FROM date)::int AS year,
      EXTRACT(MONTH FROM date)::int AS month
    FROM attendances
    ORDER BY year DESC, month DESC
  `;

  return result.map((item) => ({
    year: item.year,
    month: item.month,
    value: `${item.year}-${String(item.month).padStart(2, '0')}`,
    label: `Tháng ${item.month}/${item.year}`,
  }));
}

export async function getMonthlyAttendances(query: GetMonthlyAttendancesQuery) {
  const { users, total, page, limit } = await getPagedUsers(query);
  const { start, end } = monthBounds(query.year, query.month);
  const userIds = users.map((user) => user.id);

  const [attendances, holidayMap] = await Promise.all([
    userIds.length
      ? prisma.attendance.findMany({
          where: {
            userId: { in: userIds },
            date: { gte: start, lt: end },
            ...(query.statuses?.length ? { status: { in: query.statuses } } : {}),
          },
          orderBy: [{ userId: 'asc' }, { date: 'asc' }],
        })
      : Promise.resolve([]),
    getHolidayMapForMonth(query.year, query.month),
  ]);

  const days = buildDayColumnsWithHoliday(query.year, query.month, holidayMap);

  const recordsByUser = new Map<string, Map<string, (typeof attendances)[number]>>();
  attendances.forEach((attendance) => {
    const userKey = attendance.userId.toString();
    const dayKey = toIsoDate(attendance.date);
    const userMap = recordsByUser.get(userKey) ?? new Map<string, (typeof attendances)[number]>();
    userMap.set(dayKey, attendance);
    recordsByUser.set(userKey, userMap);
  });

  return {
    data: {
      month: query.month,
      year: query.year,
      days,
      employees: users.map((user) => {
        const records = recordsByUser.get(user.id.toString()) ?? new Map();
        return {
          id: user.id.toString(),
          username: user.username,
          employeeCode: user.employeeCode,
          fullName: user.fullName,
          firstName: user.firstName,
          lastName: user.lastName,
          department: user.department,
          position: user.position,
          avatar: user.avatar,
          isCountable: user.isCountable,
          isAttendance: user.isAttendance,
          recordsByDate: Object.fromEntries(
            Array.from(records.entries()).map(([date, record]) => [
              date,
              {
                id: record.id.toString(),
                date,
                status: record.status,
                workHours: Number(record.workHours),
                checkIn: record.checkIn?.toISOString() ?? null,
                checkOut: record.checkOut?.toISOString() ?? null,
                note: record.note,
              },
            ]),
          ),
        };
      }),
    },
    meta: buildMeta(total, page, limit),
  };
}

function getWorksheetRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    raw: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw Object.assign(new Error('Excel file does not contain any sheet'), { status: 400 });
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  return rows;
}

function getHeaderInfo(rows: Array<Array<string | number | null>>) {
  const headerRowIndex = rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeText(cell));
    return REQUIRED_HEADERS.every((header) => normalized.includes(normalizeText(header)));
  });

  if (headerRowIndex === -1) {
    throw Object.assign(new Error('Excel header is invalid or missing required columns'), {
      status: 400,
    });
  }

  const headerRow = rows[headerRowIndex].map((cell) => String(cell ?? '').trim());
  const headerMap = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    headerMap.set(normalizeText(cell), index);
  });

  return { headerRowIndex, headerMap };
}

function getCellValue(
  row: Array<string | number | null>,
  headerMap: Map<string, number>,
  header: string,
) {
  const index = headerMap.get(normalizeText(header));
  if (index === undefined) return '';
  return row[index] ?? '';
}

function parseImportRows(buffer: Buffer) {
  const rows = getWorksheetRows(buffer);
  const { headerRowIndex, headerMap } = getHeaderInfo(rows);
  const items: Array<ImportRow> = [];
  const errors: Array<{ row: number; message: string }> = [];
  let totalRows = 0;

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row?.length) continue;

    const employeeCode = String(getCellValue(row, headerMap, 'Mã nhân viên')).trim();
    const employeeName = String(getCellValue(row, headerMap, 'Tên nhân viên')).trim();
    const rawDate = getCellValue(row, headerMap, 'Ngày');
    const date = parseDateValue(rawDate);
    const checkIn = parseTimeValue(getCellValue(row, headerMap, 'Giờ vào'));
    const checkOut = parseTimeValue(getCellValue(row, headerMap, 'Giờ ra'));
    const shiftCode = String(getCellValue(row, headerMap, 'Ca')).trim();
    const departmentRaw = String(getCellValue(row, headerMap, 'Phòng ban')).trim();

    const isEmptyRow =
      !employeeCode && !employeeName && !date && !checkIn && !checkOut && !shiftCode;
    if (isEmptyRow) continue;
    totalRows += 1;

    if (!employeeCode) {
      errors.push({ row: index + 1, message: 'Missing employee code' });
      continue;
    }

    if (!date) {
      errors.push({ row: index + 1, message: 'Invalid attendance date' });
      continue;
    }

    if (
      (String(getCellValue(row, headerMap, 'Giờ vào')).trim() && !checkIn) ||
      (String(getCellValue(row, headerMap, 'Giờ ra')).trim() && !checkOut)
    ) {
      errors.push({ row: index + 1, message: 'Invalid time format in check-in/check-out column' });
      continue;
    }

    const item: ImportRow = {
      rowNumber: index + 1,
      employeeCode,
      employeeName,
      date,
      checkIn,
      checkOut,
      lateMinutes: parseNumber(getCellValue(row, headerMap, 'Trễ')),
      earlyMinutes: parseNumber(getCellValue(row, headerMap, 'Sớm')),
      workUnit: parseNumber(getCellValue(row, headerMap, 'Công')),
      workHours: parseNumber(getCellValue(row, headerMap, 'Tổng giờ')),
      overtimeHours: parseNumber(getCellValue(row, headerMap, 'Tăng ca')),
      totalHours: parseNumber(getCellValue(row, headerMap, 'Tổng toàn bộ')),
      shiftCode,
      department: departmentRaw || null,
    };

    if (item.workHours < 0) {
      errors.push({ row: index + 1, message: 'Work hours must be greater than or equal to 0' });
      continue;
    }

    if (item.checkIn && item.checkOut) {
      const checkInValue = toUtcDateTime(item.date, item.checkIn);
      const checkOutValue = toUtcDateTime(item.date, item.checkOut);
      if (checkInValue && checkOutValue && checkInValue.getTime() > checkOutValue.getTime()) {
        errors.push({
          row: index + 1,
          message: 'Check-in time cannot be later than check-out time',
        });
        continue;
      }
    }

    items.push(item);
  }

  return { items, errors, totalRows };
}

export async function importAttendanceExcel(fileBuffer: Buffer) {
  const { items, errors, totalRows } = parseImportRows(fileBuffer);
  if (!items.length && errors.length) {
    throw Object.assign(new Error('Excel file contains no valid attendance row'), {
      status: 400,
      details: errors,
    });
  }

  const employeeCodes = Array.from(new Set(items.map((item) => item.employeeCode)));
  const users = await prisma.user.findMany({
    where: {
      employeeCode: { in: employeeCodes },
    },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
    },
  });

  const userByEmployeeCode = new Map(
    users
      .filter((user): user is typeof user & { employeeCode: string } => Boolean(user.employeeCode))
      .map((user) => [user.employeeCode, user]),
  );

  let created = 0;
  let updated = 0;

  const validRows = items.flatMap((item, index) => {
    const user = userByEmployeeCode.get(item.employeeCode);
    if (!user) {
      errors.push({
        row: item.rowNumber,
        message: `Employee code ${item.employeeCode} does not match any users.employee_code`,
      });
      return [];
    }

    return [{ item, user }];
  });

  await prisma.$transaction(async (tx) => {
    for (const { item, user } of validRows) {
      const date = toUtcDate(item.date);
      const data = {
        userId: user.id,
        date,
        checkIn: toUtcDateTime(item.date, item.checkIn),
        checkOut: toUtcDateTime(item.date, item.checkOut),
        workHours: item.workHours,
        status: deriveStatus(item),
        note: buildAttendanceNote(item),
      };

      const existing = await tx.attendance.findUnique({
        where: {
          userId_date: {
            userId: user.id,
            date,
          },
        },
        select: { id: true },
      });

      await tx.attendance.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date,
          },
        },
        create: data,
        update: data,
      });

      if (existing) updated += 1;
      else created += 1;
    }
  });

  return {
    totalRows,
    importedRows: validRows.length,
    created,
    updated,
    failedRows: errors.length,
    errors,
  };
}

export async function updateAttendance(id: bigint, data: UpdateAttendanceDto) {
  const existing = await prisma.attendance.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
    },
  });

  if (!existing) {
    throw Object.assign(new Error('Attendance record not found'), { status: 404 });
  }

  if (
    data.checkIn &&
    data.checkOut &&
    timeValueToMinutes(data.checkIn) > timeValueToMinutes(data.checkOut)
  ) {
    throw Object.assign(new Error('Check-in time cannot be later than check-out time'), {
      status: 400,
    });
  }

  const dateValue = toIsoDate(existing.date);
  const updated = await prisma.attendance.update({
    where: { id },
    data: {
      status: data.status,
      checkIn: toUtcDateTime(dateValue, data.checkIn ?? null),
      checkOut: toUtcDateTime(dateValue, data.checkOut ?? null),
      workHours: data.workHours,
      note: data.note ?? null,
    },
  });

  return {
    id: updated.id.toString(),
    date: toIsoDate(updated.date),
    status: updated.status,
    workHours: Number(updated.workHours),
    checkIn: updated.checkIn?.toISOString() ?? null,
    checkOut: updated.checkOut?.toISOString() ?? null,
    note: updated.note,
  };
}
