"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getNotifications,
  type Notification,
  type NotificationPage,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/format";
import {
  IconAt,
  IconLike,
  IconPersonPlus,
  IconQuote,
  IconReply,
  IconRetweet,
} from "@/components/icons";

const PAGE_SIZE = 20;

/** Prepend/append while de-duping by id (live pushes + paged loads can overlap). */
function mergeUnique(existing: Notification[], incoming: Notification[]): Notification[] {
  const seen = new Set(existing.map((n) => n.id));
  return [...existing, ...incoming.filter((n) => !seen.has(n.id))];
}

const asRead = (n: Notification): Notification => ({ ...n, isRead: true });

/** The colored type glyph in the left gutter. */
function TypeIcon({ type }: { type: Notification["type"] }) {
  switch (type) {
    case "Like":
      return (
        <span style={{ color: "var(--like)" }}>
          <IconLike on size={26} />
        </span>
      );
    case "Retweet":
      return (
        <span style={{ color: "var(--retweet)" }}>
          <IconRetweet size={26} />
        </span>
      );
    case "Quote":
      return (
        <span style={{ color: "var(--retweet)" }}>
          <IconQuote size={24} />
        </span>
      );
    case "Reply":
      return (
        <span style={{ color: "var(--accent)" }}>
          <IconReply size={24} />
        </span>
      );
    case "Follow":
      return (
        <span style={{ color: "var(--accent)" }}>
          <IconPersonPlus size={26} />
        </span>
      );
    case "Mention":
      return (
        <span style={{ color: "var(--accent)" }}>
          <IconAt size={26} />
        </span>
      );
    default:
      return null;
  }
}

/** The "{name} did X" line for a notification type. */
function actionText(type: Notification["type"]): string {
  switch (type) {
    case "Like":
      return "liked your post";
    case "Retweet":
      return "reposted your post";
    case "Quote":
      return "quoted your post";
    case "Reply":
      return "replied to your post";
    case "Follow":
      return "followed you";
    case "Mention":
      return "mentioned you";
    default:
      return "";
  }
}

export function Notifications() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { markAllRead, onNotification } = useNotifications();

  const [items, setItems] = useState<Notification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialDone, setInitialDone] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Active-guard generation token (mirrors Feed/Thread): a slow cold-start
  // response only applies if its captured token still matches.
  const loadGen = useRef(0);
  // True once the "mark all read on open" call has resolved. Pages that arrive
  // after this point are shown read even if the fetch was issued before the
  // mark committed (both hit the same cold backend; order isn't guaranteed).
  const markedReadRef = useRef(false);

  const loadFirstPage = useCallback(async () => {
    const gen = ++loadGen.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    try {
      const page: NotificationPage = await getNotifications({ limit: PAGE_SIZE });
      if (gen !== loadGen.current) return;
      setItems(markedReadRef.current ? page.items.map(asRead) : page.items);
      setNextCursor(page.nextCursor);
      setInitialDone(true);
    } catch (err) {
      if (gen !== loadGen.current) return;
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  // Load the first page once auth has resolved and the user is signed in.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstPage();
  }, [authLoading, isAuthenticated, loadFirstPage]);

  // Opening the page marks everything read (badge → 0). When the server confirms,
  // flip the currently-loaded rows to read-styled. Pages fetched *after* this
  // resolves already come back read from the server, so no extra work needed.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let active = true;
    markAllRead().then(() => {
      markedReadRef.current = true;
      if (active) setItems((prev) => prev.map(asRead));
    });
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, markAllRead]);

  // Live pushes: prepend new notifications while this view is mounted.
  useEffect(() => {
    return onNotification((n) => {
      setItems((prev) => mergeUnique([n], prev));
    });
  }, [onNotification]);

  const loadMore = useCallback(async () => {
    if (!initialDone || !nextCursor || loadingMore) return;
    const gen = loadGen.current;
    setLoadingMore(true);
    try {
      const page = await getNotifications({ cursor: nextCursor, limit: PAGE_SIZE });
      if (gen !== loadGen.current) return;
      setItems((prev) =>
        mergeUnique(prev, markedReadRef.current ? page.items.map(asRead) : page.items)
      );
      setNextCursor(page.nextCursor);
    } catch {
      // Leave the cursor so the next scroll retries this page.
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

  const openNotification = useCallback(
    (n: Notification) => {
      if (n.type === "Follow") {
        router.push(`/${n.actor.handle.replace(/^@+/, "")}`);
      } else if (n.tweetId) {
        router.push(`/tweet/${n.tweetId}`);
      }
    },
    [router]
  );

  return (
    <>
      <div className="feed-head">
        <h1>Notifications</h1>
      </div>

      <section aria-label="Notifications">
        {!authLoading && !isAuthenticated && (
          <div className="feed-status">Sign in to see your notifications.</div>
        )}

        {isAuthenticated && (
          <>
            {loading && (
              <div className="feed-status">
                <div className="spinner" />
                <p style={{ marginTop: 12 }}>
                  Loading notifications… the API is a free service and may take
                  ~15–30s to wake up.
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
              <div className="feed-status">No notifications yet.</div>
            )}

            {!loading &&
              !error &&
              items.map((n) => (
                <div
                  key={n.id}
                  className={`notif-row${n.isRead ? "" : " unread"}`}
                  role="link"
                  tabIndex={0}
                  onClick={() => openNotification(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openNotification(n);
                    }
                  }}
                >
                  <div className="notif-gutter">
                    <TypeIcon type={n.type} />
                  </div>
                  <div className="notif-content">
                    <div className="notif-avatars">
                      <Avatar
                        seed={n.actor.handle}
                        name={n.actor.displayName}
                        src={n.actor.avatarUrl}
                      />
                    </div>
                    <div className="notif-text">
                      <b>{n.actor.displayName}</b> {actionText(n.type)}
                    </div>
                    {n.tweetPreview && (
                      <div className="notif-snippet">{n.tweetPreview}</div>
                    )}
                    <div className="notif-time">{relativeTime(n.createdAtUtc)}</div>
                  </div>
                  {!n.isRead && <span className="notif-dot" />}
                </div>
              ))}

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
