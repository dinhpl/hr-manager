'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  FileText,
  Info,
  Pencil,
  User,
  XCircle,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, getApiBaseUrl, getStoredUser, clearAuthSession } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatDateTimeVN, formatDateVN, numberValue, toFrontendRole } from '@/lib/hr-utils';
import type { FrontendRole } from '@/lib/hr-utils';
import LeaveRequestModal, { LeaveRequestData } from '@/components/leave-request-modal';

interface LeaveRequestDetail {
  id: string;
  status: string;
  fromDate: string;
  toDate: string;
  totalDays: number | string;
  durationMode?: string | null;
  reason?: string | null;
  attachmentUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string | null;
  approvedNote?: string | null;
  user?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
    department?: string | null;
    managerId?: string | null;
  };
  leaveType?: {
    id?: string;
    code?: string | null;
    name?: string | null;
    color?: string | null;
  };
  approver?: { id?: string; fullName?: string | null } | null;
  handoverPerson?: { id?: string; fullName?: string | null } | null;
}

interface UserInfo {
  id: string;
  role: string;
}

type StatusKey = 'pending' | 'approved' | 'rejected' | 'cancelled';

const STATUS_CONFIG: Record<StatusKey, { label: string; bg: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Chờ duyệt', bg: '#fef3c7', color: '#d97706', icon: Clock },
  approved: { label: 'Đã duyệt', bg: '#d1fae5', color: '#059669', icon: CheckCircle2 },
  rejected: { label: 'Từ chối', bg: '#fee2e2', color: '#dc2626', icon: XCircle },
  cancelled: { label: 'Đã hủy', bg: '#f3f4f6', color: '#6b7280', icon: AlertCircle },
};

const TYPE_COLORS: Record<string, string> = {
  AL: '#3b82f6', SL: '#10b981', ML: '#f97316', WFH: '#8b5cf6',
  CO: '#1DB87A', PL: '#6b7280', CSL: '#ec4899', UL: '#f59e0b', BT: '#0ea5e9',
};

const DURATION_LABELS: Record<string, string> = {
  FULL_DAY: 'Cả ngày',
  HALF_DAY_AM: 'Nửa ngày (sáng)',
  HALF_DAY_PM: 'Nửa ngày (chiều)',
  HOURLY: 'Theo giờ',
};

function normalizeStatus(status?: string | null): StatusKey {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED': return 'approved';
    case 'REJECTED': return 'rejected';
    case 'CANCELLED': return 'cancelled';
    default: return 'pending';
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function LeaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [data, setData] = useState<LeaveRequestDetail | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<LeaveRequestData | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const { openConfirm, confirmDialog } = useConfirmDialog();

  const loadUser = useCallback(async () => {
    try {
      const stored = getStoredUser<UserInfo>();
      if (stored) { setUserInfo(stored); return; }
      const res = await apiClient.get<UserInfo>('/api/auth/me');
      setUserInfo(res.data);
    } catch {
      clearAuthSession();
      router.replace('/');
    }
  }, [router]);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<LeaveRequestDetail>(`/api/leave-requests/${requestId}`);
      setData(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không tải được yêu cầu nghỉ phép.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { void loadUser(); }, [loadUser]);
  useEffect(() => { void loadRequest(); }, [loadRequest]);

  const role = toFrontendRole(userInfo?.role);
  const statusKey = normalizeStatus(data?.status);
  const statusInfo = STATUS_CONFIG[statusKey];
  const typeColor = data?.leaveType?.color ?? TYPE_COLORS[data?.leaveType?.code ?? ''] ?? '#6b7280';
  const isPending = statusKey === 'pending';
  const isOwner = userInfo?.id === data?.user?.id;
  const isEmployee = role === 'employee';

  const canApprove =
    isPending && !isEmployee && (role === 'hr' || role === 'admin' || (role === 'manager' && !isOwner));
  const canEdit = role === 'hr' || role === 'admin';
  const canCancel = isEmployee && isOwner && isPending;
  console.log('userInfo: ', userInfo)
  const handleCopyLink = () => {
    const url = `${window.location.origin}/dashboard/leave-detail/${requestId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success('Đã sao chép link');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleApprove = async () => {
    if (!canApprove) {
      toast.error('Bạn không có quyền duyệt yêu cầu này');
      return;
    }
    setConfirmAction(null);
    setActionLoading(true);
    try {
      await apiClient.patch(`/api/leave-requests/${requestId}/approve`, { note: actionNote || undefined });
      toast.success('Đã duyệt yêu cầu');
      setActionNote('');
      void loadRequest();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể duyệt yêu cầu');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!canApprove) {
      toast.error('Bạn không có quyền từ chối yêu cầu này');
      setConfirmAction(null);
      return;
    }
    setConfirmAction(null);
    setActionLoading(true);
    try {
      await apiClient.patch(`/api/leave-requests/${requestId}/reject`, { note: actionNote || undefined });
      toast.success('Đã từ chối yêu cầu');
      setActionNote('');
      void loadRequest();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể từ chối yêu cầu');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!canCancel) {
      toast.error('Bạn không có quyền hủy yêu cầu này');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.patch(`/api/leave-requests/${requestId}/cancel`);
      toast.success('Đã hủy yêu cầu');
      void loadRequest();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể hủy yêu cầu');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = () => {
    if (!data) return;
    setEditData({
      id: String(data.id),
      typeCode: data.leaveType?.code || '',
      fromDate: data.fromDate?.slice(0, 10) || '',
      toDate: data.toDate?.slice(0, 10) || '',
      durationMode: (data.durationMode as import('@/lib/hr-utils').LeaveRequestMode) || 'FULL_DAY',
      reason: data.reason || '',
      handoverPersonId: data.handoverPerson?.id ? String(data.handoverPerson.id) : '',
      approverId: data.approver?.id ? String(data.approver.id) : '',
    });
    setEditModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Đang tải chi tiết yêu cầu...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          {error || 'Không tìm thấy yêu cầu nghỉ phép.'}
        </div>
        <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: '#1DB87A' }}>
          <ArrowLeft size={14} /> Quay lại Dashboard
        </Link>
      </div>
    );
  }

  const employeeName = data.user?.fullName?.trim() || data.user?.username?.trim() || 'Nhân viên';
  const StatusIcon = statusInfo.icon;

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Breadcrumb + copy link */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:underline">Dashboard</Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold" style={{ color: '#203430' }}>Yêu cầu #{data.id}</span>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: '#e2ede9', color: copied ? '#059669' : '#6b7f78' }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Đã sao chép' : 'Sao chép link'}
          </button>
        </div>

        {/* Header card */}
        <div className="rounded-xl bg-white p-5 shadow-sm sm:p-6" style={{ border: '1px solid #e2ede9' }}>
          <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-white text-xs font-bold" style={{ background: typeColor }}>
                {data.leaveType?.code || '?'}
              </span>
              <div>
                <h1 className="text-lg font-bold" style={{ color: '#203430' }}>
                  {data.leaveType?.name || 'Nghỉ phép'} — #{data.id}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {DURATION_LABELS[data.durationMode || 'FULL_DAY'] || data.durationMode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon size={16} style={{ color: statusInfo.color }} />
              <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                {statusInfo.label}
              </span>
            </div>
          </div>

          {/* Employee info */}
          <div className="flex items-center gap-3 p-3 rounded-xl mb-5" style={{ background: '#f0f9f5' }}>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
            >
              {getInitials(employeeName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate" style={{ color: '#203430' }}>{employeeName}</p>
              {data.user?.department && <p className="text-xs" style={{ color: '#6b7f78' }}>{data.user.department}</p>}
            </div>
          </div>

          {/* Leave period */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={15} style={{ color: '#1DB87A' }} />
              <span className="font-semibold text-sm" style={{ color: '#203430' }}>Thời gian nghỉ</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl" style={{ background: '#f7f7f7' }}>
                <p className="text-xs mb-1" style={{ color: '#6b7f78' }}>Từ ngày</p>
                <p className="font-semibold text-sm" style={{ color: '#203430' }}>{formatDateVN(data.fromDate)}</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: '#f7f7f7' }}>
                <p className="text-xs mb-1" style={{ color: '#6b7f78' }}>Đến ngày</p>
                <p className="font-semibold text-sm" style={{ color: '#203430' }}>{formatDateVN(data.toDate)}</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: '#D3F2E7' }}>
                <p className="text-xs mb-1" style={{ color: '#0E474E' }}>Số ngày</p>
                <p className="font-bold text-lg" style={{ color: '#1DB87A' }}>{numberValue(data.totalDays)}</p>
              </div>
            </div>
          </div>

          {/* Reason */}
          {data.reason && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Info size={15} style={{ color: '#1DB87A' }} />
                <span className="font-semibold text-sm" style={{ color: '#203430' }}>Lý do</span>
              </div>
              <p className="text-sm p-3 rounded-xl" style={{ background: '#f7f7f7', color: '#6b7f78' }}>{data.reason}</p>
            </div>
          )}

          {/* Handover + Attachment */}
          <div className="space-y-2 mb-5">
            {data.handoverPerson?.fullName && (
              <div className="flex items-center gap-2">
                <User size={15} style={{ color: '#1DB87A' }} />
                <span className="text-sm" style={{ color: '#6b7f78' }}>Người bàn giao:</span>
                <span className="text-sm font-semibold" style={{ color: '#203430' }}>{data.handoverPerson.fullName}</span>
              </div>
            )}
            {data.attachmentUrl && (
              <div className="flex items-center gap-2">
                <FileText size={15} style={{ color: '#1DB87A' }} />
                <span className="text-sm" style={{ color: '#6b7f78' }}>File đính kèm:</span>
                <a
                  href={`${getApiBaseUrl()}/uploads/leave-attachments/${data.attachmentUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold hover:underline"
                  style={{ color: '#3b82f6' }}
                >
                  {data.attachmentUrl}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock size={15} style={{ color: '#1DB87A' }} />
              <span className="text-sm" style={{ color: '#6b7f78' }}>Ngày gửi:</span>
              <span className="text-sm font-medium" style={{ color: '#203430' }}>{formatDateTimeVN(data.createdAt)}</span>
            </div>
          </div>

          {/* Approval info */}
          {data.approver?.fullName && (
            <div
              className="p-4 rounded-xl border mb-5"
              style={{
                borderColor: '#e2ede9',
                background: statusKey === 'approved' ? '#f0fdf9' : statusKey === 'rejected' ? '#fef2f2' : '#f7f7f7',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {statusKey === 'rejected' ? <AlertCircle size={15} style={{ color: '#ef4444' }} /> : <CheckCircle2 size={15} style={{ color: '#1DB87A' }} />}
                <span className="font-semibold text-sm" style={{ color: '#203430' }}>
                  {statusKey === 'rejected' ? 'Từ chối bởi' : statusKey === 'approved' ? 'Được duyệt bởi' : 'Người duyệt'}
                </span>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#203430' }}>{data.approver.fullName}</p>
              {data.approvedAt && <p className="text-xs mt-1" style={{ color: '#6b7f78' }}>Thời gian: {formatDateTimeVN(data.approvedAt)}</p>}
              {data.approvedNote && <p className="text-xs mt-1 italic" style={{ color: '#6b7f78' }}>Ghi chú: {data.approvedNote}</p>}
            </div>
          )}
        </div>

        {/* Action buttons — chỉ hiện với owner hoặc người có quyền action */}
        {(canApprove || canEdit || canCancel) && (
        <div className="rounded-xl bg-white p-5 shadow-sm sm:p-6 space-y-4" style={{ border: '1px solid #e2ede9' }}>
          <h3 className="text-sm font-bold" style={{ color: '#203430' }}>Thao tác</h3>

          {canApprove && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6b7f78' }}>Ghi chú</label>
                <input
                  type="text"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Nhập ghi chú..."
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#1DB87A] focus:ring-2 focus:ring-[#1DB87A]/20"
                  style={{ borderColor: '#e2ede9' }}
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setConfirmAction('approve')}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#059669' }}
                >
                  <Check size={14} /> Duyệt
                </button>
                <button
                  onClick={() => setConfirmAction('reject')}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#dc2626' }}
                >
                  <X size={14} /> Từ chối
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {canEdit && (
              <button
                onClick={handleOpenEdit}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
              >
                <Pencil size={14} /> Chỉnh sửa
              </button>
            )}
            {canCancel && (
              <button
                onClick={() =>
                  openConfirm({
                    title: 'Xác nhận hủy yêu cầu',
                    message:
                      'Bạn có chắc muốn hủy yêu cầu nghỉ phép này? Chỉ yêu cầu đang chờ duyệt mới có thể hủy.',
                    danger: true,
                    confirmLabel: 'Hủy yêu cầu',
                    onConfirm: handleCancel,
                  })
                }
                disabled={actionLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
              >
                <XCircle size={14} /> Hủy yêu cầu
              </button>
            )}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
            >
              <Copy size={13} /> Sao chép link
            </button>
          </div>
        </div>
        )}

        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
          style={{ color: '#1DB87A' }}
        >
          <ArrowLeft size={14} /> Quay lại Dashboard
        </Link>
      </div>

      <LeaveRequestModal
        isOpen={editModalOpen}
        editData={editData}
        onClose={() => { setEditModalOpen(false); setEditData(null); }}
        onSubmitSuccess={() => {
          setEditData(null);
          void loadRequest();
        }}
      />

      {confirmDialog}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(14,71,78,0.45)' }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: confirmAction === 'approve' ? '#d1fae5' : '#fee2e2',
                }}
              >
                {confirmAction === 'approve' ? (
                  <CheckCircle2 size={20} style={{ color: '#059669' }} />
                ) : (
                  <XCircle size={20} style={{ color: '#dc2626' }} />
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: '#203430' }}>
                  {confirmAction === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: '#6b7f78' }}>
                  {confirmAction === 'approve'
                    ? `Bạn có chắc muốn duyệt yêu cầu #${data?.id} của ${data?.user?.fullName || 'nhân viên'}?`
                    : `Bạn có chắc muốn từ chối yêu cầu #${data?.id} của ${data?.user?.fullName || 'nhân viên'}?`}
                </p>
                {confirmAction === 'approve' && actionNote.trim() && (
                  <p className="text-xs mt-1 italic" style={{ color: '#6b7f78' }}>Ghi chú: {actionNote}</p>
                )}
                {confirmAction === 'reject' && actionNote.trim() && (
                  <p className="text-xs mt-1 italic" style={{ color: '#dc2626' }}>Ghi chú: {actionNote}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
              >
                Hủy
              </button>
              <button
                onClick={confirmAction === 'approve' ? handleApprove : handleReject}
                disabled={actionLoading}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: confirmAction === 'approve' ? '#059669' : '#dc2626' }}
              >
                {confirmAction === 'approve' ? 'Duyệt' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
