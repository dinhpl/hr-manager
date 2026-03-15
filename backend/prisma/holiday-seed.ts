import fs from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';

type HolidaySeedItem = {
  date: string;
  day?: string;
  name: string;
};

type HolidaySeedFile = Record<string, Record<string, HolidaySeedItem[]>>;

type ParsedHoliday = {
  date: string;
  name: string;
};

function getHolidaySeedFilePath() {
  return path.join(__dirname, 'data', 'holidays.json');
}

function toUtcDate(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    throw new Error(`Invalid holiday date format: ${dateValue}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function loadDefaultHolidayData() {
  const filePath = getHolidaySeedFilePath();
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as HolidaySeedFile;
  const deduped = new Map<string, ParsedHoliday>();

  for (const months of Object.values(parsed)) {
    for (const items of Object.values(months)) {
      for (const item of items) {
        const date = String(item.date ?? '').trim();
        const name = String(item.name ?? '').trim();

        if (!date || !name) continue;

        const key = `${date}::${name.toLowerCase()}`;
        if (!deduped.has(key)) {
          deduped.set(key, { date, name });
        }
      }
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) =>
      left.date === right.date ? left.name.localeCompare(right.name, 'vi') : left.date.localeCompare(right.date),
    )
    .map((item) => ({
      date: toUtcDate(item.date),
      name: item.name,
    }));
}

export async function seedDefaultHolidays(prisma: PrismaClient) {
  const data = loadDefaultHolidayData();
  if (data.length === 0) {
    return {
      created: 0,
      skipped: true,
      totalDefaults: 0,
    };
  }

  const result = await prisma.holiday.createMany({
    data,
    skipDuplicates: true,
  });

  return {
    created: result.count,
    skipped: false,
    totalDefaults: data.length,
  };
}
