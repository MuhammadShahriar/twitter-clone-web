"use client";

import { useRef } from "react";
import {
  bookmarkTweet,
  likeTweet,
  retweetTweet,
  unbookmarkTweet,
  unlikeTweet,
  unretweetTweet,
  type Tweet,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

type Kind = "like" | "retweet" | "bookmark";

/**
 * Optimistic like/retweet/bookmark toggles, shared by TweetCard and
 * FocusedTweet (Module 3C, bookmark added in 6B). The owning tweet object lives
 * in the parent list/state; this hook never holds engagement state itself — it
 * reads from `tweet` and reports changes through `onChange` as a field-scoped
 * patch `(id, partial)`, so the parent stays the single source of truth and a
 * reload (which refetches authed reads) matches.
 *
 * Every update (optimistic, server reconcile, failure revert) patches ONLY the
 * field(s) owned by the action that fired it (like → liked/likeCount; retweet
 * → retweeted/retweetCount; bookmark → bookmarked, no count since bookmarks are
 * private). A whole-tweet snapshot would let a slow bookmark that later fails
 * clobber a like that already succeeded on the same tweet; a field-scoped patch
 * leaves the other actions' fields untouched.
 *
 * Flow per click:
 *   1. logged out  → prompt sign-in, fire nothing.
 *   2. in flight   → ignore (rapid-click guard, per action) so counts can't desync.
 *   3. optimistic  → flip the flag + adjust the count immediately.
 *   4. call API; on success reconcile this action's count/flag from the server
 *      response (when it returns a body), on failure revert this action's two
 *      fields to their pre-click values and surface a subtle toast.
 */
export function useEngagement(
  tweet: Tweet,
  onChange?: (id: string, patch: Partial<Tweet>) => void
) {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  // Persists across renders; one in-flight slot per action so a like and a
  // retweet can still overlap, but a second like is ignored until the first
  // settles.
  const inFlight = useRef<Record<Kind, boolean>>({
    like: false,
    retweet: false,
    bookmark: false,
  });

  async function toggle(kind: Kind) {
    if (!isAuthenticated) {
      showToast(
        kind === "like"
          ? "Sign in to like posts."
          : kind === "retweet"
            ? "Sign in to repost."
            : "Sign in to bookmark posts."
      );
      return;
    }
    if (inFlight.current[kind]) return;

    const id = tweet.id;
    const isOn =
      kind === "like"
        ? tweet.likedByCurrentUser
        : kind === "retweet"
          ? tweet.retweetedByCurrentUser
          : tweet.bookmarkedByCurrentUser;
    const delta = isOn ? -1 : 1;

    // Snapshot ONLY this action's field(s), so a failure reverts just those.
    // Bookmark has no count — it's a private toggle (Module 6).
    const snapshot: Partial<Tweet> =
      kind === "like"
        ? { likedByCurrentUser: tweet.likedByCurrentUser, likeCount: tweet.likeCount }
        : kind === "retweet"
          ? {
              retweetedByCurrentUser: tweet.retweetedByCurrentUser,
              retweetCount: tweet.retweetCount,
            }
          : { bookmarkedByCurrentUser: tweet.bookmarkedByCurrentUser };

    const optimistic: Partial<Tweet> =
      kind === "like"
        ? {
            likedByCurrentUser: !isOn,
            likeCount: Math.max(0, tweet.likeCount + delta),
          }
        : kind === "retweet"
          ? {
              retweetedByCurrentUser: !isOn,
              retweetCount: Math.max(0, tweet.retweetCount + delta),
            }
          : { bookmarkedByCurrentUser: !isOn };
    onChange?.(id, optimistic);

    inFlight.current[kind] = true;
    try {
      const call =
        kind === "like"
          ? isOn
            ? unlikeTweet
            : likeTweet
          : kind === "retweet"
            ? isOn
              ? unretweetTweet
              : retweetTweet
            : isOn
              ? unbookmarkTweet
              : bookmarkTweet;
      const server = await call(id);
      // Reconcile this action's authoritative flag/count when the API echoes the
      // tweet; a bodyless 204 leaves the (correct) optimistic state in place. We
      // patch only this action's fields so a concurrent action isn't carried.
      if (server) {
        onChange?.(
          id,
          kind === "like"
            ? {
                likedByCurrentUser: server.likedByCurrentUser,
                likeCount: server.likeCount,
              }
            : kind === "retweet"
              ? {
                  retweetedByCurrentUser: server.retweetedByCurrentUser,
                  retweetCount: server.retweetCount,
                }
              : { bookmarkedByCurrentUser: server.bookmarkedByCurrentUser }
        );
      }
      // Bookmarks give no count feedback, so a subtle toast confirms the save
      // (matching the app's tone). Like/retweet stay silent — their count moves.
      if (kind === "bookmark") {
        showToast(isOn ? "Removed from your Bookmarks" : "Added to your Bookmarks");
      }
    } catch {
      onChange?.(id, snapshot);
      showToast(
        kind === "like"
          ? isOn
            ? "Couldn't unlike. Try again."
            : "Couldn't like. Try again."
          : kind === "retweet"
            ? isOn
              ? "Couldn't undo repost. Try again."
              : "Couldn't repost. Try again."
            : isOn
              ? "Couldn't remove bookmark. Try again."
              : "Couldn't bookmark. Try again."
      );
    } finally {
      inFlight.current[kind] = false;
    }
  }

  return {
    toggleLike: () => toggle("like"),
    toggleRetweet: () => toggle("retweet"),
    toggleBookmark: () => toggle("bookmark"),
  };
}
