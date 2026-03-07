'use client';

import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,71,78,0.45)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: danger ? '#fee2e2' : '#D3F2E7' }}
          >
            <AlertTriangle size={18} style={{ color: danger ? '#ef4444' : '#1DB87A' }} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base mb-1" style={{ color: '#203430' }}>
              {title}
            </h3>
            <p className="text-sm" style={{ color: '#6b7f78' }}>
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50"
            style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: danger ? '#ef4444' : '#1DB87A' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
