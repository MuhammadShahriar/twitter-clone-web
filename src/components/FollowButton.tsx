"use client";

import { useRef, useState } from "react";
import { followUser, unfollowUser } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

/**
 * Optimistic follow/unfollow pill (Module 3D), same pattern as the 3C
 * engagement toggles: flip immediately, call the API in the background, revert +
 * toast on failure, ignore re-clicks while in flight. Shows "Follow" when not
 * following and "Following" when following, swapping to a red "Unfollow" on
 * hover. Owns its follow-state after mount; `isFollowing` is the initial value.
 */
export function FollowButton({
  handle,
  isFollowing,
  onChange,
}: {
  handle: string;
  isFollowing: boolean;
  /** Notified with the new follow-state after each optimistic toggle. */
  onChange?: (following: boolean) => void;
}) {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [following, setFollowing] = useState(isFollowing);
  const [hover, setHover] = useState(false);
  const inFlight = useRef(false);

  async function toggle() {
    if (!isAuthenticated) {
      showToast("Sign in to follow people.");
      return;
    }
    if (inFlight.current) return;

    const next = !following;
    setFollowing(next); // optimistic
    onChange?.(next);

    inFlight.current = true;
    try {
      if (next) await followUser(handle);
      else await unfollowUser(handle);
    } catch {
      setFollowing(!next); // revert
      onChange?.(!next);
      showToast(next ? "Couldn't follow. Try again." : "Couldn't unfollow. Try again.");
    } finally {
      inFlight.current = false;
    }
  }

  const label = following ? (hover ? "Unfollow" : "Following") : "Follow";

  return (
    <button
      type="button"
      className={`follow-pill ${following ? "following" : ""} ${
        following && hover ? "danger" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={following}
      aria-label={`${label} @${handle}`}
    >
      {label}
    </button>
  );
}
