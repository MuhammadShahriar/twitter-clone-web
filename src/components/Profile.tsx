"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  deleteTweet,
  getUser,
  getUserLikedTweets,
  getUserTweets,
  type Tweet,
  type TweetPage,
  type UserDto,
  type UserProfile,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/Avatar";
import { EditProfileModal } from "@/components/EditProfileModal";
import { FollowButton } from "@/components/FollowButton";
import { TweetCard } from "@/components/TweetCard";
import { IconBack, IconCalendar, IconRetweet } from "@/components/icons";
import { fmtCount, monthYear } from "@/lib/format";
import { bare, isReservedHandle } from "@/lib/handles";

const PAGE_SIZE = 20;
type Tab = "tweets" | "likes";
type Status = "loading" | "ready" | "notfound" | "error";

function mergeUnique(existing: Tweet[], incoming: Tweet[]): Tweet[] {
  const seen = new Set(existing.map((t) => t.id));
  return [...existing, ...incoming.filter((t) => !seen.has(t.id))];
}

function fetchTab(
  tab: Tab,
  handle: string,
  opts: { cursor?: string | null; limit?: number }
): Promise<TweetPage> {
  return tab === "likes"
    ? getUserLikedTweets(handle, opts)
    : getUserTweets(handle, opts);
}

export function Profile({ handle }: { handle: string }) {
  const router = useRouter();
  const { user, isLoading: authLoading, updateCurrentUser } = useAuth();
  const [editing, setEditing] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("tweets");
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialDone, setInitialDone] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Active-guard for the timeline (same generation-token pattern as Feed): a
  // slow response only applies if its captured token still matches, so a tab
  // switch can't render the previous tab's tweets into the new one.
  const listGen = useRef(0);

  const isReserved = isReservedHandle(handle);

  // Load the profile header. Wait for the auth bootstrap so isFollowedByCurrentUser
  // and the tweets' *ByCurrentUser flags come back correct (same guard as Feed).
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

  // The page remounts Profile per handle (key={handle}), so `handle` is fixed
  // for a mounted instance — this loads the profile once on mount. Wait for the
  // auth bootstrap so isFollowedByCurrentUser / *ByCurrentUser flags are correct.
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

  const loadFirstPage = useCallback(async (which: Tab, h: string) => {
    const gen = ++listGen.current; // invalidate any in-flight timeline load
    setListLoading(true);
    setLoadingMore(false);
    try {
      const page = await fetchTab(which, h, { limit: PAGE_SIZE });
      if (gen !== listGen.current) return; // tab/profile changed; drop result
      setTweets(page.items);
      setNextCursor(page.nextCursor);
      setInitialDone(true);
    } catch {
      if (gen !== listGen.current) return;
      // No dedicated list-error UI; show the (empty) timeline state.
      setTweets([]);
      setNextCursor(null);
      setInitialDone(true);
    } finally {
      if (gen === listGen.current) setListLoading(false);
    }
  }, []);

  // Load the active tab's timeline once the profile is ready (and on tab switch).
  useEffect(() => {
    if (status !== "ready") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstPage(tab, handle);
  }, [status, tab, handle, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!initialDone || !nextCursor || loadingMore) return;
    const gen = listGen.current; // current timeline context; a tab switch bumps it
    setLoadingMore(true);
    try {
      const page = await fetchTab(tab, handle, { cursor: nextCursor, limit: PAGE_SIZE });
      if (gen !== listGen.current) return; // switched mid-flight; don't append
      setTweets((prev) => mergeUnique(prev, page.items));
      setNextCursor(page.nextCursor);
    } catch {
      // Leave the cursor in place so the next scroll retries this page.
    } finally {
      if (gen === listGen.current) setLoadingMore(false);
    }
  }, [tab, handle, initialDone, nextCursor, loadingMore]);

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

  const selectTab = useCallback(
    (next: Tab) => {
      if (next === tab) return;
      listGen.current++; // invalidate the tab we're leaving
      setTab(next);
      setTweets([]);
      setNextCursor(null);
      setInitialDone(false);
      setListLoading(true);
      setLoadingMore(false);
    },
    [tab]
  );

  const handleDelete = useCallback(async (id: string) => {
    await deleteTweet(id);
    setTweets((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Field-scoped optimistic patch after a like/retweet (matches the Feed fix).
  const handleEngage = useCallback((id: string, patch: Partial<Tweet>) => {
    setTweets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  // Profile edit saved (4C): update the header in place and the account chip
  // (auth state) — no reload. Only the fields the edit can change are touched.
  const handleProfileSaved = useCallback(
    (updated: UserDto) => {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: updated.displayName,
              bio: updated.bio,
              avatarUrl: updated.avatarUrl,
            }
          : prev
      );
      updateCurrentUser({
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
      });
    },
    [updateCurrentUser]
  );

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  const isOwnProfile =
    !!user && !!profile && bare(user.handle) === bare(profile.handle);

  return (
    <>
      <header className="profile-head">
        <button type="button" className="back-btn" aria-label="Back" onClick={goBack}>
          <IconBack />
        </button>
        <div className="ph-title">
          <div className="ph-name">
            {status === "ready" && profile ? profile.displayName : "Profile"}
          </div>
          {status === "ready" && profile && (
            <div className="ph-sub">{fmtCount(profile.tweetCount)} posts</div>
          )}
        </div>
      </header>

      {status === "loading" && (
        <div className="feed-status">
          <div className="spinner" />
          <p style={{ marginTop: 12 }}>Loading profile…</p>
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
        <>
          <div className="banner" />

          <div className="profile-actions-row">
            <Avatar
              seed={profile.handle}
              name={profile.displayName}
              src={profile.avatarUrl}
              className="profile-pic"
            />
            <div className="profile-action-btns">
              {isOwnProfile ? (
                <button
                  type="button"
                  className="profile-btn edit"
                  onClick={() => setEditing(true)}
                >
                  Edit profile
                </button>
              ) : (
                <FollowButton
                  handle={profile.handle}
                  isFollowing={profile.isFollowedByCurrentUser}
                  onChange={(following) =>
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            isFollowedByCurrentUser: following,
                            followerCount: Math.max(
                              0,
                              prev.followerCount + (following ? 1 : -1)
                            ),
                          }
                        : prev
                    )
                  }
                />
              )}
            </div>
          </div>

          <div className="profile-info">
            <div className="profile-name">{profile.displayName}</div>
            <div className="profile-handle">@{bare(profile.handle)}</div>
            {profile.bio && <div className="profile-bio">{profile.bio}</div>}
            <div className="profile-meta">
              <span className="profile-meta-item">
                <IconCalendar />
                Joined {monthYear(profile.createdAtUtc)}
              </span>
            </div>
            <div className="profile-counts">
              <Link
                href={`/${bare(profile.handle)}/following`}
                className="profile-count"
              >
                <b>{fmtCount(profile.followingCount)}</b>Following
              </Link>
              <Link
                href={`/${bare(profile.handle)}/followers`}
                className="profile-count"
              >
                <b>{fmtCount(profile.followerCount)}</b>Followers
              </Link>
            </div>
          </div>

          <div className="profile-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "tweets"}
              className={`tab ${tab === "tweets" ? "active" : ""}`}
              onClick={() => selectTab("tweets")}
            >
              Tweets
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "likes"}
              className={`tab ${tab === "likes" ? "active" : ""}`}
              onClick={() => selectTab("likes")}
            >
              Likes
            </button>
          </div>

          <section aria-label={tab === "likes" ? "Likes" : "Tweets"}>
            {listLoading && (
              <div className="feed-status">
                <div className="spinner" />
              </div>
            )}

            {!listLoading && tweets.length === 0 && (
              <div className="feed-status">
                {tab === "likes"
                  ? "No likes yet."
                  : `@${bare(profile.handle)} hasn't posted yet.`}
              </div>
            )}

            {!listLoading &&
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

            {!listLoading && (
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
          </section>
        </>
      )}

      {editing && profile && isOwnProfile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={handleProfileSaved}
        />
      )}
    </>
  );
}
