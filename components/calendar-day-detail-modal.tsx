'use client';

import { X, Calendar, User, FileText, CheckCircle2, Clock } from 'lucide-react';

export interface CalendarDayUser {
  name: string;
  status: 'approved' | 'pending';
  reason?: string;
  leaveType?: { code: string; name: string; color: string };
  approver?: string;
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#D3F2E7' }}
            >
              <Calendar size={20} style={{ color: '#1DB87A' }} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: '#203430' }}>
                Lịch nghỉ phép
              </h2>
              <p className="text-sm" style={{ color: '#6b7f78' }}>
                {formatDateVN(date)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            style={{ color: '#6b7f78' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Summary */}
          <div className="flex gap-3 mb-5">
            {approvedUsers.length > 0 && (
              <div
                className="flex-1 p-3 rounded-xl flex items-center gap-2"
                style={{ background: '#dcfce7' }}
              >
                <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                <span className="text-sm font-semibold" style={{ color: '#15803d' }}>
                  {approvedUsers.length} Đã duyệt
                </span>
              </div>
            )}
            {pendingUsers.length > 0 && (
              <div
                className="flex-1 p-3 rounded-xl flex items-center gap-2"
                style={{ background: '#fef9c3' }}
              >
                <Clock size={18} style={{ color: '#d97706' }} />
                <span className="text-sm font-semibold" style={{ color: '#92400e' }}>
                  {pendingUsers.length} Chờ duyệt
                </span>
              </div>
            )}
          </div>

          {/* User list */}
          <div className="space-y-3">
            {users.map((user, index) => {
              const typeColor =
                user.leaveType?.color || TYPE_COLORS[user.leaveType?.code || ''] || '#6b7280';
              const isApproved = user.status === 'approved';

              return (
                <div
                  key={index}
                  className="p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer"
                  style={{
                    borderColor: isApproved ? '#bbf7d0' : '#fef9c3',
                    background: isApproved ? '#f0fdf9' : '#fffbeb',
                  }}
                  onClick={() => onViewDetail(user)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: '#203430' }}>
                          {user.name}
                        </p>
                        {user.leaveType && (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ background: typeColor, color: '#fff' }}
                          >
                            {user.leaveType.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: isApproved ? '#d1fae5' : '#fef3c7',
                        color: isApproved ? '#059669' : '#d97706',
                      }}
                    >
                      {isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                    </span>
                  </div>

                  {user.reason && (
                    <div className="flex items-start gap-2 mt-2">
                      <FileText size={14} style={{ color: '#6b7f78' }} />
                      <p className="text-xs" style={{ color: '#6b7f78' }}>
                        {user.reason}
                      </p>
                    </div>
                  )}

                  {user.approver && (
                    <div className="flex items-center gap-2 mt-2">
                      <User size={14} style={{ color: '#6b7f78' }} />
                      <p className="text-xs" style={{ color: '#6b7f78' }}>
                        Người duyệt:{' '}
                        <span className="font-medium" style={{ color: '#203430' }}>
                          {user.approver}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end px-6 py-4 border-t shrink-0"
          style={{ borderColor: '#e2ede9' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-gray-50 border"
            style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
