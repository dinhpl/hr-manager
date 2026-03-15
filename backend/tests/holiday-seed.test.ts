import { describe, expect, it, vi, afterEach } from 'vitest';
import * as holidaySeedModule from '../prisma/holiday-seed';

describe('holiday seed helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads default holiday data from JSON and keeps same-day different names', () => {
    const rows = holidaySeedModule.loadDefaultHolidayData();

    expect(rows.length).toBe(40);
    expect(
      rows.some(
        (row) =>
          row.date.toISOString().slice(0, 10) === '2028-05-01' && row.name === 'Ngày Quốc tế Lao động',
      ),
    ).toBe(true);
    expect(
      rows.some(
        (row) =>
          row.date.toISOString().slice(0, 10) === '2028-05-01' && row.name === 'Nghỉ Ngày Thống nhất',
      ),
    ).toBe(true);
  });

  it('seeds holidays with createMany + skipDuplicates', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      holiday: {
        createMany,
      },
    } as any;

    vi.spyOn(holidaySeedModule, 'loadDefaultHolidayData').mockReturnValue([
      { date: new Date('2026-01-01T00:00:00.000Z'), name: 'Tết Dương Lịch' },
      { date: new Date('2026-01-02T00:00:00.000Z'), name: 'Nghỉ bù' },
    ]);

    const result = await holidaySeedModule.seedDefaultHolidays(prisma);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { date: new Date('2026-01-01T00:00:00.000Z'), name: 'Tết Dương Lịch' },
        { date: new Date('2026-01-02T00:00:00.000Z'), name: 'Nghỉ bù' },
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual({
      created: 2,
      skipped: false,
      totalDefaults: 2,
    });
  });

  it('skips bootstrap when default data source is empty', async () => {
    const prisma = {
      holiday: {
        createMany: vi.fn(),
      },
    } as any;

    vi.spyOn(holidaySeedModule, 'loadDefaultHolidayData').mockReturnValue([]);

    const result = await holidaySeedModule.seedDefaultHolidays(prisma);

    expect(prisma.holiday.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: 0,
      skipped: true,
      totalDefaults: 0,
    });
  });
});
