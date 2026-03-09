'use client';

import { X, Calendar, User, FileText, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

export interface CalendarDayUser {
  id?: string;
  name: string;
  status: 'approved' | 'pending';
  reason?: string;
  leaveType?: { code: string; name: string; color: string };
  approver?: string;
  department?: string;
  position?: string;
}

interface CalendarDayDetailModalProps {
  date?: string;
  users?: CalendarDayUser[];
  onClose: () => void;
  onViewDetail: (user: CalendarDayUser) => void;
}

const TYPE_COLORS: Record<string, string> = {
  AL: '#3b82f6',
  SL: '#10b981',
  ML: '#f97316',
  WFH: '#8b5cf6',
  CO: '#1DB87A',
  PL: '#6b7280',
  CSL: '#ec4899',
  UL: '#f59e0b',
  BT: '#0ea5e9',
};

function formatDateVN(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function CalendarDayDetailModal({
  date,
  users,
  onClose,
  onViewDetail,
}: CalendarDayDetailModalProps) {
  if (!date || !users || users.length === 0) return null;

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const approvedUsers = users.filter((u) => u.status === 'approved');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,71,78,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: '#D3F2E7' }}
            >
              <Calendar size={24} style={{ color: '#1DB87A' }} />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ color: '#203430' }}>
                Lịch nghỉ phép
              </h2>
              <p className="text-sm font-medium" style={{ color: '#6b7f78' }}>
                {formatDateVN(date)} · {users.length} nhân viên
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
            style={{ color: '#6b7f78' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary Stats */}
        <div
          className="px-6 py-4 border-b grid grid-cols-2 gap-4 shrink-0"
          style={{ borderColor: '#e2ede9', background: '#f8faf9' }}
        >
          <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: '#dcfce7' }}>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: '#bbf7d0' }}
            >
              <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#15803d' }}>
                {approvedUsers.length}
              </p>
              <p className="text-xs font-medium" style={{ color: '#15803d' }}>
                Đã duyệt
              </p>
            </div>
          </div>
          <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: '#fef9c3' }}>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: '#fef3c7' }}
            >
              <Clock size={20} style={{ color: '#d97706' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#92400e' }}>
                {pendingUsers.length}
              </p>
              <p className="text-xs font-medium" style={{ color: '#92400e' }}>
                Chờ duyệt
              </p>
            </div>
          </div>
        </div>

        {/* User List - Redesigned */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {users.map((user, index) => {
            const typeColor =
              user.leaveType?.color || TYPE_COLORS[user.leaveType?.code || ''] || '#6b7280';
            const isApproved = user.status === 'approved';

            return (
              <div
                key={index}
                className="rounded-xl border-2 transition-all hover:shadow-lg cursor-pointer group"
                style={{
                  borderColor: isApproved ? '#bbf7d0' : '#fef9c3',
                  background: isApproved ? '#f0fdf9' : '#fffbeb',
                }}
                onClick={() => onViewDetail(user)}
              >
                {/* Main Info Row */}
                <div className="p-4 flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
                  >
                    {getInitials(user.name)}
                  </div>

                  {/* Name & Leave Type */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-base truncate" style={{ color: '#203430' }}>
                        {user.name}
                      </h3>
                      {user.leaveType && (
                        <span
                          className="text-xs px-2.5 py-1 rounded-lg font-bold shrink-0"
                          style={{ background: typeColor, color: '#fff' }}
                        >
                          {user.leaveType.code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: '#6b7f78' }}>
                      {user.department && (
                        <span className="flex items-center gap-1">
                          <span
                            className="w-1 h-1 rounded-full"
                            style={{ background: '#6b7f78' }}
                          />
                          {user.department}
                        </span>
                      )}
                      {user.position && (
                        <span className="flex items-center gap-1">
                          <span
                            className="w-1 h-1 rounded-full"
                            style={{ background: '#6b7f78' }}
                          />
                          {user.position}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{
                        background: isApproved ? '#d1fae5' : '#fef3c7',
                        color: isApproved ? '#059669' : '#d97706',
                      }}
                    >
                      {isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                    </span>
                    <ChevronRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1"
                      style={{ color: '#6b7f78' }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div
                  className="border-t mx-4"
                  style={{ borderColor: isApproved ? '#bbf7d0' : '#fef9c3' }}
                />

                {/* Details Row - Reason */}
                {user.reason && (
                  <div className="px-4 py-3 flex items-start gap-2">
                    <FileText size={14} style={{ color: '#6b7f78', marginTop: 3 }} />
                    <p className="text-sm" style={{ color: '#4b5563' }}>
                      {user.reason}
                    </p>
                  </div>
                )}

                {/* Details Row - Approver */}
                {user.approver && (
                  <div className="px-4 pb-3 flex items-center gap-2">
                    <User size={14} style={{ color: '#6b7f78' }} />
                    <p className="text-sm" style={{ color: '#6b7f78' }}>
                      Người duyệt:{' '}
                      <span className="font-semibold" style={{ color: '#203430' }}>
                        {user.approver}
                      </span>
                    </p>
                  </div>
                )}

                {/* Empty state */}
                {!user.reason && !user.approver && (
                  <div className="px-4 pb-3">
                    <p className="text-sm italic" style={{ color: '#9ca3af' }}>
                      Không có lý do
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end px-6 py-4 border-t shrink-0"
          style={{ borderColor: '#e2ede9' }}
        >
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-gray-50 border"
            style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
