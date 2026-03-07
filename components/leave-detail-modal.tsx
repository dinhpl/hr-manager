'use client';

import { X, Calendar, Clock, User, FileText, CheckCircle2, AlertCircle, Info } from 'lucide-react';

/** Normalized shape accepted by the modal — adapters in each page convert to this */
export interface LeaveDetailData {
  id: string;
  typeCode: string;
  typeColor?: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason?: string;
  handover?: string;
  status: string;
  submittedAt?: string;
  approver?: string;
  approverRole?: string;
  approvedAt?: string;
  /** Shown when viewing from the approval context */
  employeeName?: string;
  employeeCode?: string;
  employeeTeam?: string;
  leaveBalance?: string;
  fileAttachment?: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Nháp', bg: '#f3f4f6', color: '#6b7280' },
  pending: { label: 'Chờ duyệt', bg: '#fef3c7', color: '#d97706' },
  approved: { label: 'Đã duyệt', bg: '#d1fae5', color: '#059669' },
  hr_confirm: { label: 'HR xác nhận', bg: '#dbeafe', color: '#2563eb' },
  rejected: { label: 'Từ chối', bg: '#fee2e2', color: '#dc2626' },
};

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

interface LeaveDetailModalProps {
  data: LeaveDetailData | null;
  onClose: () => void;
}

export default function LeaveDetailModal({ data, onClose }: LeaveDetailModalProps) {
  if (!data) return null;

  const statusInfo = STATUS_CONFIG[data.status] ?? {
    label: data.status,
    bg: '#f3f4f6',
    color: '#6b7280',
  };
  const typeColor = data.typeColor ?? TYPE_COLORS[data.typeCode] ?? '#6b7280';
  const isApproved = data.status === 'approved' || data.status === 'hr_confirm';
  const isRejected = data.status === 'rejected';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,71,78,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="px-2.5 py-1 rounded-lg text-white text-xs font-bold"
              style={{ background: typeColor }}
            >
              {data.typeCode}
            </span>
            <span className="font-bold text-base" style={{ color: '#203430' }}>
              Yêu cầu #{data.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: statusInfo.bg, color: statusInfo.color }}
            >
              {statusInfo.label}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
              style={{ color: '#6b7f78' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Employee info — shown in approval context */}
          {data.employeeName && (
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: '#f0f9f5' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
              >
                {data.employeeName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#203430' }}>
                  {data.employeeName}
                  {data.employeeCode && (
                    <span className="font-normal ml-1" style={{ color: '#6b7f78' }}>
                      ({data.employeeCode})
                    </span>
                  )}
                </p>
                {data.employeeTeam && (
                  <p className="text-xs truncate" style={{ color: '#6b7f78' }}>
                    {data.employeeTeam}
                  </p>
                )}
              </div>
              {data.leaveBalance && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs" style={{ color: '#6b7f78' }}>
                    Phép còn lại
                  </p>
                  <p className="font-bold" style={{ color: '#1DB87A' }}>
                    {data.leaveBalance} ngày
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Leave period */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={15} style={{ color: '#1DB87A' }} />
              <span className="font-semibold text-sm" style={{ color: '#203430' }}>
                Thời gian nghỉ
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl" style={{ background: '#f7f7f7' }}>
                <p className="text-xs mb-1" style={{ color: '#6b7f78' }}>
                  Từ ngày
                </p>
                <p className="font-semibold text-sm" style={{ color: '#203430' }}>
                  {data.fromDate}
                </p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: '#f7f7f7' }}>
                <p className="text-xs mb-1" style={{ color: '#6b7f78' }}>
                  Đến ngày
                </p>
                <p className="font-semibold text-sm" style={{ color: '#203430' }}>
                  {data.toDate}
                </p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: '#D3F2E7' }}>
                <p className="text-xs mb-1" style={{ color: '#0E474E' }}>
                  Số ngày
                </p>
                <p className="font-bold text-lg" style={{ color: '#1DB87A' }}>
                  {data.days}
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          {data.reason && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Info size={15} style={{ color: '#1DB87A' }} />
                <span className="font-semibold text-sm" style={{ color: '#203430' }}>
                  Lý do
                </span>
              </div>
              <p
                className="text-sm p-3 rounded-xl"
                style={{ background: '#f7f7f7', color: '#6b7f78' }}
              >
                {data.reason}
              </p>
            </div>
          )}

          {/* Handover */}
          {data.handover && data.handover !== '-' && (
            <div className="flex items-center gap-2">
              <User size={15} style={{ color: '#1DB87A' }} />
              <span className="text-sm" style={{ color: '#6b7f78' }}>
                Người bàn giao:
              </span>
              <span className="text-sm font-semibold" style={{ color: '#203430' }}>
                {data.handover}
              </span>
            </div>
          )}

          {/* File attachment */}
          {data.fileAttachment && (
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color: '#1DB87A' }} />
              <span className="text-sm" style={{ color: '#6b7f78' }}>
                File đính kèm:
              </span>
              <span className="text-sm font-semibold" style={{ color: '#3b82f6' }}>
                {data.fileAttachment}
              </span>
            </div>
          )}

          {/* Submitted at */}
          {data.submittedAt && (
            <div className="flex items-center gap-2">
              <Clock size={15} style={{ color: '#1DB87A' }} />
              <span className="text-sm" style={{ color: '#6b7f78' }}>
                Ngày gửi:
              </span>
              <span className="text-sm font-medium" style={{ color: '#203430' }}>
                {data.submittedAt}
              </span>
            </div>
          )}

          {/* Approval history */}
          {data.approver && data.approver !== '-' && (
            <div
              className="p-4 rounded-xl border"
              style={{
                borderColor: '#e2ede9',
                background: isApproved ? '#f0fdf9' : isRejected ? '#fef2f2' : '#f7f7f7',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {isRejected ? (
                  <AlertCircle size={15} style={{ color: '#ef4444' }} />
                ) : (
                  <CheckCircle2 size={15} style={{ color: '#1DB87A' }} />
                )}
                <span className="font-semibold text-sm" style={{ color: '#203430' }}>
                  {isRejected ? 'Từ chối bởi' : 'Được duyệt bởi'}
                </span>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                {data.approver}
              </p>
              {data.approverRole && (
                <p className="text-xs" style={{ color: '#6b7f78' }}>
                  {data.approverRole}
                </p>
              )}
              {data.approvedAt && data.approvedAt !== '-' && (
                <p className="text-xs mt-1" style={{ color: '#6b7f78' }}>
                  Thời gian: {data.approvedAt}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t" style={{ borderColor: '#e2ede9' }}>
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
