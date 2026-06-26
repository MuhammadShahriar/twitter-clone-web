"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserListItem } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { bare } from "@/lib/handles";

/**
 * One user row: avatar + name + @handle + bio, follow-back pill on the right.
 * Shared by the followers/following lists (Module 7B) and the search People
 * results (Module 8B). The whole row navigates to the profile; the inner links
 * and the FollowButton stop propagation so they act on their own target, not
 * the row. `meHandle` hides the pill on your own row ("don't follow yourself").
 */
export function UserRow({ u, meHandle }: { u: UserListItem; meHandle?: string }) {
  const router = useRouter();
  const bareHandle = bare(u.handle);
  const isMe = meHandle != null && bare(meHandle) === bareHandle;
  const profileHref = `/${bareHandle}`;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  function open() {
    router.push(profileHref);
  }

  return (
    <div
      className="follow-row"
      role="link"
      tabIndex={0}
      aria-label={`${u.displayName} profile`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <Link
        href={profileHref}
        className="avatar-link"
        onClick={stop}
        aria-label={`${u.displayName} profile`}
      >
        <Avatar seed={u.handle} name={u.displayName} src={u.avatarUrl} />
      </Link>
      <div className="follow-meta">
        <Link href={profileHref} className="follow-name link-name" onClick={stop}>
          {u.displayName}
        </Link>
        <div className="follow-handle">@{bareHandle}</div>
        {u.bio && <div className="follow-bio">{u.bio}</div>}
      </div>
      {!isMe && (
        <FollowButton handle={u.handle} isFollowing={u.isFollowedByCurrentUser} />
      )}
    </div>
  );
}
