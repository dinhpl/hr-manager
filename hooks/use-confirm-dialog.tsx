'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';

type ConfirmDialogConfig = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

export function useConfirmDialog() {
  const [config, setConfig] = useState<ConfirmDialogConfig | null>(null);

  const closeConfirm = useCallback(() => {
    setConfig((current) => {
      current?.onCancel?.();
      return null;
    });
  }, []);

  const openConfirm = useCallback((nextConfig: ConfirmDialogConfig) => {
    setConfig(nextConfig);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!config) return;
    const { onConfirm } = config;
    setConfig(null);
    void onConfirm();
  }, [config]);

  const confirmDialog = useMemo(
    () => (
      <ConfirmDialog
        open={!!config}
        title={config?.title || ''}
        message={config?.message || ''}
        confirmLabel={config?.confirmLabel}
        cancelLabel={config?.cancelLabel}
        danger={config?.danger}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
      />
    ),
    [closeConfirm, config, handleConfirm],
  );

  return {
    openConfirm,
    closeConfirm,
    confirmDialog,
  };
}
