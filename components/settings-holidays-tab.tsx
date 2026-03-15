'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Edit2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { buildQuery } from '@/lib/hr-utils';

type HolidayItem = {
  id: string;
  date: string;
  name: string;
};

type HolidayFormState = {
  date: string;
  name: string;
};

const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const days: { day: number; month: 'prev' | 'current' | 'next'; dateStr: string }[] = [];

  for (let i = startOffset - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    const prevMonth = month - 1 === 0 ? 12 : month - 1;
    const prevYear = month - 1 === 0 ? year - 1 : year;
    days.push({
      day,
      month: 'prev',
      dateStr: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      day,
      month: 'current',
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  const remaining = 42 - days.length;
  for (let day = 1; day <= remaining; day += 1) {
    const nextMonth = month + 1 === 13 ? 1 : month + 1;
    const nextYear = month + 1 === 13 ? year + 1 : year;
    days.push({
      day,
      month: 'next',
      dateStr: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  return days;
}

export default function SettingsHolidaysTab() {
  const now = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayItem | null>(null);
  const [formState, setFormState] = useState<HolidayFormState>({ date: '', name: '' });

  const holidaysByDate = useMemo(() => {
    const map: Record<string, HolidayItem[]> = {};
    holidays.forEach((holiday) => {
      if (!map[holiday.date]) {
        map[holiday.date] = [];
      }
      map[holiday.date].push(holiday);
    });
    return map;
  }, [holidays]);

  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentMonth, currentYear],
  );

  const defaultDialogDate = useMemo(() => {
    const day = Math.min(now.getDate(), new Date(currentYear, currentMonth, 0).getDate());
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }, [currentMonth, currentYear, now]);

  const loadHolidays = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQuery({ year: currentYear, month: currentMonth });
      const response = await apiClient.get<HolidayItem[]>(`/api/holidays?${query}`);
      setHolidays(response.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải danh sách holiday.');
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    void loadHolidays();
  }, [loadHolidays]);

  const openCreateDialog = (date: string) => {
    setEditingHoliday(null);
    setFormState({ date, name: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (holiday: HolidayItem) => {
    setEditingHoliday(holiday);
    setFormState({ date: holiday.date, name: holiday.name });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formState.date || !formState.name.trim()) {
      toast.error('Vui lòng nhập đầy đủ ngày và tên holiday.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingHoliday) {
        await apiClient.patch(`/api/holidays/${editingHoliday.id}`, {
          date: formState.date,
          name: formState.name.trim(),
        });
        toast.success('Đã cập nhật holiday.');
      } else {
        await apiClient.post('/api/holidays', {
          date: formState.date,
          name: formState.name.trim(),
        });
        toast.success('Đã thêm holiday mới.');
      }

      setDialogOpen(false);
      await loadHolidays();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingHoliday) return;

    setIsSubmitting(true);
    try {
      await apiClient.delete(`/api/holidays/${editingHoliday.id}`);
      toast.success('Đã xóa holiday.');
      setDialogOpen(false);
      await loadHolidays();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xóa holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((year) => year - 1);
      return;
    }
    setCurrentMonth((month) => month - 1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((year) => year + 1);
      return;
    }
    setCurrentMonth((month) => month + 1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#203430' }}>
            Quản lý ngày nghỉ lễ
          </h3>
          <p className="text-sm" style={{ color: '#6b7f78' }}>
            HR/Admin có thể thêm, sửa, xóa holiday trực tiếp trên lịch tháng.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadHolidays()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => openCreateDialog(defaultDialogDate)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
          >
            <Plus size={14} />
            Thêm holiday
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white" style={{ borderColor: '#e2ede9' }}>
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: '#fff7ed' }}
            >
              <Calendar size={18} style={{ color: '#ea580c' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </p>
              <p className="text-xs" style={{ color: '#6b7f78' }}>
                {holidays.length} holiday trong tháng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-7 border-b" style={{ borderColor: '#f0f4f2' }}>
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: '#6b7f78' }}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((dayCell, index) => {
                const dayHolidays = holidaysByDate[dayCell.dateStr] ?? [];
                const isCurrentMonth = dayCell.month === 'current';
                const hasHoliday = dayHolidays.length > 0;

                return (
                  <div
                    key={`${dayCell.dateStr}-${index}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openCreateDialog(dayCell.dateStr)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openCreateDialog(dayCell.dateStr);
                      }
                    }}
                    className="min-h-[120px] border-b border-r p-2 text-left transition-colors hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    style={{
                      borderColor: '#f0f4f2',
                      background: hasHoliday ? '#fff7ed' : isCurrentMonth ? '#fff' : '#f9fafb',
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: hasHoliday ? '#fed7aa' : isCurrentMonth ? '#f3f4f6' : '#f9fafb',
                          color: hasHoliday ? '#c2410c' : isCurrentMonth ? '#203430' : '#9ca3af',
                        }}
                      >
                        {dayCell.day}
                      </span>
                      <Plus size={14} style={{ color: hasHoliday ? '#ea580c' : '#9ca3af' }} />
                    </div>

                    <div className="space-y-1.5">
                      {dayHolidays.length === 0 ? (
                        <p className="text-[11px] leading-relaxed" style={{ color: '#9ca3af' }}>
                          Bấm để thêm holiday
                        </p>
                      ) : (
                        dayHolidays.map((holiday) => (
                          <div
                            key={holiday.id}
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditDialog(holiday);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openEditDialog(holiday);
                              }
                            }}
                            className="rounded-lg border px-2 py-1.5 text-xs font-medium"
                            style={{
                              borderColor: '#fdba74',
                              background: '#fff',
                              color: '#9a3412',
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2 leading-relaxed">{holiday.name}</span>
                              <Edit2 size={12} className="shrink-0" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHoliday ? 'Cập nhật holiday' : 'Thêm holiday mới'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: '#203430' }}>
                Ngày
              </label>
              <Input
                type="date"
                value={formState.date}
                onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: '#203430' }}>
                Tên holiday
              </label>
              <Input
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ví dụ: Ngày Quốc khánh"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <div>
                {editingHoliday ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                    style={{ color: '#dc2626' }}
                  >
                    <Trash2 size={14} />
                    Xóa holiday
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                  style={{ borderColor: '#e2ede9', color: '#203430' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: '#1DB87A' }}
                >
                  {isSubmitting ? 'Đang lưu...' : editingHoliday ? 'Cập nhật' : 'Tạo holiday'}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
