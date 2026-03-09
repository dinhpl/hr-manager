import { NotificationEntityType, NotificationType } from '@prisma/client';

export type NotificationPayload = {
  userId: bigint;
  type: NotificationType;
  title: string;
  message: string;
  entityType: NotificationEntityType;
  entityId?: bigint | null;
};

export type SerializedNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: NotificationEntityType;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};
