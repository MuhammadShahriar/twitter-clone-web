"use client";

import { useRef } from "react";
import {
  likeTweet,
  retweetTweet,
  unlikeTweet,
  unretweetTweet,
  type Tweet,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

type Kind = "like" | "retweet";

/**
 * Optimistic like/retweet toggles, shared by TweetCard and FocusedTweet
 * (Module 3C). The owning tweet object lives in the parent list/state; this
 * hook never holds engagement state itself — it reads from `tweet` and reports
 * changes through `onChange` as a field-scoped patch `(id, partial)`, so the
 * parent stays the single source of truth and a reload (which refetches authed
 * reads) matches.
 *
 * Every update (optimistic, server reconcile, failure revert) patches ONLY the
 * two fields owned by the action that fired it (like → liked/likeCount; retweet
 * → retweeted/retweetCount). A whole-tweet snapshot would let a slow like that
 * later fails clobber a retweet that already succeeded on the same tweet; a
 * field-scoped patch leaves the other action's fields untouched.
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
  const inFlight = useRef<Record<Kind, boolean>>({ like: false, retweet: false });

  async function toggle(kind: Kind) {
    if (!isAuthenticated) {
      showToast(kind === "like" ? "Sign in to like posts." : "Sign in to repost.");
      return;
    }
    if (inFlight.current[kind]) return;

    const id = tweet.id;
    const isOn =
      kind === "like" ? tweet.likedByCurrentUser : tweet.retweetedByCurrentUser;
    const delta = isOn ? -1 : 1;

    // Snapshot ONLY this action's two fields, so a failure reverts just those.
    const snapshot: Partial<Tweet> =
      kind === "like"
        ? { likedByCurrentUser: tweet.likedByCurrentUser, likeCount: tweet.likeCount }
        : {
            retweetedByCurrentUser: tweet.retweetedByCurrentUser,
            retweetCount: tweet.retweetCount,
          };

    const optimistic: Partial<Tweet> =
      kind === "like"
        ? {
            likedByCurrentUser: !isOn,
            likeCount: Math.max(0, tweet.likeCount + delta),
          }
        : {
            retweetedByCurrentUser: !isOn,
            retweetCount: Math.max(0, tweet.retweetCount + delta),
          };
    onChange?.(id, optimistic);

    inFlight.current[kind] = true;
    try {
      const call =
        kind === "like"
          ? isOn
            ? unlikeTweet
            : likeTweet
          : isOn
            ? unretweetTweet
            : retweetTweet;
      const server = await call(id);
      // Reconcile this action's authoritative count/flag when the API echoes the
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
            : {
                retweetedByCurrentUser: server.retweetedByCurrentUser,
                retweetCount: server.retweetCount,
              }
        );
      }
    } catch {
      onChange?.(id, snapshot);
      showToast(
        kind === "like"
          ? isOn
            ? "Couldn't unlike. Try again."
            : "Couldn't like. Try again."
          : isOn
            ? "Couldn't undo repost. Try again."
            : "Couldn't repost. Try again."
      );
    } finally {
      inFlight.current[kind] = false;
    }
  }

  return {
    toggleLike: () => toggle("like"),
    toggleRetweet: () => toggle("retweet"),
  };
}
