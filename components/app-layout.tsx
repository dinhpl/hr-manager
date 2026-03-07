'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Clock,
  BedDouble,
  CheckCircle2,
  Users,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  CalendarDays,
  Gem,
  ChevronDown,
} from 'lucide-react';
import { apiClient, clearAuthSession } from '@/lib/api-client';
import { getRoleLabel, toFrontendRole } from '@/lib/hr-utils';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    key: 'dashboard',
  },
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
  // [MVP-HIDDEN] Quản lý Overtime - not in MVP scope
  // { href: "/dashboard/overtime", label: "Quản lý Overtime", icon: Clock, key: "overtime" },
  // [MVP-HIDDEN] Nghỉ bù (Comp-off) - not in MVP scope
  // { href: "/dashboard/compoff", label: "Nghỉ bù (Comp-off)", icon: BedDouble, key: "compoff" },
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
  // [MVP-HIDDEN] Báo cáo - not in MVP scope
  // { href: "/dashboard/reports", label: "Báo cáo", icon: BarChart3, key: "reports" },
  {
    href: '/dashboard/settings',
    label: 'Cài đặt',
    icon: Settings,
    key: 'settings',
  },
];

interface UserInfo {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  department?: string | null;
  position?: string | null;
  avatar?: string | null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifications = [
    'Bạn có 2 yêu cầu nghỉ phép chờ duyệt',
    '01 yêu cầu đã được HR xác nhận',
    'Nhắc nhở: cập nhật kế hoạch nghỉ tháng này',
  ];

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
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.key === 'approval') return currentRole !== 'employee';
    if (item.key === 'employees' || item.key === 'settings') {
      return currentRole === 'hr' || currentRole === 'admin';
    }
    return true;
  });

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
          width: 240,
          background: '#fff',
          borderRight: '1px solid #e2ede9',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid #e2ede9' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: '#1DB87A' }}
          >
            <CalendarDays size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-sm leading-none" style={{ color: '#203430' }}>
              NextHR
            </span>
            <span className="block text-xs font-normal" style={{ color: '#6b7f78' }}>
              Leave System
            </span>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'text-white'
                        : 'text-[#6b7f78] hover:bg-[#f0f9f5] hover:text-[#203430]'
                    }`}
                    style={
                      isActive
                        ? {
                            background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)',
                          }
                        : {}
                    }
                  >
                    <item.icon size={17} className="shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header
          className="flex items-center gap-4 px-5 py-3 bg-white"
          style={{ borderBottom: '1px solid #e2ede9', height: 64 }}
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
            {/* Notification */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen((p) => !p);
                  setProfileOpen(false);
                }}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
              >
                <Bell size={17} style={{ color: '#6b7f78' }} />
                <span
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                  style={{ background: '#ef4444' }}
                >
                  {notifications.length}
                </span>
              </button>
              {notifOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 bg-white rounded-xl border shadow-lg z-20"
                  style={{ borderColor: '#e2ede9' }}
                >
                  <div className="px-3 py-2 border-b" style={{ borderColor: '#e2ede9' }}>
                    <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                      Thông báo
                    </p>
                  </div>
                  <div className="py-1">
                    {notifications.map((item, idx) => (
                      <div key={idx} className="px-3 py-2 text-sm" style={{ color: '#6b7f78' }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: '#1DB87A' }}
                >
                  {displayName.charAt(0)}
                </div>
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
                    onClick={() => setProfileOpen(false)}
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

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-red-50"
              style={{ color: '#dc2626' }}
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
