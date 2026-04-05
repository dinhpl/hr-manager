'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CalendarDays,
  LayoutDashboard,
  History,
  CheckCircle2,
  Users,
  BarChart3,
  Settings,
  Table2,
  Menu,
  X,
  ChevronDown,
  Monitor,
  BookOpen,
  ClipboardList,
  Clock,
} from 'lucide-react';
import BrandLogo from '@/components/brand-logo';
import { apiClient, clearAuthSession, getApiBaseUrl } from '@/lib/api-client';
import { useNotifications } from '@/hooks/use-notifications';
import { getRoleLabel, toFrontendRole } from '@/lib/hr-utils';
import { formatNotificationTime, getNotificationHref } from '@/lib/notification-utils';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Tổng Quan',
    icon: LayoutDashboard,
    key: 'dashboard',
  },
  // {
  //   href: '/dashboard/profile',
  //   label: 'Thông tin cá nhân',
  //   icon: User,
  //   key: 'profile',
  // },
  // [MVP-HIDDEN] Đăng ký nghỉ phép - now accessible via modal in leave-history and dashboard
  // {
  //   href: "/dashboard/leave-request",
  //   label: "Đăng ký nghỉ phép",
  //   icon: PlusCircle,
  //   key: "leave-request",
  // },
  {
    href: '/dashboard/leave-history',
    label: 'Lịch sử nghỉ phép',
    icon: History,
    key: 'leave-history',
  },
  // [MVP-HIDDEN] Quản lý Overtime - tạm ẩn
  // { href: '/dashboard/overtime', label: 'Quản lý Overtime', icon: Clock, key: 'overtime' },
  // [MVP-HIDDEN] Nghỉ bù (Comp-off) - not in MVP scope
  // { href: '/dashboard/compoff', label: 'Nghỉ bù (Comp-off)', icon: BedDouble, key: 'compoff' },
  {
    href: '/dashboard/approval',
    label: 'Duyệt yêu cầu',
    icon: CheckCircle2,
    key: 'approval',
  },
  {
    href: '/dashboard/employees',
    label: 'Quản lý nhân viên',
    icon: Users,
    key: 'employees',
  },
  {
    href: '/dashboard/leave-balances',
    label: 'Quản lý phép năm',
    icon: CalendarDays,
    key: 'leave-balances',
  },
  {
    href: '/dashboard/attendance',
    label: 'Chấm công',
    icon: Table2,
    key: 'attendance',
  },
  {
    href: '/dashboard/devices',
    label: 'Quản lý thiết bị',
    icon: Monitor,
    key: 'devices',
  },
  {
    href: '/dashboard/skills',
    label: 'Quản lý Kỹ Năng',
    icon: BookOpen,
    key: 'skills',
  },
  {
    href: '/dashboard/activity-log',
    label: 'Nhật ký hoạt động',
    icon: ClipboardList,
    key: 'activity-log',
  },
  // [MVP-HIDDEN] Báo cáo - not in MVP scope
  { href: '/dashboard/reports', label: 'Báo cáo', icon: BarChart3, key: 'reports' },
  {
    href: '/dashboard/settings',
    label: 'Cài đặt',
    icon: Settings,
    key: 'settings',
  },
];

const NAV_GROUPS = [
  {
    key: 'attendance-leave-group',
    label: 'Chấm công & Nghỉ phép',
    items: ['attendance', 'leave-history', 'overtime', 'approval'],
  },
  {
    key: 'hr-group',
    label: 'Nhân sự',
    items: ['employees', 'skills', 'devices'],
  },
  {
    key: 'policy-group',
    label: 'Chính sách',
    items: ['leave-balances'],
  },
  {
    key: 'report-group',
    label: 'Báo cáo',
    items: ['reports', 'activity-log'],
  },
  {
    key: 'system-group',
    label: 'Hệ thống',
    items: ['settings'],
  },
];

interface UserInfo {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  systemRole?: string | null;
  department?: string | null;
  position?: string | null;
  avatar?: string | null;
  preJoinDate?: string | null;
  companyJoinDate?: string | null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const notifications = useNotifications(Boolean(userInfo));

  useEffect(() => {
    apiClient
      .get<UserInfo>('/api/auth/me')
      .then(({ data }) => {
        setUserInfo(data);
      })
      .catch(() => {
        clearAuthSession();
        router.replace('/');
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/auth/logout', {});
    } finally {
      clearAuthSession();
      router.push('/');
    }
  };

  const displayName = userInfo?.fullName || userInfo?.username || 'Người dùng';
  const roleTitle = userInfo ? getRoleLabel(userInfo.role) : '';
  const currentRole = toFrontendRole(userInfo?.role);

  useEffect(() => {
    const isSystemAdminLocal = userInfo?.systemRole?.toUpperCase() === 'ADMIN';
    if (!userInfo || (currentRole === 'employee' && !isSystemAdminLocal)) return;
    apiClient
      .get<unknown>('/api/leave-requests?status=PENDING&limit=1')
      .then((res) => {
        const total = (res as { meta?: { total?: number } }).meta?.total ?? 0;
        setPendingApprovalCount(total);
      })
      .catch(() => {});
  }, [userInfo, currentRole, pathname]);
  const isSystemAdmin = userInfo?.systemRole?.toUpperCase() === 'ADMIN';
  const canViewActivityLog = currentRole === 'hr' || isSystemAdmin;
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.key === 'approval') return currentRole !== 'employee' || isSystemAdmin;
    if (item.key === 'reports') return currentRole !== 'employee';
    if (item.key === 'activity-log') return canViewActivityLog;
    // if (item.key === 'attendance') {
    //   return currentRole === 'hr' || currentRole === 'admin' || isSystemAdmin;
    // }
    if (item.key === 'employees') {
      return currentRole === 'hr' || currentRole === 'admin' || currentRole === 'manager' || currentRole === 'employee' || isSystemAdmin;
    }
    if (
      item.key === 'settings' ||
      item.key === 'devices' ||
      item.key === 'skills'
    ) {
      return currentRole === 'hr' || currentRole === 'admin' || isSystemAdmin;
    }
    return true;
  });
  const visibleNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .map((itemKey) => visibleNavItems.find((item) => item.key === itemKey))
      .filter((item): item is (typeof NAV_ITEMS)[number] => Boolean(item)),
  })).filter((group) => group.items.length > 0);
  const dashboardNavItem = visibleNavItems.find((item) => item.key === 'dashboard');

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f7f7f7' }}>
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: 220,
          background: '#fff',
          borderRight: '1px solid #e2ede9',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-3 h-[54px]"
          style={{ borderBottom: '1px solid #e2ede9' }}
        >
          <BrandLogo
            size={32}
            title="Leave Management"
            subtitle="HR workspace"
            imageClassName="p-0.5"
            titleClassName="text-xs leading-none text-[#203430]"
            subtitleClassName="mt-0.5 text-[8px] uppercase tracking-[0.14em] text-[#6b7f78]"
            wrapperClassName="min-w-0 flex-1"
          />
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-2.5">
          <div className="space-y-2.5">
            {dashboardNavItem ? (
              <ul className="space-y-1">
                <li key={dashboardNavItem.key}>
                  <Link
                    href={dashboardNavItem.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-[background-color,color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.985] ${
                      pathname === dashboardNavItem.href
                        ? 'text-white shadow-[0_8px_18px_rgba(14,71,78,0.14)]'
                        : 'text-[#5f746d] hover:bg-[#f5faf8] hover:text-[#203430]'
                    }`}
                    style={
                      pathname === dashboardNavItem.href
                        ? {
                            background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)',
                          }
                        : {}
                    }
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        pathname === dashboardNavItem.href
                          ? 'bg-white/14 text-white scale-105'
                          : 'bg-[#eef6f2] text-[#5f746d] group-hover:scale-105'
                      }`}
                    >
                      <dashboardNavItem.icon size={14} className="shrink-0" />
                    </span>
                    <span className="truncate">{dashboardNavItem.label}</span>
                  </Link>
                </li>
              </ul>
            ) : null}

            {visibleNavGroups.map((group) => (
              <div key={group.key}>
                <p className="px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#93a59f]">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isActive =
                      item.href === '/dashboard'
                        ? pathname === item.href
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-[background-color,color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.985] ${
                            isActive
                              ? 'text-white shadow-[0_8px_18px_rgba(14,71,78,0.14)]'
                              : 'text-[#5f746d] hover:bg-[#f5faf8] hover:text-[#203430]'
                          }`}
                          style={
                            isActive
                              ? {
                                  background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)',
                                }
                              : {}
                          }
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                              isActive
                                ? 'bg-white/14 text-white scale-105'
                                : 'bg-[#eef6f2] text-[#5f746d] group-hover:scale-105'
                            }`}
                          >
                            <item.icon size={14} className="shrink-0" />
                          </span>
                          <span className="truncate flex-1">{item.label}</span>
                          {item.key === 'approval' && pendingApprovalCount > 0 && (
                            <span
                              className="shrink-0 min-w-4 h-4 rounded-full px-1 text-[10px] flex items-center justify-center font-bold"
                              style={{
                                background: isActive ? 'rgba(255,255,255,0.25)' : '#ef4444',
                                color: '#fff',
                              }}
                            >
                              {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* User company dates */}
        {(userInfo?.preJoinDate || userInfo?.companyJoinDate) && (
          <div
            className="px-4 py-3 mx-3 mb-1 rounded-lg"
            style={{ background: '#f0f9f5', border: '1px solid #D3F2E7' }}
          >
            {userInfo.preJoinDate ? (
              <div>
                <p
                  className="text-[10px] font-medium uppercase tracking-wide mb-0.5"
                  style={{ color: '#6b7f78' }}
                >
                  Ngày gia nhập
                </p>
                <p className="text-sm font-semibold" style={{ color: '#0E474E' }}>
                  {new Date(userInfo.preJoinDate).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              </div>
            ) : null}
            {userInfo.companyJoinDate ? (
              <div className={userInfo.preJoinDate ? 'mt-2' : ''}>
                <p
                  className="text-[10px] font-medium uppercase tracking-wide mb-0.5"
                  style={{ color: '#6b7f78' }}
                >
                  Ngày chính thức
                </p>
                <p className="text-sm font-semibold" style={{ color: '#0E474E' }}>
                  {new Date(userInfo.companyJoinDate).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* App version */}
        {process.env.NEXT_PUBLIC_VERSION && (
          <p className="text-center text-[10px] mb-3" style={{ color: '#b0bfba' }}>
            {process.env.NEXT_PUBLIC_VERSION}
          </p>
        )}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header
          className="flex items-center gap-4 px-5 py-3 bg-white"
          style={{ borderBottom: '1px solid #e2ede9', height: 54 }}
        >
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} className="text-muted-foreground" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground leading-none mb-0.5">Xin chào,</p>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground">{roleTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen((p) => !p);
                  setProfileOpen(false);
                }}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                aria-label="Thông báo"
              >
                <Bell size={17} style={{ color: '#6b7f78' }} />
                {notifications.unreadCount > 0 ? (
                  <span
                    className="absolute top-1.5 right-1.5 min-w-4 h-4 rounded-full px-1 text-white text-[10px] flex items-center justify-center font-bold"
                    style={{ background: '#ef4444' }}
                  >
                    {notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}
                  </span>
                ) : null}
              </button>
              {notifOpen ? (
                <div
                  className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border bg-white shadow-lg z-20"
                  style={{ borderColor: '#e2ede9' }}
                >
                  <div
                    className="flex items-center justify-between gap-3 border-b px-4 py-3"
                    style={{ borderColor: '#e2ede9' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                        Thông báo
                      </p>
                      <p className="text-xs" style={{ color: '#6b7f78' }}>
                        {notifications.isConnecting
                          ? 'Đang kết nối realtime...'
                          : 'Cập nhật tự động qua SSE'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void notifications.markAllAsRead()}
                      disabled={notifications.unreadCount === 0}
                      className="text-xs font-semibold disabled:opacity-50"
                      style={{ color: '#1DB87A' }}
                    >
                      Đánh dấu đã đọc
                    </button>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto">
                    {notifications.isLoading ? (
                      <div className="px-4 py-6 text-sm text-center" style={{ color: '#6b7f78' }}>
                        Đang tải thông báo...
                      </div>
                    ) : notifications.items.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-center" style={{ color: '#6b7f78' }}>
                        Chưa có thông báo nào.
                      </div>
                    ) : (
                      notifications.items.map((item) => (
                        <Link
                          key={item.id}
                          href={getNotificationHref(item)}
                          onClick={() => {
                            setNotifOpen(false);
                            if (!item.isRead) {
                              void notifications.markAsRead(item.id);
                            }
                          }}
                          className="block border-b px-4 py-3 transition-colors hover:bg-[#f7fdfb]"
                          style={{
                            borderColor: '#f0f4f2',
                            background: item.isRead ? '#ffffff' : '#f8fffc',
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: item.isRead ? '#cbd5e1' : '#1DB87A' }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                                  {item.title}
                                </p>
                                <span className="shrink-0 text-[11px]" style={{ color: '#6b7f78' }}>
                                  {formatNotificationTime(item.createdAt)}
                                </span>
                              </div>
                              <p
                                className="mt-1 text-xs leading-relaxed"
                                style={{ color: '#6b7f78' }}
                              >
                                {item.message}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                  {notifications.hasMore ? (
                    <button
                      type="button"
                      onClick={() => void notifications.loadMore()}
                      className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium"
                      style={{ color: '#203430' }}
                    >
                      <Check size={14} /> Xem thêm
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Avatar + name */}
            <div className="relative">
              <button
                onClick={() => {
                  setProfileOpen((p) => !p);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                {userInfo?.avatar ? (
                  <img
                    src={
                      userInfo.avatar.startsWith('/uploads')
                        ? getApiBaseUrl() + userInfo.avatar
                        : userInfo.avatar
                    }
                    alt={displayName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: '#1DB87A' }}
                  >
                    {displayName.charAt(0)}
                  </div>
                )}
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
              {profileOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-xl border shadow-lg z-20 overflow-hidden"
                  style={{ borderColor: '#e2ede9' }}
                >
                  <div className="px-3 py-2 border-b" style={{ borderColor: '#e2ede9' }}>
                    <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                      {displayName}
                    </p>
                    <p className="text-xs" style={{ color: '#6b7f78' }}>
                      {roleTitle}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      router.push('/dashboard/profile');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    style={{ color: '#203430' }}
                  >
                    Thông tin cá nhân
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50"
                    style={{ color: '#dc2626' }}
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
            {/* 
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-red-50"
              style={{ color: '#dc2626' }}
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button> */}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
