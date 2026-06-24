import type { UserSuggestion } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";

/**
 * Rows of suggested users with an optimistic FollowButton each (Module 3D).
 * Shared by the right-sidebar "Who to follow" card and the Following-tab empty
 * state so following someone works the same in both places.
 */
export function SuggestionList({ users }: { users: UserSuggestion[] }) {
  return (
    <>
      {users.map((u) => (
        <div className="follow-row" key={u.id}>
          <Avatar seed={u.handle} name={u.displayName} />
          <div className="follow-meta">
            <div className="follow-name">{u.displayName}</div>
            <div className="follow-handle">@{u.handle}</div>
          </div>
          <FollowButton handle={u.handle} isFollowing={false} />
        </div>
      ))}
    </>
  );
}
