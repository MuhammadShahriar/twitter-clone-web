"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  deleteTweet,
  getFollowingFeed,
  getTweets,
  type Tweet,
  type TweetPage,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useQuoteComposer } from "@/context/QuoteComposerContext";
import { useSuggestions } from "@/lib/useSuggestions";
import { Composer } from "@/components/Composer";
import { SuggestionList } from "@/components/SuggestionList";
import { TweetCard } from "@/components/TweetCard";
import { IconRetweet } from "@/components/icons";

const PAGE_SIZE = 20;

type Tab = "for-you" | "following";

/** Append `incoming`, dropping any tweet ids already present. */
function mergeUnique(existing: Tweet[], incoming: Tweet[]): Tweet[] {
  const seen = new Set(existing.map((t) => t.id));
  return [...existing, ...incoming.filter((t) => !seen.has(t.id))];
}

function fetchPage(
  tab: Tab,
  opts: { cursor?: string | null; limit?: number }
): Promise<TweetPage> {
  return tab === "following" ? getFollowingFeed(opts) : getTweets(opts);
}

/**
 * Empty Following feed (logged in, but no posts to show). Pulls the same
 * suggestions as the sidebar so the user can follow people without leaving.
 */
function FollowingEmptyState() {
  const { users, loading } = useSuggestions(5);
  return (
    <div className="feed-status following-empty">
      <p className="empty-title">Welcome to your Following feed</p>
      <p>Follow some accounts to fill your timeline with their posts.</p>
      {loading ? (
        <div className="spinner" style={{ marginTop: 16 }} />
      ) : (
        users.length > 0 && (
          <div className="empty-suggestions">
            <SuggestionList users={users} />
          </div>
        )
      )}
    </div>
  );
}

export function Feed() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>("for-you");
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialDone, setInitialDone] = useState(false);

  const [loading, setLoading] = useState(true); // first page
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Per-load generation token. Bumped whenever a new first-page load starts or
  // the tab switches; an in-flight fetch only applies its result if its captured
  // token still matches, so a slow (cold-start) response can't overwrite or
  // append onto a tab the user has since left. Mirrors Thread's isActive guard.
  const loadGen = useRef(0);

  // Following is [Authorize]-only: logged-out users see a prompt, not a fetch.
  const followingLockedOut = tab === "following" && !authLoading && !isAuthenticated;

  const loadFirstPage = useCallback(async (which: Tab) => {
    const gen = ++loadGen.current; // invalidates any in-flight first-page/loadMore
    setLoading(true);
    setLoadingMore(false); // a stale loadMore from the prior tab must not apply
    setError(null);
    try {
      const page = await fetchPage(which, { limit: PAGE_SIZE });
      if (gen !== loadGen.current) return; // a newer load started; drop this result
      setTweets(page.items);
      setNextCursor(page.nextCursor);
      setInitialDone(true);
    } catch (err) {
      if (gen !== loadGen.current) return;
      setError(err instanceof Error ? err.message : "Failed to load tweets.");
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wait for the auth bootstrap so reads carry the token (correct engagement
    // flags), and so we know whether the Following tab is allowed. The
    // logged-out Following case renders a prompt regardless of `loading`, so we
    // just skip the fetch. loadFirstPage owns its own state updates.
    if (authLoading) return;
    if (tab === "following" && !isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstPage(tab);
  }, [tab, authLoading, isAuthenticated, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!initialDone || !nextCursor || loadingMore) return;
    if (tab === "following" && !isAuthenticated) return;
    const gen = loadGen.current; // current load context; a tab switch bumps this
    setLoadingMore(true);
    try {
      const page = await fetchPage(tab, { cursor: nextCursor, limit: PAGE_SIZE });
      if (gen !== loadGen.current) return; // tab switched mid-flight; don't append
      setTweets((prev) => mergeUnique(prev, page.items));
      setNextCursor(page.nextCursor);
    } catch {
      // Leave the cursor in place so the next scroll retries this page.
    } finally {
      if (gen === loadGen.current) setLoadingMore(false);
    }
  }, [tab, isAuthenticated, initialDone, nextCursor, loadingMore]);

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

  // Switch tabs: reset to a clean loading state so the previous tab's tweets
  // don't flash under the new tab before its first page arrives.
  const selectTab = useCallback(
    (next: Tab) => {
      if (next === tab) return;
      loadGen.current++; // invalidate in-flight loads from the tab we're leaving
      setTab(next);
      setTweets([]);
      setNextCursor(null);
      setInitialDone(false);
      setError(null);
      setLoading(true);
      setLoadingMore(false); // a stale loadMore must not run to completion here
    },
    [tab]
  );

  const handlePosted = useCallback((created: Tweet) => {
    // Prepend; mergeUnique keeps it from reappearing when its page loads.
    setTweets((prev) => mergeUnique([created], prev));
  }, []);

  // Quote tweets are posted from a modal that can be opened anywhere (10B), so
  // they arrive via the QuoteComposer context rather than the inline Composer.
  // Prepend them the same way a normal new post lands at the top of the feed.
  const { onTweetPosted } = useQuoteComposer();
  useEffect(() => onTweetPosted(handlePosted), [onTweetPosted, handlePosted]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteTweet(id);
    setTweets((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Patch a tweet in place after an optimistic like/retweet (3C). Applies only
  // the changed fields so an in-flight action on the same tweet isn't clobbered
  // by the other action's update.
  const handleEngage = useCallback((id: string, patch: Partial<Tweet>) => {
    setTweets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  return (
    <>
      <div className="feed-head">
        <h1>Home</h1>
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "for-you"}
            className={`tab ${tab === "for-you" ? "active" : ""}`}
            onClick={() => selectTab("for-you")}
          >
            For you
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "following"}
            className={`tab ${tab === "following" ? "active" : ""}`}
            onClick={() => selectTab("following")}
          >
            Following
          </button>
        </div>
      </div>

      <Composer onPosted={handlePosted} />

      <section aria-label="Timeline">
        {followingLockedOut ? (
          <div className="feed-status">
            <p className="empty-title">Sign in to see who you follow</p>
            <p>Your Following timeline shows posts from the people you follow.</p>
            <Link href="/login" className="retry" style={{ marginTop: 12 }}>
              Sign in
            </Link>
          </div>
        ) : (
          <>
            {/* First-page load (covers the API cold-start). */}
            {loading && (
              <div className="feed-status">
                <div className="spinner" />
                <p style={{ marginTop: 12 }}>
                  Loading the latest… the API is a free service and may take
                  ~15–30s to wake up.
                </p>
              </div>
            )}

            {!loading && error && (
              <div className="feed-status">
                <p style={{ color: "var(--error, #f4212e)" }}>{error}</p>
                <button
                  type="button"
                  className="retry"
                  onClick={() => loadFirstPage(tab)}
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && tweets.length === 0 && (
              tab === "following" ? (
                <FollowingEmptyState />
              ) : (
                <div className="feed-status">
                  No tweets yet. Be the first to post!
                </div>
              )
            )}

            {!loading &&
              !error &&
              tweets.map((t) => (
                <div key={t.id}>
                  {t.retweetedBy && (
                    <div className="retweet-marker">
                      <IconRetweet size={15} />
                      <span>{t.retweetedBy.displayName} reposted</span>
                    </div>
                  )}
                  <TweetCard
                    tweet={t}
                    canDelete={!!user && user.id === t.authorId}
                    onDelete={handleDelete}
                    onEngage={handleEngage}
                  />
                </div>
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
