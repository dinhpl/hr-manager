import { Response } from 'express';
import { SerializedNotification } from './notifications.types';

type NotificationEvent =
  | { type: 'notification.created'; notification: SerializedNotification; unreadCount: number }
  | { type: 'notification.read'; notificationId: string; unreadCount: number }
  | { type: 'notification.read-all'; unreadCount: number }
  | { type: 'connected' };

const connections = new Map<string, Set<Response>>();

function writeEvent(res: Response, event: NotificationEvent) {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function registerNotificationStream(userId: bigint, res: Response) {
  const key = userId.toString();
  const bucket = connections.get(key) ?? new Set<Response>();
  bucket.add(res);
  connections.set(key, bucket);

  writeEvent(res, { type: 'connected' });

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    const currentBucket = connections.get(key);
    if (!currentBucket) return;
    currentBucket.delete(res);
    if (currentBucket.size === 0) {
      connections.delete(key);
    }
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);
}

export function publishNotificationCreated(
  userId: bigint,
  notification: SerializedNotification,
  unreadCount: number,
) {
  const key = userId.toString();
  const bucket = connections.get(key);
  if (!bucket) return;
  for (const res of bucket) {
    writeEvent(res, { type: 'notification.created', notification, unreadCount });
  }
}

export function publishNotificationRead(
  userId: bigint,
  notificationId: bigint,
  unreadCount: number,
) {
  const key = userId.toString();
  const bucket = connections.get(key);
  if (!bucket) return;
  for (const res of bucket) {
    writeEvent(res, {
      type: 'notification.read',
      notificationId: notificationId.toString(),
      unreadCount,
    });
  }
}

export function publishNotificationReadAll(userId: bigint, unreadCount: number) {
  const key = userId.toString();
  const bucket = connections.get(key);
  if (!bucket) return;
  for (const res of bucket) {
    writeEvent(res, { type: 'notification.read-all', unreadCount });
  }
}
