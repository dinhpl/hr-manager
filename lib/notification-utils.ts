export type NotificationEntityType = 'LEAVE_REQUEST' | 'OVERTIME';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: NotificationEntityType;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export function getNotificationHref(notification: NotificationItem) {
  switch (notification.entityType) {
    case 'LEAVE_REQUEST':
      if (notification.type === 'LEAVE_REQUEST_CREATED') {
        return '/dashboard/approval';
      }
      return '/dashboard/leave-history';
    case 'OVERTIME':
      return '/dashboard/overtime';
    default:
      return '/dashboard';
  }
}

export function formatNotificationTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 60_000) return 'Vừa xong';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} phút trước`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} giờ trước`;
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}
