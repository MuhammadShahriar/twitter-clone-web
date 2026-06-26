"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getFollowers,
  getFollowing,
  getUser,
  type UserListItem,
  type UserListPage,
  type UserProfile,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { UserRow } from "@/components/UserRow";
import { IconBack } from "@/components/icons";
import { bare, isReservedHandle } from "@/lib/handles";

const PAGE_SIZE = 20;

export type FollowListMode = "followers" | "following";
type Status = "loading" | "ready" | "notfound" | "error";

function mergeUnique(existing: UserListItem[], incoming: UserListItem[]): UserListItem[] {
  const seen = new Set(existing.map((u) => u.id));
  return [...existing, ...incoming.filter((u) => !seen.has(u.id))];
}

function fetchList(
  mode: FollowListMode,
  handle: string,
  opts: { cursor?: string | null; limit?: number }
): Promise<UserListPage> {
  return mode === "followers"
    ? getFollowers(handle, opts)
    : getFollowing(handle, opts);
}

/**
 * /{handle}/followers and /{handle}/following (Module 7B). One component, two
 * modes — the page route picks the mode and remounts via key on handle+mode so
 * state resets cleanly between lists/profiles. Reuses the profile's header +
 * 404/error states, the feed's infinite-scroll + active-guard, and FollowButton
 * for follow-back. `handle` is fixed for a mounted instance (key remount).
 */
export function FollowList({
  handle,
  mode,
}: {
  handle: string;
  mode: FollowListMode;
}) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Header user (display name + 404 detection), loaded like the profile page.
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [items, setItems] = useState<UserListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialDone, setInitialDone] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Active-guard generation token (same as Profile/Feed): a slow response only
  // applies if its captured token still matches.
  const listGen = useRef(0);

  const isReserved = isReservedHandle(handle);
  const bareHandle = bare(handle);

  const loadProfile = useCallback(
    async (h: string, isActive: () => boolean) => {
      setStatus("loading");
      setErrorMsg(null);
      setProfile(null);
      try {
        const p = await getUser(h);
        if (!isActive()) return;
        setProfile(p);
        setStatus("ready");
      } catch (err) {
        if (!isActive()) return;
        if (err instanceof ApiError && err.status === 404) {
          setStatus("notfound");
        } else {
          setErrorMsg(err instanceof Error ? err.message : "Failed to load profile.");
          setStatus("error");
        }
      }
    },
    []
  );

  // Wait for the auth bootstrap so each row's isFollowedByCurrentUser is correct.
  useEffect(() => {
    if (isReserved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("notfound");
      return;
    }
    if (authLoading) return;
    let active = true;
    loadProfile(handle, () => active);
    return () => {
      active = false;
    };
  }, [handle, isReserved, authLoading, loadProfile]);

  const loadFirstPage = useCallback(async (m: FollowListMode, h: string) => {
    const gen = ++listGen.current;
    setListLoading(true);
    setLoadingMore(false);
    try {
      const page = await fetchList(m, h, { limit: PAGE_SIZE });
      if (gen !== listGen.current) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setInitialDone(true);
    } catch {
      if (gen !== listGen.current) return;
      // No dedicated list-error UI; fall back to the (empty) list state.
      setItems([]);
      setNextCursor(null);
      setInitialDone(true);
    } finally {
      if (gen === listGen.current) setListLoading(false);
    }
  }, []);

  // Load the list once the header user is confirmed to exist.
  useEffect(() => {
    if (status !== "ready") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstPage(mode, handle);
  }, [status, mode, handle, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!initialDone || !nextCursor || loadingMore) return;
    const gen = listGen.current;
    setLoadingMore(true);
    try {
      const page = await fetchList(mode, handle, { cursor: nextCursor, limit: PAGE_SIZE });
      if (gen !== listGen.current) return;
      setItems((prev) => mergeUnique(prev, page.items));
      setNextCursor(page.nextCursor);
    } catch {
      // Leave the cursor in place so the next scroll retries this page.
    } finally {
      if (gen === listGen.current) setLoadingMore(false);
    }
  }, [mode, handle, initialDone, nextCursor, loadingMore]);

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

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push(`/${bareHandle}`);
  }

  return (
    <>
      <header className="profile-head">
        <button type="button" className="back-btn" aria-label="Back" onClick={goBack}>
          <IconBack />
        </button>
        <div className="ph-title">
          <div className="ph-name">
            {status === "ready" && profile ? profile.displayName : `@${bareHandle}`}
          </div>
          <div className="ph-sub">@{bareHandle}</div>
        </div>
      </header>

      {/* Followers / Following tabs — links to the sibling route (remounts). */}
      <div className="profile-tabs" role="tablist">
        <Link
          href={`/${bareHandle}/followers`}
          role="tab"
          aria-selected={mode === "followers"}
          className={`tab ${mode === "followers" ? "active" : ""}`}
        >
          Followers
        </Link>
        <Link
          href={`/${bareHandle}/following`}
          role="tab"
          aria-selected={mode === "following"}
          className={`tab ${mode === "following" ? "active" : ""}`}
        >
          Following
        </Link>
      </div>

      {status === "loading" && (
        <div className="feed-status">
          <div className="spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      )}

      {status === "notfound" && (
        <div className="feed-status">
          <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 17 }}>
            This account doesn&apos;t exist
          </p>
          <p style={{ marginTop: 4 }}>Try searching for another.</p>
          <button type="button" className="retry" onClick={() => router.push("/")}>
            Back to home
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="feed-status">
          <p style={{ color: "var(--error, #f4212e)" }}>{errorMsg}</p>
          <button
            type="button"
            className="retry"
            onClick={() => loadProfile(handle, () => true)}
          >
            Retry
          </button>
        </div>
      )}

      {status === "ready" && profile && (
        <section aria-label={mode === "followers" ? "Followers" : "Following"}>
          {listLoading && (
            <div className="feed-status">
              <div className="spinner" />
            </div>
          )}

          {!listLoading && items.length === 0 && (
            <div className="feed-status">
              {mode === "followers"
                ? `@${bareHandle} doesn't have any followers yet.`
                : `@${bareHandle} isn't following anyone yet.`}
            </div>
          )}

          {!listLoading &&
            items.map((u) => (
              <UserRow key={u.id} u={u} meHandle={user?.handle} />
            ))}

          {!listLoading && (
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
        </section>
      )}
    </>
  );
}
