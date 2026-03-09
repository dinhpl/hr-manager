'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { toast } from 'sonner';
import {
  apiClient,
  clearAuthSession,
  getApiBaseUrl,
  getStoredToken,
  refreshAccessToken,
} from '@/lib/api-client';
import { NotificationItem, getNotificationHref } from '@/lib/notification-utils';

type NotificationListResponse = {
  nextCursor: string | null;
};

type NotificationCreatedEvent = {
  type: 'notification.created';
  notification: NotificationItem;
  unreadCount: number;
};

type NotificationReadEvent = {
  type: 'notification.read';
  notificationId: string;
  unreadCount: number;
};

type NotificationReadAllEvent = {
  type: 'notification.read-all';
  unreadCount: number;
};

type NotificationStreamEvent =
  | NotificationCreatedEvent
  | NotificationReadEvent
  | NotificationReadAllEvent
  | { type: 'connected' };

function upsertNotification(items: NotificationItem[], notification: NotificationItem) {
  const filtered = items.filter((item) => item.id !== notification.id);
  return [notification, ...filtered].slice(0, 20);
}

export function useNotifications(enabled = true) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    try {
      const [listResponse, unreadResponse] = await Promise.all([
        apiClient.get<NotificationItem[]>('/api/notifications', { params: { limit: 10 } }),
        apiClient.get<{ unreadCount: number }>('/api/notifications/unread-count'),
      ]);

      setItems(listResponse.data ?? []);
      setUnreadCount(unreadResponse.data?.unreadCount ?? 0);
      setNextCursor(
        (listResponse.meta as NotificationListResponse | undefined)?.nextCursor ?? null,
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  const markAsRead = useCallback(async (id: string) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    const response = await apiClient.patch<{ id: string; unreadCount: number }>(
      `/api/notifications/${id}/read`,
    );
    setUnreadCount(response.data?.unreadCount ?? 0);
  }, []);

  const markAllAsRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    const response = await apiClient.patch<{ unreadCount: number }>('/api/notifications/read-all');
    setUnreadCount(response.data?.unreadCount ?? 0);
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const response = await apiClient.get<NotificationItem[]>('/api/notifications', {
      params: { limit: 10, cursor: nextCursor },
    });
    setItems((current) => [...current, ...(response.data ?? [])]);
    setNextCursor((response.meta as NotificationListResponse | undefined)?.nextCursor ?? null);
  }, [nextCursor]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    abortRef.current = controller;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async (tokenOverride?: string | null) => {
      setIsConnecting(true);
      let token = tokenOverride ?? getStoredToken();

      if (!token) {
        token = await refreshAccessToken();
      }

      if (!token || !active) {
        setIsConnecting(false);
        return;
      }

      try {
        await fetchEventSource(`${getApiBaseUrl()}/api/notifications/stream`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          signal: controller.signal,
          openWhenHidden: true,
          async onopen(response) {
            if (response.ok) {
              setIsConnecting(false);
              return;
            }

            if (response.status === 401) {
              const refreshed = await refreshAccessToken();
              if (refreshed) {
                throw new Error(`retry-auth:${refreshed}`);
              }

              clearAuthSession();
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
              throw new Error('unauthorized');
            }

            throw new Error(`stream-open-${response.status}`);
          },
          onmessage(message) {
            if (!message.data) return;
            const event = JSON.parse(message.data) as NotificationStreamEvent;

            if (event.type === 'notification.created') {
              setItems((current) => upsertNotification(current, event.notification));
              setUnreadCount(event.unreadCount);
              toast(event.notification.title, {
                description: event.notification.message,
                action: {
                  label: 'Mo',
                  onClick: () => {
                    window.location.href = getNotificationHref(event.notification);
                  },
                },
              });
              return;
            }

            if (event.type === 'connected') {
              void refresh();
              return;
            }

            if (event.type === 'notification.read') {
              setItems((current) =>
                current.map((item) =>
                  item.id === event.notificationId ? { ...item, isRead: true } : item,
                ),
              );
              setUnreadCount(event.unreadCount);
              return;
            }

            if (event.type === 'notification.read-all') {
              setItems((current) => current.map((item) => ({ ...item, isRead: true })));
              setUnreadCount(event.unreadCount);
            }
          },
          onerror(error) {
            if (!active || controller.signal.aborted) {
              return;
            }

            if (error instanceof Error && error.message === 'unauthorized') {
              return;
            }

            throw error;
          },
          onclose() {
            throw new Error('retry');
          },
        });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setIsConnecting(false);

        if (error instanceof Error && error.message === 'unauthorized') {
          return;
        }

        if (error instanceof Error && error.message.startsWith('retry-auth:')) {
          const refreshedToken = error.message.replace('retry-auth:', '');
          retryTimer = setTimeout(() => {
            void connect(refreshedToken);
          }, 250);
          return;
        }

        retryTimer = setTimeout(() => {
          void connect();
        }, 3000);
      }
    };

    void connect();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      controller.abort();
      abortRef.current = null;
    };
  }, [enabled, refresh]);

  return useMemo(
    () => ({
      items,
      unreadCount,
      isLoading,
      isConnecting,
      refresh,
      markAsRead,
      markAllAsRead,
      loadMore,
      hasMore: Boolean(nextCursor),
    }),
    [
      isConnecting,
      isLoading,
      items,
      loadMore,
      markAllAsRead,
      markAsRead,
      nextCursor,
      refresh,
      unreadCount,
    ],
  );
}
