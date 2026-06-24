import Link from "next/link";
import type { UserSuggestion } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";

/**
 * Rows of suggested users with an optimistic FollowButton each (Module 3D).
 * Shared by the right-sidebar "Who to follow" card and the Following-tab empty
 * state. The avatar + name link to the user's profile (4B); the URL handle is
 * bare (no `@`), so strip any leading `@` before building it.
 */
export function SuggestionList({ users }: { users: UserSuggestion[] }) {
  return (
    <>
      {users.map((u) => {
        const bare = u.handle.replace(/^@+/, "");
        return (
          <div className="follow-row" key={u.id}>
            <Link
              href={`/${bare}`}
              className="avatar-link"
              aria-label={`${u.displayName} profile`}
            >
              <Avatar seed={u.handle} name={u.displayName} src={u.avatarUrl} />
            </Link>
            <div className="follow-meta">
              <Link href={`/${bare}`} className="follow-name link-name">
                {u.displayName}
              </Link>
              <div className="follow-handle">@{bare}</div>
            </div>
            <FollowButton handle={u.handle} isFollowing={false} />
          </div>
        );
      })}
    </>
  );
}
