'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Camera,
  Upload,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Check,
  Mail,
  Building2,
  CalendarDays,
  UserCircle2,
  Briefcase,
  Users,
  Phone,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiClient, clearAuthSession, getApiBaseUrl } from '@/lib/api-client';
import { getRoleLabel } from '@/lib/hr-utils';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  department?: string;
  position?: string;
  avatar?: string;
  companyJoinDate?: string;
  birthday?: string;
  hideBirthday?: boolean;
  phone?: string | null;
  manager?: { id: string; fullName: string } | null;
}

const PRESET_AVATARS = [
  '/assets/avatars/bluey_1.png',
  '/assets/avatars/bluey_2.png',
  '/assets/avatars/bluey_3.png',
  '/assets/avatars/bluey_4.png',
  '/assets/avatars/bluey_5.png',
  '/assets/avatars/bluey_6.png',
  '/assets/avatars/bluey_7.png',
  '/assets/avatars/bluey_8.png',
  '/assets/avatars/bluey_9.png',
  '/assets/avatars/bluey_10.png',
  '/assets/avatars/toon_2.png',
  '/assets/avatars/toon_3.png',
  '/assets/avatars/toon_4.png',
  '/assets/avatars/toon_8.png',
  '/assets/avatars/toon_10.png',
];

interface HeatmapRecord {
  date: string;
  status: string;
  workHours: number;
  checkIn?: string | null;
  checkOut?: string | null;
}

interface HeatmapDay {
  date: string;
  record: HeatmapRecord | null;
  isWeekend: boolean;
  isFuture: boolean;
  outOfRange: boolean;
}

const HEATMAP_YEAR = 2026;
const HEATMAP_CARD_PADDING = 16;
const HEATMAP_ROW_LABEL_WIDTH = 24;
// gap = cellSize × ratio; giải phương trình để không circular: size = available / (n*(1+r) + r)
const HEATMAP_GAP_RATIO = 0.26;
const HEATMAP_MOBILE_BREAKPOINT = 768;
// width content tham chiếu khi màn hình < 768px (≈ 768 trừ sidebar + padding)
const HEATMAP_MOBILE_REF_WIDTH = 500;
const HEATMAP_SCALE_TRANSITION =
  'width 0.3s ease, height 0.3s ease, font-size 0.3s ease, padding-top 0.3s ease, gap 0.3s ease, border-radius 0.3s ease';
const MONTH_LABELS_VI = [
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
const HEATMAP_ROW_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HEATMAP_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const HEATMAP_LEVELS = [
  { label: 'Chưa có dữ liệu', color: '#E9ECE8' },
  { label: 'Vắng', color: '#F8C7CF' },
  { label: 'Nghỉ phép', color: '#CAE4FF' },
  { label: '1–4h', color: '#D9F7EC' },
  { label: '4–6h', color: '#9AECCE' },
  { label: '6–8h', color: '#52D7AB' },
  { label: '8–9h', color: '#1CB98A' },
  { label: '9h+', color: '#0F8F69' },
];

function getDayColor(day: HeatmapDay): string {
  if (day.isWeekend) return '#F4F6F3';
  if (!day.record) return '#E9ECE8';
  const { status, workHours } = day.record;
  if (status === 'absent') return '#F8C7CF';
  if (status === 'leave') return '#CAE4FF';

  const computedHours =
    computeHeatmapWorkedHours(day.record.checkIn, day.record.checkOut) ?? workHours;

  if (computedHours >= 9) return '#0F8F69';
  if (computedHours >= 8) return '#1CB98A';
  if (computedHours >= 6) return '#52D7AB';
  if (computedHours >= 4) return '#9AECCE';
  return '#D9F7EC';
}

function formatHeatmapDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function formatHeatmapTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function computeHeatmapWorkedHours(checkIn?: string | null, checkOut?: string | null) {
  if (!checkIn || !checkOut) return null;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000) - 75;
  return Math.max(0, diffMinutes) / 60;
}

function formatHeatmapHours(value?: number | null) {
  if (!Number.isFinite(value) || !value || value <= 0) return '0h';
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}m`;
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value || '—'}</p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [showAvatarList, setShowAvatarList] = useState(false);
  const [saving, setSaving] = useState(false);

  const [heatmapData, setHeatmapData] = useState<HeatmapRecord[]>([]);
  const [hoveredHeatmapDate, setHoveredHeatmapDate] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [hideBirthday, setHideBirthday] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const loadUser = useCallback(async () => {
    try {
      const { data } = await apiClient.get<UserProfile>('/api/auth/me');
      setUser(data);
      setFullName(data.fullName || '');
      setPosition(data.position || '');
      setPhone(data.phone || '');
      setSelectedAvatar(data.avatar || '');
      setHideBirthday(data.hideBirthday ?? false);
    } catch {
      clearAuthSession();
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    apiClient
      .get<HeatmapRecord[]>(`/api/attendances/my-heatmap?year=${HEATMAP_YEAR}`)
      .then(({ data }) => setHeatmapData(data))
      .catch(() => {});
  }, []);

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      const { data } = await apiClient.patch<UserProfile>('/api/auth/profile', {
        fullName,
        position,
        phone: phone.trim() || null,
        avatar: selectedAvatar,
        hideBirthday,
      });
      setUser(data);
      toast.success('Cập nhật thông tin thành công!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const { data } = await apiClient.post<UserProfile>('/api/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
      setSelectedAvatar(data.avatar || '');
      toast.success('Upload avatar thành công!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload thất bại');
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) return toast.error('Mật khẩu mới không khớp');
    if (newPassword.length < 6) return toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
    setSaving(true);
    try {
      await apiClient.patch('/api/auth/change-password', { currentPassword, newPassword });
      toast.success('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    if (avatar.startsWith('/assets')) return avatar;
    if (avatar.startsWith('/uploads')) return getApiBaseUrl() + avatar;
    return null;
  };

  const heatmapWeeks = useMemo(() => {
    const recordMap = new Map(heatmapData.map((d) => [d.date, d]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yearStart = new Date(Date.UTC(HEATMAP_YEAR, 0, 1)); // 2026-01-01
    const yearEnd = new Date(Date.UTC(HEATMAP_YEAR, 11, 31)); // 2026-12-31

    // Grid starts on the Sunday on or before Jan 1
    const gridStart = new Date(yearStart);
    gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

    // Grid ends on the Saturday on or after Dec 31
    const gridEnd = new Date(yearEnd);
    const daysToSat = (6 - gridEnd.getUTCDay() + 7) % 7;
    gridEnd.setUTCDate(gridEnd.getUTCDate() + daysToSat);

    const weeks: { days: HeatmapDay[]; monthLabel: string | null }[] = [];
    const cur = new Date(gridStart);
    let prevMonth = -1;

    while (cur <= gridEnd) {
      const days: HeatmapDay[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = cur.toISOString().slice(0, 10);
        const dow = cur.getUTCDay();
        const inRange = cur >= yearStart && cur <= yearEnd;
        days.push({
          date: dateStr,
          record: inRange ? (recordMap.get(dateStr) ?? null) : null,
          isWeekend: dow === 0 || dow === 6,
          isFuture: cur > today,
          outOfRange: !inRange,
        });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      // Month label: based on first in-range day of the week
      const firstInRange = days.find((d) => !d.outOfRange);
      const month = firstInRange ? new Date(firstInRange.date + 'T00:00:00Z').getUTCMonth() : -1;
      weeks.push({
        days,
        monthLabel: month !== -1 && month !== prevMonth ? MONTH_LABELS_VI[month] : null,
      });
      if (month !== -1) prevMonth = month;
    }
    return weeks;
  }, [heatmapData]);

  // callback ref: thay đổi khi element mount/unmount → effect re-run đúng khi switch tab
  const [heatmapContainer, setHeatmapContainer] = useState<HTMLDivElement | null>(null);
  const [heatmapCellSize, setHeatmapCellSize] = useState(14);

  useEffect(() => {
    if (!heatmapContainer || heatmapWeeks.length === 0) return;

    const computeSize = (containerWidth: number) => {
      const isMobile = window.innerWidth < HEATMAP_MOBILE_BREAKPOINT;
      const effectiveWidth = isMobile ? HEATMAP_MOBILE_REF_WIDTH : containerWidth;
      const n = heatmapWeeks.length;
      const available = effectiveWidth - HEATMAP_CARD_PADDING * 2 - HEATMAP_ROW_LABEL_WIDTH;
      // size*(n*(1+r) + r) = available  → giải ra size
      const rawSize = available / (n * (1 + HEATMAP_GAP_RATIO) + HEATMAP_GAP_RATIO);
      setHeatmapCellSize(Math.max(10, Math.min(Math.floor(rawSize), 20)));
    };

    const observer = new ResizeObserver(([entry]) => computeSize(entry.contentRect.width));
    observer.observe(heatmapContainer);
    computeSize(heatmapContainer.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [heatmapContainer, heatmapWeeks.length]);

  const heatmapCellGap = Math.max(2, Math.round(heatmapCellSize * HEATMAP_GAP_RATIO));
  const heatmapMonthLabelHeight = Math.round(heatmapCellSize * 1.5);
  const heatmapLabelFontSize = Math.max(8, Math.round(heatmapCellSize * 0.62));

  const avatarUrl = getAvatarUrl(selectedAvatar);
  const initials = (user?.fullName || 'U')
    .split(' ')
    .slice(0, 2)
    .map((s) => s.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-5">
      {/* ── Header card ── */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
              >
                {initials}
              </div>
            )}
            <button
              onClick={() => setShowAvatarList(!showAvatarList)}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-50"
              title="Đổi avatar"
            >
              <Camera size={13} className="text-gray-500" />
            </button>
          </div>

          {/* Name & meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{user?.fullName || '—'}</h1>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: '#d1fae5', color: '#065f46' }}
              >
                {user?.role ? getRoleLabel(user.role) : '—'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
              {user?.username && (
                <span className="flex items-center gap-1.5">
                  <UserCircle2 size={14} className="shrink-0" />
                  {user.username}
                </span>
              )}
              {user?.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={14} className="shrink-0" />
                  {user.email}
                </span>
              )}
              {user?.department && (
                <span className="flex items-center gap-1.5">
                  <Building2 size={14} className="shrink-0" />
                  {user.department}
                </span>
              )}
              {user?.position && (
                <span className="flex items-center gap-1.5">
                  <Briefcase size={14} className="shrink-0" />
                  {user.position}
                </span>
              )}
              {user?.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} className="shrink-0" />
                  {user.phone}
                </span>
              )}
              {user?.companyJoinDate && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} className="shrink-0" />
                  Vào công ty{' '}
                  {new Date(user.companyJoinDate).toLocaleDateString('vi-VN', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Avatar picker — collapsible */}
        {showAvatarList && (
          <div className="mt-5 pt-5 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
            <p className="text-xs text-gray-400 mb-3">Chọn avatar có sẵn hoặc upload ảnh</p>
            <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-15 gap-2 mb-3">
              {PRESET_AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                    selectedAvatar === avatar
                      ? 'border-[#1DB87A] ring-2 ring-[#1DB87A]/20'
                      : 'border-transparent'
                  }`}
                >
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  {selectedAvatar === avatar && (
                    <div className="absolute inset-0 bg-[#1DB87A]/20 flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-600"
            >
              <Upload size={13} />
              Upload ảnh mới
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-0 border-b border-gray-200">
        {(
          [
            { key: 'profile', label: 'Thông tin cá nhân' },
            { key: 'password', label: 'Đổi mật khẩu' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-[#1DB87A] text-[#1DB87A]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'profile' && (
        <div className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(180deg,#fcfefd_0%,#f3fbf7_100%)] px-5 py-5 shadow-[0_18px_50px_rgba(16,52,40,0.06)] sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
                Heatmap chấm công {HEATMAP_YEAR}
              </p>
              <p className="text-xs text-slate-500">
                Màu đậm hơn tương ứng với số giờ làm việc cao hơn.
              </p>
            </div>
            <div className="flex items-center gap-x-3 gap-y-2 flex-wrap justify-start lg:max-w-[28rem] lg:justify-end">
              {HEATMAP_LEVELS.map((l) => (
                <span
                  key={l.label}
                  className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 shadow-sm ring-1 ring-slate-200/80"
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: 4,
                      background: l.color,
                      border: l.color === '#E9ECE8' ? '1px solid #d6ddd7' : undefined,
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-[11px] font-medium text-slate-600">{l.label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-1" ref={setHeatmapContainer}>
            <div
              className="min-w-max rounded-[24px] border border-white/80 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
              style={{ padding: HEATMAP_CARD_PADDING }}
            >
              <div
                className="flex justify-center"
                style={{ gap: heatmapCellGap, transition: HEATMAP_SCALE_TRANSITION }}
              >
                <div
                  className="flex flex-col shrink-0"
                  style={{
                    gap: heatmapCellGap,
                    paddingTop: heatmapMonthLabelHeight,
                    width: HEATMAP_ROW_LABEL_WIDTH,
                    transition: HEATMAP_SCALE_TRANSITION,
                  }}
                >
                  {HEATMAP_ROW_LABELS.map((label) => (
                    <div
                      key={label}
                      className="flex items-center justify-end pr-1 font-medium text-slate-500"
                      style={{
                        height: heatmapCellSize,
                        fontSize: heatmapLabelFontSize,
                        transition: HEATMAP_SCALE_TRANSITION,
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div
                  className="flex"
                  style={{ gap: heatmapCellGap, transition: HEATMAP_SCALE_TRANSITION }}
                >
                  {heatmapWeeks.map((week, wi) => (
                    <div
                      key={wi}
                      className="relative flex flex-col"
                      style={{
                        width: heatmapCellSize,
                        gap: heatmapCellGap,
                        transition: HEATMAP_SCALE_TRANSITION,
                      }}
                    >
                      <div
                        className="relative"
                        style={{
                          height: heatmapMonthLabelHeight,
                          transition: HEATMAP_SCALE_TRANSITION,
                        }}
                      >
                        {week.monthLabel && (
                          <span
                            className="absolute left-0 top-0 whitespace-nowrap font-semibold uppercase tracking-[0.08em] text-slate-500"
                            style={{
                              fontSize: heatmapLabelFontSize,
                              transition: HEATMAP_SCALE_TRANSITION,
                            }}
                          >
                            {week.monthLabel}
                          </span>
                        )}
                      </div>
                      {HEATMAP_DAY_ORDER.map((dayIndex) => {
                        const day = week.days[dayIndex];
                        const di = dayIndex;

                        return (
                          <Popover
                            key={di}
                            open={hoveredHeatmapDate === day.date}
                            onOpenChange={(open) =>
                              setHoveredHeatmapDate((current) =>
                                open ? day.date : current === day.date ? null : current,
                              )
                            }
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Chi tiết chấm công ngày ${day.date}`}
                                onMouseEnter={() => {
                                  setHoveredHeatmapDate(day.date);
                                }}
                                onMouseLeave={() => {
                                  if (hoveredHeatmapDate === day.date) setHoveredHeatmapDate(null);
                                }}
                                style={{
                                  width: heatmapCellSize,
                                  height: heatmapCellSize,
                                  borderRadius: Math.max(2, Math.floor(heatmapCellSize * 0.25)),
                                  background: getDayColor(day),
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  opacity: 1,
                                  boxShadow: 'inset 0 0 0 1px rgba(148, 163, 184, 0.08)',
                                  transition: HEATMAP_SCALE_TRANSITION,
                                }}
                                className="block border-0 p-0 transition-transform duration-150 hover:scale-[1.08]"
                              />
                            </PopoverTrigger>
                            <PopoverContent
                              side="top"
                              align="center"
                              sideOffset={10}
                              className="pointer-events-none w-56 rounded-2xl border-slate-200/90 bg-white/95 px-3.5 py-3 text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur"
                            >
                              <div className="space-y-2">
                                <div className="border-b border-slate-100 pb-2">
                                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                                    Ngày
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {formatHeatmapDate(day.date)}
                                  </p>
                                </div>

                                {day.record ? (
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-slate-500">CheckIn</span>
                                      <span className="font-medium text-slate-900">
                                        {formatHeatmapTime(day.record.checkIn)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-slate-500">CheckOut</span>
                                      <span className="font-medium text-slate-900">
                                        {formatHeatmapTime(day.record.checkOut)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-slate-500">Tổng Giờ</span>
                                      <span className="font-semibold text-emerald-700">
                                        {formatHeatmapHours(
                                          computeHeatmapWorkedHours(
                                            day.record.checkIn,
                                            day.record.checkOut,
                                          ),
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm font-medium text-slate-500">
                                    Không Có Dữ Liệu
                                  </p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Thông tin cá nhân tab ── */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left col */}
          <div className="space-y-5">
            {/* Personal info (read-only) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Thông tin cá nhân</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoField
                  label="Ngày sinh"
                  value={user?.birthday ? new Date(user.birthday).toLocaleDateString('vi-VN') : ''}
                />
                <InfoField
                  label="Ngày vào công ty"
                  value={
                    user?.companyJoinDate
                      ? new Date(user.companyJoinDate).toLocaleDateString('vi-VN')
                      : ''
                  }
                />
                <InfoField label="Phòng ban" value={user?.department || ''} />
                <InfoField label="Vai trò" value={user?.role ? getRoleLabel(user.role) : ''} />
                <div className="col-span-2">
                  <InfoField label="Quản lý trực tiếp" value={user?.manager?.fullName || ''} />
                </div>
              </div>
            </div>

            {/* Account info (read-only) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Thông tin tài khoản</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoField label="Tên đăng nhập" value={user?.username || ''} />
                <InfoField label="Email" value={user?.email || ''} />
                <InfoField label="Số điện thoại" value={user?.phone || ''} />
                <div className="col-span-2">
                  <InfoField label="Chức vụ hiện tại" value={user?.position || ''} />
                </div>
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-5">
            {/* Editable fields */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Chỉnh sửa thông tin</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/20 focus:border-[#1DB87A]"
                    placeholder="Nhập họ và tên"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">Chức vụ</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/20 focus:border-[#1DB87A]"
                    placeholder="Nhập chức vụ"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/20 focus:border-[#1DB87A]"
                    placeholder="Ví dụ: 0912345678"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!hideBirthday}
                    onChange={(e) => setHideBirthday(!e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 accent-[#1DB87A]"
                  />
                  <span className="text-sm text-gray-700">
                    Hiển thị ngày sinh trên lịch dashboard
                  </span>
                </label>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={handleProfileSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Đổi mật khẩu tab ── */}
      {activeTab === 'password' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-4">Đổi mật khẩu</h2>
            <div className="space-y-4">
              {(
                [
                  {
                    key: 'current',
                    label: 'Mật khẩu hiện tại',
                    value: currentPassword,
                    onChange: setCurrentPassword,
                    placeholder: 'Nhập mật khẩu hiện tại',
                  },
                  {
                    key: 'new',
                    label: 'Mật khẩu mới',
                    value: newPassword,
                    onChange: setNewPassword,
                    placeholder: 'Ít nhất 6 ký tự',
                  },
                  {
                    key: 'confirm',
                    label: 'Xác nhận mật khẩu mới',
                    value: confirmPassword,
                    onChange: setConfirmPassword,
                    placeholder: 'Nhập lại mật khẩu mới',
                  },
                ] as const
              ).map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords[field.key] ? 'text' : 'password'}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/20 focus:border-[#1DB87A]"
                      placeholder={field.placeholder}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords((p) => ({ ...p, [field.key]: !p[field.key] }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {field.key === 'confirm' &&
                    confirmPassword &&
                    newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Mật khẩu không khớp</p>
                    )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={handlePasswordChange}
                disabled={
                  saving ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                Đổi mật khẩu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
