"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  deleteTweet,
  searchTweets,
  searchUsers,
  type Tweet,
  type UserListItem,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { UserRow } from "@/components/UserRow";
import { TweetCard } from "@/components/TweetCard";

const PAGE_SIZE = 20;

type SearchTab = "people" | "tweets";

/** Append `incoming`, dropping any item ids already present (paging dedupe). */
function mergeUnique<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((x) => x.id));
  return [...existing, ...incoming.filter((x) => !seen.has(x.id))];
}

/**
 * Generic cursor-paged, infinite-scrolling result list — the same shape used by
 * the Feed and the follow lists, factored so People and Tweets share one
 * implementation. Mounted with a `q:tab` key by the panel, so a tab/query
 * change remounts it with fresh state; the `loadGen` token additionally guards
 * against a slow (cold-start) response landing after a retry within one mount.
 */
function ResultList<T extends { id: string }>({
  fetchPage,
  renderItem,
  emptyText,
}: {
  fetchPage: (opts: {
    cursor?: string | null;
    limit?: number;
  }) => Promise<{ items: T[]; nextCursor: string | null }>;
  renderItem: (
    item: T,
    helpers: {
      patch: (id: string, partial: Partial<T>) => void;
      remove: (id: string) => void;
    }
  ) => React.ReactNode;
  emptyText: string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialDone, setInitialDone] = useState(false);
  const [loading, setLoading] = useState(true); // first page
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
      const page = await fetchPage({ limit: PAGE_SIZE });
      if (gen !== loadGen.current) return; // a newer load started; drop this
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setInitialDone(true);
    } catch (err) {
      if (gen !== loadGen.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!initialDone || !nextCursor || loadingMore) return;
    const gen = loadGen.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage({ cursor: nextCursor, limit: PAGE_SIZE });
      if (gen !== loadGen.current) return;
      setItems((prev) => mergeUnique(prev, page.items));
      setNextCursor(page.nextCursor);
    } catch {
      // Leave the cursor in place so the next scroll retries this page.
    } finally {
      if (gen === loadGen.current) setLoadingMore(false);
    }
  }, [fetchPage, initialDone, nextCursor, loadingMore]);

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

  const patch = useCallback((id: string, partial: Partial<T>) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  }, []);
  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  if (loading) {
    return (
      <div className="feed-status">
        <div className="spinner" />
        <p style={{ marginTop: 12 }}>
          Searching… the API is a free service and may take ~15–30s to wake up.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feed-status">
        <p style={{ color: "var(--error, #f4212e)" }}>{error}</p>
        <button type="button" className="retry" onClick={loadFirstPage}>
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="feed-status">{emptyText}</div>;
  }

  return (
    <>
      {items.map((item) => (
        <div key={item.id}>{renderItem(item, { patch, remove })}</div>
      ))}
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
    </>
  );
}

/**
 * The People/Tweets tabs + the active result list for a fixed query. `q` is
 * stable for the life of a mounted panel (SearchResults keys it by `q`), so the
 * per-tab fetchers are stable too. Switching tabs swaps a freshly-keyed
 * ResultList — the inactive tab's data never bleeds into the active one.
 */
function SearchPanel({ q }: { q: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<SearchTab>("people");

  const fetchPeople = useCallback(
    (opts: { cursor?: string | null; limit?: number }) => searchUsers(q, opts),
    [q]
  );
  const fetchTweets = useCallback(
    (opts: { cursor?: string | null; limit?: number }) => searchTweets(q, opts),
    [q]
  );

  return (
    <>
      <div className="feed-head">
        <h1>{q ? q : "Search"}</h1>
        {q && (
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "people"}
              className={`tab ${tab === "people" ? "active" : ""}`}
              onClick={() => setTab("people")}
            >
              People
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "tweets"}
              className={`tab ${tab === "tweets" ? "active" : ""}`}
              onClick={() => setTab("tweets")}
            >
              Tweets
            </button>
          </div>
        )}
      </div>

      {!q ? (
        <div className="feed-status">Search for people and posts.</div>
      ) : authLoading ? (
        // Wait for the auth bootstrap so the first request carries the token
        // (correct follow-back + by-me flags), mirroring the Feed.
        <div className="feed-status">
          <div className="spinner" />
        </div>
      ) : tab === "people" ? (
        <section aria-label="People results">
          <ResultList<UserListItem>
            key={`${q}:people`}
            fetchPage={fetchPeople}
            emptyText={`No people found for "${q}"`}
            renderItem={(u) => <UserRow u={u} meHandle={user?.handle} />}
          />
        </section>
      ) : (
        <section aria-label="Tweet results">
          <ResultList<Tweet>
            key={`${q}:tweets`}
            fetchPage={fetchTweets}
            emptyText={`No posts found for "${q}"`}
            renderItem={(t, { patch, remove }) => (
              <TweetCard
                tweet={t}
                canDelete={!!user && user.id === t.authorId}
                onDelete={async (id) => {
                  await deleteTweet(id);
                  remove(id);
                }}
                onEngage={(id, p) => patch(id, p)}
              />
            )}
          />
        </section>
      )}
    </>
  );
}

/**
 * /search?q=… results (Module 8B). Reads the query from the URL and keys the
 * panel by it, so re-running a search (new `q`) resets both tabs cleanly back
 * to People. Empty/whitespace `q` shows a neutral prompt and fires no request.
 * Must be rendered inside a <Suspense> boundary (useSearchParams).
 */
export function SearchResults() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();
  return <SearchPanel key={q} q={q} />;
}
