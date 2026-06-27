"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getConversations,
  type Conversation,
  type ConversationPage,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/context/ConversationsContext";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/format";
import { bare } from "@/lib/handles";
import { messageIsMine } from "@/lib/chat";

const PAGE_SIZE = 20;

function mergeUnique(existing: Conversation[], incoming: Conversation[]): Conversation[] {
  const seen = new Set(existing.map((c) => c.id));
  return [...existing, ...incoming.filter((c) => !seen.has(c.id))];
}

/** The last-message line: "You: …" when I sent it, truncated by CSS. */
function preview(c: Conversation, myId: string | undefined): string {
  if (!c.lastMessage) return "Start the conversation";
  const mine = myId != null && c.lastMessage.senderId === myId;
  return `${mine ? "You: " : ""}${c.lastMessage.contentPreview}`;
}

/**
 * Conversation list (Module 12) at /messages. Reuses the feed's infinite-scroll +
 * generation-token active-guard. Each row links to the thread; rows with unread
 * messages are emphasised and show a count.
 */
export function Conversations() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { onIncomingMessage } = useConversations();

  const [items, setItems] = useState<Conversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialDone, setInitialDone] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadGen = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const gen = ++loadGen.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    try {
      const page: ConversationPage = await getConversations({ limit: PAGE_SIZE });
      if (gen !== loadGen.current) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setInitialDone(true);
    } catch (err) {
      if (gen !== loadGen.current) return;
      setError(err instanceof Error ? err.message : "Failed to load messages.");
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstPage();
  }, [authLoading, isAuthenticated, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!initialDone || !nextCursor || loadingMore) return;
    const gen = loadGen.current;
    setLoadingMore(true);
    try {
      const page = await getConversations({ cursor: nextCursor, limit: PAGE_SIZE });
      if (gen !== loadGen.current) return;
      setItems((prev) => mergeUnique(prev, page.items));
      setNextCursor(page.nextCursor);
    } catch {
      // Leave the cursor so the next scroll retries.
    } finally {
      if (gen === loadGen.current) setLoadingMore(false);
    }
  }, [initialDone, nextCursor, loadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Live: a chat-hub message updates the list — patch the matching row (new
  // preview + recency + bumped unread, moved to the top), construct a fresh row
  // for a brand-new incoming conversation (the sender is the other participant),
  // or fall back to a first-page refetch when we can't build it locally.
  useEffect(() => {
    return onIncomingMessage((m) => {
      const mine = messageIsMine(m, user);
      let handled = true;
      setItems((prev) => {
        const i = prev.findIndex((c) => c.id === m.conversationId);
        if (i === -1) {
          if (!mine && m.sender) {
            const fresh: Conversation = {
              id: m.conversationId,
              otherParticipant: m.sender,
              lastMessage: {
                contentPreview: m.content,
                createdAtUtc: m.createdAtUtc,
                senderId: m.senderId ?? "",
              },
              unreadCount: 1,
              lastMessageAtUtc: m.createdAtUtc,
            };
            return [fresh, ...prev];
          }
          handled = false; // can't construct it locally → refetch below
          return prev;
        }
        const c = prev[i];
        const updated: Conversation = {
          ...c,
          lastMessage: {
            contentPreview: m.content,
            createdAtUtc: m.createdAtUtc,
            senderId: mine ? user?.id ?? "" : m.senderId ?? c.lastMessage?.senderId ?? "",
          },
          lastMessageAtUtc: m.createdAtUtc,
          unreadCount: mine ? c.unreadCount : c.unreadCount + 1,
        };
        return [updated, ...prev.filter((_, j) => j !== i)];
      });
      if (!handled) loadFirstPage();
    });
  }, [onIncomingMessage, loadFirstPage, user]);

  return (
    <>
      <div className="feed-head">
        <h1>Messages</h1>
      </div>

      <section aria-label="Conversations">
        {!authLoading && !isAuthenticated && (
          <div className="feed-status">Sign in to see your messages.</div>
        )}

        {isAuthenticated && (
          <>
            {loading && (
              <div className="feed-status">
                <div className="spinner" />
                <p style={{ marginTop: 12 }}>
                  Loading messages… the API is a free service and may take ~15–30s
                  to wake up.
                </p>
              </div>
            )}

            {!loading && error && (
              <div className="feed-status">
                <p style={{ color: "var(--error, #f4212e)" }}>{error}</p>
                <button type="button" className="retry" onClick={loadFirstPage}>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="feed-status">No messages yet.</div>
            )}

            {!loading &&
              !error &&
              items.map((c) => {
                const p = c.otherParticipant;
                const unread = c.unreadCount > 0;
                const when = c.lastMessageAtUtc ?? c.lastMessage?.createdAtUtc;
                return (
                  <div
                    key={c.id}
                    className={`convo-row${unread ? " unread" : ""}`}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/messages/${c.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/messages/${c.id}`);
                      }
                    }}
                  >
                    <Avatar seed={p.handle} name={p.displayName} src={p.avatarUrl} />
                    <div className="convo-main">
                      <div className="convo-top">
                        <span className="convo-name">{p.displayName}</span>
                        <span className="convo-handle">@{bare(p.handle)}</span>
                        {when && (
                          <span className="convo-time">· {relativeTime(when)}</span>
                        )}
                      </div>
                      <div className="convo-preview">{preview(c, user?.id)}</div>
                    </div>
                    {unread && (
                      <span
                        className="convo-unread"
                        aria-label={`${c.unreadCount} unread`}
                      >
                        {c.unreadCount > 9 ? "9+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })}

            {!loading && !error && (
              <div ref={sentinelRef}>
                {loadingMore && (
                  <div className="feed-status">
                    <div className="spinner" />
                  </div>
                )}
                {!loadingMore && !nextCursor && items.length > 0 && (
                  <div className="feed-status">You&apos;re all caught up.</div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
