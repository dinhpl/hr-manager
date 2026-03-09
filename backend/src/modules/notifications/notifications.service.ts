import { NotificationEntityType, NotificationType, UserRole } from '@prisma/client';
import prisma from '../../config/prisma';
import {
  publishNotificationCreated,
  publishNotificationRead,
  publishNotificationReadAll,
} from './notifications.stream';
import { NotificationPayload, SerializedNotification } from './notifications.types';
import { ListNotificationsQuery } from './notifications.validation';

type AuthUser = {
  id: bigint;
  role: UserRole;
};

function serializeNotification(notification: {
  id: bigint;
  type: NotificationType;
  title: string;
  message: string;
  entityType: NotificationEntityType;
  entityId: bigint | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}): SerializedNotification {
  return {
    id: notification.id.toString(),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId ? notification.entityId.toString() : null,
    isRead: notification.isRead,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function listNotifications(userId: bigint, query: ListNotificationsQuery) {
  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit,
    ...(query.cursor
      ? {
          cursor: { id: query.cursor },
          skip: 1,
        }
      : {}),
  });

  return {
    items: items.map(serializeNotification),
    nextCursor:
      items.length === query.limit ? (items[items.length - 1]?.id.toString() ?? null) : null,
  };
}

export async function getUnreadCount(userId: bigint) {
  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });
  return { unreadCount };
}

export async function markAsRead(notificationId: bigint, user: AuthUser) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== user.id) {
    throw Object.assign(new Error('Notification not found'), { status: 404 });
  }

  if (!notification.isRead) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });
  publishNotificationRead(user.id, notificationId, unreadCount);
  return { id: notificationId.toString(), unreadCount };
}

export async function markAllAsRead(userId: bigint) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  publishNotificationReadAll(userId, 0);
  return { unreadCount: 0 };
}

export async function createNotification(payload: NotificationPayload) {
  const notification = await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      entityType: payload.entityType,
      entityId: payload.entityId ?? null,
    },
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: payload.userId, isRead: false },
  });
  const serialized = serializeNotification(notification);
  publishNotificationCreated(payload.userId, serialized, unreadCount);
  return serialized;
}

export async function createManyNotifications(payloads: NotificationPayload[]) {
  if (payloads.length === 0) return [];

  const created: SerializedNotification[] = [];
  for (const payload of payloads) {
    created.push(await createNotification(payload));
  }
  return created;
}

export function buildLeaveRequestNotification(params: {
  recipientUserId: bigint;
  type: NotificationType;
  requestId: bigint;
  actorName: string;
  requesterName: string;
  leaveTypeName: string;
  fromDateLabel: string;
  toDateLabel: string;
}) {
  const rangeLabel =
    params.fromDateLabel === params.toDateLabel
      ? params.fromDateLabel
      : `${params.fromDateLabel} - ${params.toDateLabel}`;

  const templateMap: Record<NotificationType, { title: string; message: string }> = {
    LEAVE_REQUEST_CREATED: {
      title: 'Có yêu cầu nghỉ phép mới',
      message: `${params.requesterName} vừa gửi đơn ${params.leaveTypeName} (${rangeLabel}).`,
    },
    LEAVE_REQUEST_APPROVED: {
      title: 'Đơn nghỉ phép đã được duyệt',
      message: `${params.actorName} đã duyệt đơn ${params.leaveTypeName} (${rangeLabel}).`,
    },
    LEAVE_REQUEST_REJECTED: {
      title: 'Đơn nghỉ phép bị từ chối',
      message: `${params.actorName} đã từ chối đơn ${params.leaveTypeName} (${rangeLabel}).`,
    },
    LEAVE_REQUEST_CANCELLED: {
      title: 'Đơn nghỉ phép đã bị hủy',
      message: `${params.actorName} đã hủy đơn ${params.leaveTypeName} (${rangeLabel}).`,
    },
    OVERTIME_CREATED: { title: '', message: '' },
    OVERTIME_APPROVED: { title: '', message: '' },
    OVERTIME_REJECTED: { title: '', message: '' },
  };

  const template = templateMap[params.type];

  return {
    userId: params.recipientUserId,
    type: params.type,
    title: template.title,
    message: template.message,
    entityType: 'LEAVE_REQUEST' as NotificationEntityType,
    entityId: params.requestId,
  } satisfies NotificationPayload;
}

export function buildOvertimeNotification(params: {
  recipientUserId: bigint;
  type: NotificationType;
  overtimeId: bigint;
  actorName: string;
  requesterName: string;
  dateLabel: string;
  hours: number;
}) {
  const templateMap: Record<NotificationType, { title: string; message: string }> = {
    LEAVE_REQUEST_CREATED: { title: '', message: '' },
    LEAVE_REQUEST_APPROVED: { title: '', message: '' },
    LEAVE_REQUEST_REJECTED: { title: '', message: '' },
    LEAVE_REQUEST_CANCELLED: { title: '', message: '' },
    OVERTIME_CREATED: {
      title: 'Có phiếu overtime mới',
      message: `${params.requesterName} vừa gửi phiếu overtime ${params.hours} giờ cho ngày ${params.dateLabel}.`,
    },
    OVERTIME_APPROVED: {
      title: 'Phiếu overtime đã được duyệt',
      message: `${params.actorName} đã duyệt phiếu overtime ${params.hours} giờ ngày ${params.dateLabel}.`,
    },
    OVERTIME_REJECTED: {
      title: 'Phiếu overtime bị từ chối',
      message: `${params.actorName} đã từ chối phiếu overtime ${params.hours} giờ ngày ${params.dateLabel}.`,
    },
  };

  const template = templateMap[params.type];
  return {
    userId: params.recipientUserId,
    type: params.type,
    title: template.title,
    message: template.message,
    entityType: 'OVERTIME' as NotificationEntityType,
    entityId: params.overtimeId,
  } satisfies NotificationPayload;
}
