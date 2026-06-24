"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  deleteTweet,
  getReplies,
  getTweet,
  type Tweet,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { FocusedTweet } from "@/components/FocusedTweet";
import { ReplyComposer } from "@/components/ReplyComposer";
import { TweetCard } from "@/components/TweetCard";
import { IconBack } from "@/components/icons";

const PAGE_SIZE = 20;
type Status = "loading" | "ready" | "notfound" | "error";

function mergeUnique(existing: Tweet[], incoming: Tweet[]): Tweet[] {
  const seen = new Set(existing.map((t) => t.id));
  return [...existing, ...incoming.filter((t) => !seen.has(t.id))];
}

export function Thread({ id }: { id: string }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [focused, setFocused] = useState<Tweet | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [replyCount, setReplyCount] = useState(0);

  const [replies, setReplies] = useState<Tweet[]>([]);
  const [repliesCursor, setRepliesCursor] = useState<string | null>(null);
  const [repliesInitialDone, setRepliesInitialDone] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState(true);
  const [repliesLoadingMore, setRepliesLoadingMore] = useState(false);

  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const replyRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  const load = useCallback(async (tweetId: string, isActive: () => boolean) => {
    setStatus("loading");
    setErrorMsg(null);
    setFocused(null);
    setReplies([]);
    setRepliesCursor(null);
    setRepliesInitialDone(false);
    setRepliesLoading(true);

    try {
      const t = await getTweet(tweetId);
      if (!isActive()) return;
      setFocused(t);
      setReplyCount(t.replyCount);
      setStatus("ready");
    } catch (err) {
      if (!isActive()) return;
      if (err instanceof ApiError && err.status === 404) {
        setStatus("notfound");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load.");
        setStatus("error");
      }
      return;
    }

    try {
      const page = await getReplies(tweetId, { limit: PAGE_SIZE });
      if (!isActive()) return;
      setReplies(page.items);
      setRepliesCursor(page.nextCursor);
    } catch {
      // Leave replies empty; the focused tweet still renders.
    } finally {
      if (isActive()) {
        setRepliesInitialDone(true);
        setRepliesLoading(false);
      }
    }
  }, []);

  // Refetch whenever the route id changes (e.g. clicking into a reply's thread).
  // Wait for the auth bootstrap so the token is set before the read and the
  // *ByCurrentUser flags come back correct (see Feed for the same guard).
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(id, () => active);
    return () => {
      active = false;
    };
  }, [id, load, authLoading]);

  const loadMoreReplies = useCallback(async () => {
    if (!repliesInitialDone || !repliesCursor || repliesLoadingMore) return;
    setRepliesLoadingMore(true);
    try {
      const page = await getReplies(id, { cursor: repliesCursor, limit: PAGE_SIZE });
      setReplies((prev) => mergeUnique(prev, page.items));
      setRepliesCursor(page.nextCursor);
    } catch {
      // keep cursor so the next scroll retries
    } finally {
      setRepliesLoadingMore(false);
    }
  }, [id, repliesInitialDone, repliesCursor, repliesLoadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreReplies();
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMoreReplies]);

  const handleReplied = useCallback((reply: Tweet) => {
    // Replies load oldest-first, so a fresh reply is the most recent — append it
    // to the bottom (true chronological position), matching Twitter.
    setReplies((prev) => mergeUnique(prev, [reply]));
    setReplyCount((n) => n + 1);
    setPendingScrollId(reply.id);
  }, []);

  // Bring the just-posted reply into view once it has rendered. With infinite
  // scroll the user may be anywhere in the thread, so mirror Twitter and scroll
  // the new reply to the user.
  useEffect(() => {
    if (!pendingScrollId) return;
    const el = replyRefs.current.get(pendingScrollId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setPendingScrollId(null);
  }, [pendingScrollId, replies]);

  const handleDeleteFocused = useCallback(async () => {
    await deleteTweet(id);
    router.push("/");
  }, [id, router]);

  const handleDeleteReply = useCallback(async (replyId: string) => {
    await deleteTweet(replyId);
    setReplies((prev) => prev.filter((t) => t.id !== replyId));
    setReplyCount((n) => Math.max(0, n - 1));
  }, []);

  // Optimistic like/retweet on the focused tweet and on individual replies.
  // Field-scoped patches so an in-flight action isn't clobbered by the other.
  const handleEngageFocused = useCallback((id: string, patch: Partial<Tweet>) => {
    setFocused((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const handleEngageReply = useCallback((id: string, patch: Partial<Tweet>) => {
    setReplies((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <>
      <header className="detail-head">
        <button type="button" className="back-btn" aria-label="Back" onClick={goBack}>
          <IconBack />
        </button>
        <h1>Post</h1>
      </header>

      {status === "loading" && (
        <div className="feed-status">
          <div className="spinner" />
          <p style={{ marginTop: 12 }}>Loading post…</p>
        </div>
      )}

      {status === "notfound" && (
        <div className="feed-status">
          <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 17 }}>
            This post doesn&apos;t exist
          </p>
          <p style={{ marginTop: 4 }}>
            It may have been deleted, or the link is wrong.
          </p>
          <button type="button" className="retry" onClick={() => router.push("/")}>
            Back to feed
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="feed-status">
          <p style={{ color: "var(--error, #f4212e)" }}>{errorMsg}</p>
          <button
            type="button"
            className="retry"
            onClick={() => load(id, () => true)}
          >
            Retry
          </button>
        </div>
      )}

      {status === "ready" && focused && (
        <>
          <FocusedTweet
            tweet={focused}
            replyCount={replyCount}
            canDelete={!!user && user.id === focused.authorId}
            onDelete={handleDeleteFocused}
            onReply={() => replyInputRef.current?.focus()}
            onEngage={handleEngageFocused}
          />

          <ReplyComposer
            parentId={focused.id}
            replyingTo={focused.authorHandle}
            onReplied={handleReplied}
            inputRef={replyInputRef}
          />

          <section className="reply-connect" aria-label="Replies">
            {repliesLoading && (
              <div className="feed-status">
                <div className="spinner" />
              </div>
            )}

            {!repliesLoading &&
              replies.map((r) => (
                <div
                  key={r.id}
                  ref={(el) => {
                    if (el) replyRefs.current.set(r.id, el);
                    else replyRefs.current.delete(r.id);
                  }}
                >
                  <TweetCard
                    tweet={r}
                    canDelete={!!user && user.id === r.authorId}
                    onDelete={handleDeleteReply}
                    onEngage={handleEngageReply}
                  />
                </div>
              ))}

            {!repliesLoading && repliesInitialDone && replies.length === 0 && (
              <div className="feed-status">No replies yet. Start the conversation.</div>
            )}

            <div ref={sentinelRef}>
              {repliesLoadingMore && (
                <div className="feed-status">
                  <div className="spinner" />
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
