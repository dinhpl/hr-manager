import prisma from '../../config/prisma';
import type { CreateHolidayDto, UpdateHolidayDto } from './holidays.validation';

export type HolidayListItem = {
  id: string;
  date: string;
  name: string;
};

export type HolidayCalendarItem = {
  id: string;
  name: string;
};

function getDateRange(year: number, month?: number) {
  if (month) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    return { start, end };
  }

  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)),
  };
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toUtcDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function serializeHoliday(holiday: { id: bigint; date: Date; name: string }): HolidayListItem {
  return {
    id: holiday.id.toString(),
    date: toIsoDate(holiday.date),
    name: holiday.name,
  };
}

async function assertHolidayNotDuplicate(date: Date, name: string, excludeId?: bigint) {
  const existing = await prisma.holiday.findFirst({
    where: {
      date,
      name,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw Object.assign(new Error('Holiday đã tồn tại trong ngày này'), { status: 409 });
  }
}

export async function getHolidays(year: number, month?: number) {
  const { start, end } = getDateRange(year, month);

  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: start,
        lt: end,
      },
    },
    orderBy: [{ date: 'asc' }, { name: 'asc' }],
  });

  return holidays.map(serializeHoliday);
}

export async function createHoliday(data: CreateHolidayDto) {
  const date = toUtcDate(data.date);
  const name = data.name.trim();
  await assertHolidayNotDuplicate(date, name);

  const holiday = await prisma.holiday.create({
    data: {
      date,
      name,
    },
  });

  return serializeHoliday(holiday);
}

export async function updateHoliday(id: bigint, data: UpdateHolidayDto) {
  const existing = await prisma.holiday.findUnique({
    where: { id },
  });

  if (!existing) {
    throw Object.assign(new Error('Không tìm thấy holiday'), { status: 404 });
  }

  const nextDate = data.date ? toUtcDate(data.date) : existing.date;
  const nextName = data.name?.trim() || existing.name;

  await assertHolidayNotDuplicate(nextDate, nextName, id);

  const holiday = await prisma.holiday.update({
    where: { id },
    data: {
      date: nextDate,
      name: nextName,
    },
  });

  return serializeHoliday(holiday);
}

export async function deleteHoliday(id: bigint) {
  const existing = await prisma.holiday.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw Object.assign(new Error('Không tìm thấy holiday'), { status: 404 });
  }

  await prisma.holiday.delete({ where: { id } });
}

export async function getHolidayMapForMonth(year: number, month: number) {
  const holidays = await getHolidays(year, month);
  const map: Record<string, HolidayCalendarItem[]> = {};

  holidays.forEach((holiday) => {
    if (!map[holiday.date]) {
      map[holiday.date] = [];
    }
    map[holiday.date].push({
      id: holiday.id,
      name: holiday.name,
    });
  });

  return map;
}
