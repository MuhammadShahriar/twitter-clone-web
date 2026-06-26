"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  HubConnectionBuilder,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";
import {
  getAccessTokenForSocket,
  getUnreadCount,
  markNotificationsRead,
  notificationsHubUrl,
  type Notification,
  type NotificationPush,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

interface NotificationsContextValue {
  /** Unread badge count — REST on load, live from SignalR pushes after. */
  unreadCount: number;
  /** Mark all notifications read (badge → 0). Resolves after the server confirms. */
  markAllRead: () => Promise<void>;
  /**
   * Subscribe to live `ReceiveNotification` pushes. The notifications list uses
   * this to prepend new rows while it's mounted. Returns an unsubscribe fn.
   */
  onNotification: (cb: (n: Notification) => void) => () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** A short, tasteful toast line for a freshly-arrived notification. */
function toastText(n: Notification): string {
  const who = n.actor.displayName;
  switch (n.type) {
    case "Like":
      return `${who} liked your post`;
    case "Retweet":
      return `${who} reposted your post`;
    case "Quote":
      return `${who} quoted your post`;
    case "Reply":
      return `${who} replied to your post`;
    case "Follow":
      return `${who} followed you`;
    case "Mention":
      return `${who} mentioned you`;
    default:
      return "New notification";
  }
}

/**
 * Owns the unread count and the SignalR connection lifecycle (Module 5C).
 *
 * Connection is tied to auth: it starts when logged in and stops on logout (or
 * unmount). `withAutomaticReconnect` handles transient drops; on each (re)connect
 * SignalR calls `accessTokenFactory` → `getAccessTokenForSocket`, which returns
 * the current in-memory JWT (refreshing first if missing/near-expiry) so the
 * socket always authenticates with a live token. After a reconnect the unread
 * count is re-synced over REST so nothing missed during the drop is lost.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);

  // Live-push subscribers (the mounted list registers a prepend handler).
  const listenersRef = useRef<Set<(n: Notification) => void>>(new Set());

  const onNotification = useCallback((cb: (n: Notification) => void) => {
    const set = listenersRef.current;
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const { unreadCount: count } = await markNotificationsRead();
      setUnreadCount(count);
    } catch {
      // Leave the badge as-is; the next push/REST sync will correct it.
    }
  }, []);

  // Connect when authenticated; disconnect on logout/unmount. Keyed on the user
  // id so a re-login (different user) tears down and rebuilds the connection.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Reset the badge when logged out (no connection in this branch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(0);
      return;
    }

    let active = true;

    // Seed the badge from REST so it's correct before any push arrives.
    getUnreadCount()
      .then(({ unreadCount: count }) => {
        if (active) setUnreadCount(count);
      })
      .catch(() => {
        /* pushes will correct it */
      });

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(notificationsHubUrl(), {
        // Hand SignalR the live in-memory access token on every (re)connect.
        accessTokenFactory: () => getAccessTokenForSocket(),
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("ReceiveNotification", (push: NotificationPush) => {
      if (!active) return;
      setUnreadCount(push.unreadCount);
      listenersRef.current.forEach((cb) => cb(push.notification));
      showToast(toastText(push.notification));
    });

    // After a dropped connection is restored, re-sync the count over REST so
    // anything pushed during the gap is reflected in the badge.
    connection.onreconnected(() => {
      getUnreadCount()
        .then(({ unreadCount: count }) => {
          if (active) setUnreadCount(count);
        })
        .catch(() => {});
    });

    // start() rejects if the effect cleanup stops it mid-negotiation (e.g.
    // React StrictMode's mount→unmount→mount) — that's expected, so swallow it.
    connection.start().catch(() => {});

    return () => {
      active = false;
      connection.stop().catch(() => {});
    };
  }, [isAuthenticated, user, showToast]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ unreadCount, markAllRead, onNotification }),
    [unreadCount, markAllRead, onNotification]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return ctx;
}
