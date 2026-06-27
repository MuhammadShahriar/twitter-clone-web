"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getConversations,
  getMessages,
  markConversationRead,
  sendMessage,
  type ChatParticipant,
  type Message,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/context/ConversationsContext";
import { useToast } from "@/context/ToastContext";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/format";
import { bare } from "@/lib/handles";
import { messageIsMine } from "@/lib/chat";
import { IconBack, IconSend } from "@/components/icons";

const PAGE_SIZE = 30;
type Status = "loading" | "ready" | "forbidden" | "error";

function mergeUnique(existing: Message[], incoming: Message[]): Message[] {
  const seen = new Set(existing.map((m) => m.id));
  return [...existing, ...incoming.filter((m) => !seen.has(m.id))];
}

/**
 * Message thread (Module 12) at /messages/{id}. The page keys this by id so it
 * remounts on navigation (clean state, like Profile/FollowList).
 *
 * Pagination: getMessages is newest-first keyset; we reverse each page to render
 * oldest→newest (newest at the bottom). A top sentinel loads older pages and the
 * scroll position is preserved across the prepend (distance-from-bottom). Sending
 * is optimistic (temp bubble appended, reconciled from the returned MessageDto,
 * reverted on failure). On open we mark the conversation read and refresh the nav
 * badge; we also subscribe to ConversationsProvider.onIncomingMessage so that —
 * once the post-12B SignalR client calls pushIncomingMessage — a message for this
 * conversation appends live and re-marks read. REST-only today: that handler just
 * never fires.
 */
export function ChatThread({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { onIncomingMessage, refreshUnread, setActiveConversation } = useConversations();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [other, setOther] = useState<ChatParticipant | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const tempIdRef = useRef(0);
  // Scroll bookkeeping (applied in a layout effect after `messages` changes):
  const pendingPrepend = useRef<number | null>(null); // distance-from-bottom to restore
  const didInitialScroll = useRef(false);
  const scrollOnNext = useRef(false); // append (send/incoming) → stick to bottom

  // Mark this conversation read + refresh the nav badge (on open and on live append).
  const markRead = useCallback(() => {
    markConversationRead(conversationId).then(refreshUnread).catch(() => {});
  }, [conversationId, refreshUnread]);

  // Initial load (mount-only; the page remounts per id).
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let active = true;
    (async () => {
      setStatus("loading");
      try {
        const page = await getMessages(conversationId, { limit: PAGE_SIZE });
        if (!active) return;
        const display = [...page.items].reverse(); // oldest → newest
        setMessages(display);
        setNextCursor(page.nextCursor);
        setStatus("ready");
        // Header: the other participant is the sender of any not-mine message.
        const derived = display.find((m) => !messageIsMine(m, user))?.sender ?? null;
        if (derived) setOther(derived);
        markRead();
        // New / all-mine conversations have no not-mine message to derive from —
        // resolve the participant from the (recency-ordered) conversation list.
        if (!derived) {
          try {
            const convs = await getConversations({ limit: 50 });
            if (!active) return;
            const c = convs.items.find((x) => x.id === conversationId);
            if (c) setOther(c.otherParticipant);
          } catch {
            /* keep the sparse header */
          }
        }
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 403) {
          setStatus("forbidden");
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : "Failed to load the conversation.");
        setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [conversationId, authLoading, isAuthenticated, user, markRead]);

  // Tell the provider which conversation is open so it suppresses this one's toast.
  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation]);

  // Live incoming messages from the chat hub (routed via pushIncomingMessage).
  // mergeUnique keys by id, so the sender's own echo can't double-render.
  useEffect(() => {
    return onIncomingMessage((m) => {
      if (m.conversationId !== conversationId) return;
      scrollOnNext.current = true;
      setMessages((prev) => mergeUnique(prev, [m]));
      markRead();
    });
  }, [conversationId, onIncomingMessage, markRead]);

  // Apply queued scroll adjustments after the DOM updates.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pendingPrepend.current != null) {
      el.scrollTop = el.scrollHeight - pendingPrepend.current; // preserve viewport vs bottom
      pendingPrepend.current = null;
      return;
    }
    if (!didInitialScroll.current && messages.length > 0) {
      el.scrollTop = el.scrollHeight; // land at the newest on open
      didInitialScroll.current = true;
      return;
    }
    if (scrollOnNext.current) {
      el.scrollTop = el.scrollHeight;
      scrollOnNext.current = false;
    }
  }, [messages]);

  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingOlder || status !== "ready") return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    pendingPrepend.current = el ? el.scrollHeight - el.scrollTop : null;
    try {
      const page = await getMessages(conversationId, { cursor: nextCursor, limit: PAGE_SIZE });
      const older = [...page.items].reverse(); // older block, oldest → newest
      setMessages((prev) => mergeUnique(older, prev)); // prepend
      setNextCursor(page.nextCursor);
    } catch {
      pendingPrepend.current = null; // nothing prepended; don't adjust scroll
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, nextCursor, loadingOlder, status]);

  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadOlder();
      },
      { root: scrollRef.current, rootMargin: "300px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadOlder]);

  async function handleSend() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    const tempId = `temp-${++tempIdRef.current}`;
    const temp: Message = {
      id: tempId,
      conversationId,
      content,
      createdAtUtc: new Date().toISOString(),
      isMine: true,
      sender: user
        ? { handle: user.handle, displayName: user.displayName, avatarUrl: user.avatarUrl }
        : undefined,
    };
    scrollOnNext.current = true;
    setMessages((prev) => [...prev, temp]);
    setText("");
    try {
      const real = await sendMessage(conversationId, content);
      setMessages((prev) =>
        // If the hub echoed the real message first (race), just drop the temp so
        // we don't end up with two copies of the same id; else swap temp → real.
        prev.some((m) => m.id === real.id)
          ? prev.filter((m) => m.id !== tempId)
          : prev.map((m) => (m.id === tempId ? { ...real, isMine: true } : m))
      );
    } catch (err) {
      // Revert the optimistic bubble and restore the text so nothing is lost.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText((t) => t || content);
      showToast(err instanceof Error ? err.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  const otherHref = other ? `/${bare(other.handle)}` : "/messages";

  return (
    <div className="chat-thread">
      <header className="chat-head">
        <button type="button" className="back-btn" aria-label="Back" onClick={() => router.push("/messages")}>
          <IconBack />
        </button>
        {other ? (
          <Link href={otherHref} className="chat-head-peer">
            <Avatar seed={other.handle} name={other.displayName} src={other.avatarUrl} className="sm" />
            <span className="chat-head-id">
              <span className="chat-head-name">{other.displayName}</span>
              <span className="chat-head-handle">@{bare(other.handle)}</span>
            </span>
          </Link>
        ) : (
          <h1 className="chat-head-fallback">Conversation</h1>
        )}
      </header>

      {!authLoading && !isAuthenticated && (
        <div className="feed-status">Sign in to view this conversation.</div>
      )}

      {isAuthenticated && status === "loading" && (
        <div className="feed-status">
          <div className="spinner" />
          <p style={{ marginTop: 12 }}>Loading conversation…</p>
        </div>
      )}

      {isAuthenticated && status === "forbidden" && (
        <div className="feed-status">
          <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 17 }}>
            You can&apos;t view this conversation
          </p>
          <p style={{ marginTop: 4 }}>It belongs to other people.</p>
          <button type="button" className="retry" onClick={() => router.push("/messages")}>
            Back to messages
          </button>
        </div>
      )}

      {isAuthenticated && status === "error" && (
        <div className="feed-status">
          <p style={{ color: "var(--error, #f4212e)" }}>{errorMsg}</p>
          <button type="button" className="retry" onClick={() => router.refresh()}>
            Retry
          </button>
        </div>
      )}

      {isAuthenticated && status === "ready" && (
        <>
          <div className="chat-scroll" ref={scrollRef}>
            <div ref={topSentinelRef} />
            {loadingOlder && (
              <div className="feed-status" style={{ padding: 8 }}>
                <div className="spinner" />
              </div>
            )}
            {messages.length === 0 && (
              <div className="chat-empty">No messages yet. Say hello 👋</div>
            )}
            {messages.map((m, i) => {
              const mine = messageIsMine(m, user);
              const prev = messages[i - 1];
              const startOfTheirRun = !mine && (i === 0 || messageIsMine(prev, user));
              const who = m.sender ?? other;
              return (
                <div key={m.id} className={`msg-row ${mine ? "mine" : "theirs"}`}>
                  {!mine && (
                    <span className="msg-avatar">
                      {startOfTheirRun && who && (
                        <Avatar seed={who.handle} name={who.displayName} src={who.avatarUrl} className="sm" />
                      )}
                    </span>
                  )}
                  <div className="msg-col">
                    <div
                      className={`bubble ${mine ? "mine" : "theirs"}${
                        m.id.startsWith("temp-") ? " pending" : ""
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className="msg-time">{relativeTime(m.createdAtUtc)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="chat-composer">
            <textarea
              className="chat-input"
              placeholder="Start a new message"
              rows={1}
              value={text}
              aria-label="Message text"
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter inserts a newline.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="button"
              className="chat-send"
              aria-label="Send"
              disabled={!text.trim() || sending}
              onClick={handleSend}
            >
              <IconSend size={20} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
