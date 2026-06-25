"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { deleteTweet, getBookmarks, type Tweet } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TweetCard } from "@/components/TweetCard";

const PAGE_SIZE = 20;

/** Append `incoming`, dropping any tweet ids already present. */
function mergeUnique(existing: Tweet[], incoming: Tweet[]): Tweet[] {
  const seen = new Set(existing.map((t) => t.id));
  return [...existing, ...incoming.filter((t) => !seen.has(t.id))];
}

/**
 * /bookmarks (Module 6B) — the caller's saved tweets, newest-saved first, behind
 * auth. Reuses the feed's infinite-scroll + active-guard pattern and the shared
 * TweetCard. Un-bookmarking a row removes it (Twitter behavior); like/retweet
 * patch in place. Bookmarks are private, so there's no count anywhere here.
 */
export function Bookmarks() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialDone, setInitialDone] = useState(false);

  const [loading, setLoading] = useState(true); // first page
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Active-guard generation token (mirrors Feed/Notifications): a slow cold-start
  // response only applies if its captured token still matches.
  const loadGen = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const gen = ++loadGen.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    try {
      const page = await getBookmarks({ limit: PAGE_SIZE });
      if (gen !== loadGen.current) return;
      setTweets(page.items);
      setNextCursor(page.nextCursor);
      setInitialDone(true);
    } catch (err) {
      if (gen !== loadGen.current) return;
      setError(err instanceof Error ? err.message : "Failed to load bookmarks.");
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  // Load once auth has resolved and the user is signed in (bookmarks are private).
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
      const page = await getBookmarks({ cursor: nextCursor, limit: PAGE_SIZE });
      if (gen !== loadGen.current) return;
      setTweets((prev) => mergeUnique(prev, page.items));
      setNextCursor(page.nextCursor);
    } catch {
      // Leave the cursor in place so the next scroll retries this page.
    } finally {
      if (gen === loadGen.current) setLoadingMore(false);
    }
  }, [initialDone, nextCursor, loadingMore]);

  // IntersectionObserver sentinel — fires loadMore as the bottom nears.
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

  const handleDelete = useCallback(async (id: string) => {
    await deleteTweet(id);
    setTweets((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Optimistic engagement patch (from useEngagement). Un-bookmarking flips
  // bookmarkedByCurrentUser to false → drop the row (Twitter behavior). Any other
  // patch (like/retweet) applies in place so it can't clobber a concurrent action.
  const handleEngage = useCallback((id: string, patch: Partial<Tweet>) => {
    setTweets((prev) =>
      patch.bookmarkedByCurrentUser === false
        ? prev.filter((t) => t.id !== id)
        : prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  return (
    <>
      <div className="feed-head">
        <h1>Bookmarks</h1>
      </div>

      <section aria-label="Bookmarks">
        {!authLoading && !isAuthenticated && (
          <div className="feed-status">
            <p className="empty-title">Save posts for later</p>
            <p>Bookmark posts to easily find them again. Sign in to get started.</p>
            <Link href="/login" className="retry" style={{ marginTop: 12 }}>
              Sign in
            </Link>
          </div>
        )}

        {isAuthenticated && (
          <>
            {loading && (
              <div className="feed-status">
                <div className="spinner" />
                <p style={{ marginTop: 12 }}>
                  Loading your Bookmarks… the API is a free service and may take
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

            {!loading && !error && tweets.length === 0 && (
              <div className="feed-status">
                <p className="empty-title">You haven&apos;t added any Bookmarks yet</p>
                <p>When you bookmark a post, it&apos;ll show up here.</p>
              </div>
            )}

            {!loading &&
              !error &&
              tweets.map((t) => (
                <TweetCard
                  key={t.id}
                  tweet={t}
                  canDelete={!!user && user.id === t.authorId}
                  onDelete={handleDelete}
                  onEngage={handleEngage}
                />
              ))}

            {/* Infinite-scroll sentinel + status */}
            {!loading && !error && (
              <div ref={sentinelRef}>
                {loadingMore && (
                  <div className="feed-status">
                    <div className="spinner" />
                  </div>
                )}
                {!loadingMore && !nextCursor && tweets.length > 0 && (
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
