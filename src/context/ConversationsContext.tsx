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
  chatHubUrl,
  getAccessTokenForSocket,
  getDmUnreadCount,
  type ChatMessagePush,
  type Message,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

interface ConversationsContextValue {
  /** Total unread DMs — REST on load, live from the chat hub after (Module 12). */
  unreadCount: number;
  /**
   * Subscribe to incoming messages. Thread + list views register; the open
   * thread appends + re-marks read, the list patches its row. Returns an unsubscribe.
   */
  onIncomingMessage: (cb: (msg: Message) => void) => () => void;
  /**
   * The chat-hub `ReceiveMessage` handler calls this: fan the message out to
   * subscribers and set the unread badge from the payload's authoritative count.
   */
  pushIncomingMessage: (push: ChatMessagePush) => void;
  /** Re-sync the unread total from REST (after marking read, or after reconnect). */
  refreshUnread: () => void;
  /** The thread registers the conversation it's viewing so we suppress its toast. */
  setActiveConversation: (conversationId: string | null) => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

/**
 * Owns the DM unread count and the chat real-time connection (Module 12), mounted
 * in the (app) shell next to NotificationsProvider. The SignalR client is a
 * deliberate twin of the 5C notifications client: a connection to `/hubs/chat`
 * with the same `accessTokenFactory` (the in-memory JWT, pre-emptively refreshed
 * within ~30s of expiry), `withAutomaticReconnect`, an `onreconnected` REST
 * re-sync of the count, and StrictMode-safe create-in-effect / stop-in-cleanup.
 * `ReceiveMessage` routes through `pushIncomingMessage`, which fans out to the
 * subscribed views and sets the badge from the payload. The two hubs (notifs +
 * chat) are independent connections and coexist.
 */
export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);

  // Thread + list views register message handlers here.
  const listenersRef = useRef<Set<(msg: Message) => void>>(new Set());
  // The conversation currently open in the thread view (suppresses its own toast).
  const activeConvRef = useRef<string | null>(null);

  const onIncomingMessage = useCallback((cb: (msg: Message) => void) => {
    const set = listenersRef.current;
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }, []);

  const setActiveConversation = useCallback((conversationId: string | null) => {
    activeConvRef.current = conversationId;
  }, []);

  const pushIncomingMessage = useCallback(
    (push: ChatMessagePush) => {
      // Fan the message out (the open thread appends + re-marks read; the list
      // patches its row), then set the badge from the payload's authoritative count.
      listenersRef.current.forEach((cb) => cb(push.message));
      setUnreadCount(push.unreadCount);
      // Subtle toast only when you're not already looking at that conversation.
      if (push.conversationId !== activeConvRef.current) {
        const who = push.message.sender?.displayName;
        showToast(who ? `New message from ${who}` : "New message");
      }
    },
    [showToast]
  );

  const refreshUnread = useCallback(() => {
    getDmUnreadCount()
      .then(({ unreadCount: count }) => setUnreadCount(count))
      .catch(() => {
        // Degrade gracefully (e.g. the unread endpoint differs / 404s).
      });
  }, []);

  // Connect to the chat hub when authenticated; disconnect on logout/unmount.
  // Keyed on the user id so a re-login (different user) tears down and rebuilds.
  // Mirrors NotificationsProvider exactly.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(0);
      return;
    }

    let active = true;

    // Seed the badge from REST so it's correct before any push arrives.
    getDmUnreadCount()
      .then(({ unreadCount: count }) => {
        if (active) setUnreadCount(count);
      })
      .catch(() => {
        /* pushes / a later refresh will correct it */
      });

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(chatHubUrl(), {
        // Same live in-memory token source as the notifications socket.
        accessTokenFactory: () => getAccessTokenForSocket(),
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("ReceiveMessage", (push: ChatMessagePush) => {
      if (!active) return;
      pushIncomingMessage(push);
    });

    // After a dropped connection is restored, re-sync the count so nothing pushed
    // during the gap is lost.
    connection.onreconnected(() => {
      if (active) refreshUnread();
    });

    // start() rejects if the effect cleanup stops it mid-negotiation (StrictMode's
    // mount→unmount→mount) — expected, so swallow it.
    connection.start().catch(() => {});

    return () => {
      active = false;
      connection.stop().catch(() => {});
    };
  }, [isAuthenticated, user, pushIncomingMessage, refreshUnread]);

  const value = useMemo<ConversationsContextValue>(
    () => ({
      unreadCount,
      onIncomingMessage,
      pushIncomingMessage,
      refreshUnread,
      setActiveConversation,
    }),
    [unreadCount, onIncomingMessage, pushIncomingMessage, refreshUnread, setActiveConversation]
  );

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) {
    throw new Error("useConversations must be used within a ConversationsProvider");
  }
  return ctx;
}
