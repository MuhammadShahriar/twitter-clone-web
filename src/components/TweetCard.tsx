"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tweet } from "@/lib/api";
import { avatarColor, fmtCount, initials, relativeTime } from "@/lib/format";
import { useEngagement } from "@/lib/useEngagement";
import { RichText } from "@/components/RichText";
import { MediaGrid } from "@/components/MediaGrid";
import {
  IconBookmark,
  IconLike,
  IconMore,
  IconReply,
  IconRetweet,
  IconShare,
  IconTrash,
} from "@/components/icons";

type ActionProps = {
  type: "reply" | "retweet" | "like" | "bookmark" | "share";
  count?: number;
  active?: boolean;
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
};

// Action-bar button. like/retweet are functional with optimistic state from
// Module 3C; bookmark/share stay visual-only (bookmark may land later, share is
// out of scope). reply/like/retweet counts are real (from the DTO).
function Action({ type, count, active, label, onClick, children }: ActionProps) {
  const [popped, setPopped] = useState(false);
  const handle = (e: React.MouseEvent) => {
    e.stopPropagation(); // never trigger the card-click navigation
    if (type === "like" && !active) {
      setPopped(true);
      setTimeout(() => setPopped(false), 300);
    }
    onClick?.();
  };
  return (
    <button
      type="button"
      className={`action ${type} ${active ? "on" : ""}`}
      onClick={handle}
      aria-pressed={active ?? undefined}
      aria-label={label}
    >
      <span className={`ico ${popped ? "like-pop" : ""}`}>{children}</span>
      {count != null && <span className="cnt">{count > 0 ? fmtCount(count) : ""}</span>}
    </button>
  );
}

export function TweetCard({
  tweet,
  canDelete = false,
  onDelete,
  onEngage,
}: {
  tweet: Tweet;
  /** True when the signed-in user authored this tweet. */
  canDelete?: boolean;
  onDelete?: (id: string) => Promise<void> | void;
  /** Field-scoped patch for this tweet after an optimistic like/retweet. */
  onEngage?: (id: string, patch: Partial<Tweet>) => void;
}) {
  const router = useRouter();
  const { toggleLike, toggleRetweet } = useEngagement(tweet, onEngage);
  // bookmark stays a local visual placeholder (not wired in 3C).
  const [bookmarked, setBookmarked] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const href = `/tweet/${tweet.id}`;

  function openTweet() {
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTweet();
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    setDeleting(true);
    try {
      await onDelete?.(tweet.id);
      // On success the parent removes this card from the feed; nothing else to do.
    } catch {
      setDeleting(false); // surface failure by re-enabling; parent owns error UI
    }
  }

  return (
    <article
      className="tweet"
      role="link"
      tabIndex={0}
      aria-label={`Tweet by ${tweet.authorDisplayName}`}
      onClick={openTweet}
      onKeyDown={onKeyDown}
      style={deleting ? { opacity: 0.5, pointerEvents: "none" } : undefined}
    >
      <span
        className="avatar"
        style={{ background: avatarColor(tweet.authorHandle) }}
      >
        {initials(tweet.authorDisplayName)}
      </span>

      <div className="tweet-main">
        <div className="tweet-head">
          <span className="t-name">{tweet.authorDisplayName}</span>
          <span className="t-handle">@{tweet.authorHandle}</span>
          <span className="t-dot">·</span>
          <span className="t-time">{relativeTime(tweet.createdAtUtc)}</span>

          {canDelete && (
            <div ref={menuRef} style={{ marginLeft: "auto", position: "relative" }}>
              <button
                type="button"
                className="t-more"
                style={{ marginLeft: 0 }}
                aria-label="More"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <IconMore />
              </button>
              {menuOpen && (
                <div className="tweet-menu" role="menu">
                  <button
                    type="button"
                    className="danger"
                    role="menuitem"
                    onClick={handleDelete}
                  >
                    <IconTrash size={18} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="tweet-body">
          <RichText text={tweet.content} />
        </div>

        <MediaGrid media={tweet.media} />

        <div className="actions">
          <Action type="reply" label="Reply" count={tweet.replyCount}>
            <IconReply />
          </Action>
          <Action
            type="retweet"
            label={tweet.retweetedByCurrentUser ? "Undo repost" : "Repost"}
            active={tweet.retweetedByCurrentUser}
            count={tweet.retweetCount}
            onClick={toggleRetweet}
          >
            <IconRetweet />
          </Action>
          <Action
            type="like"
            label={tweet.likedByCurrentUser ? "Unlike" : "Like"}
            active={tweet.likedByCurrentUser}
            count={tweet.likeCount}
            onClick={toggleLike}
          >
            <IconLike on={tweet.likedByCurrentUser} />
          </Action>
          <Action
            type="bookmark"
            label="Bookmark"
            active={bookmarked}
            onClick={() => setBookmarked((v) => !v)}
          >
            <IconBookmark on={bookmarked} />
          </Action>
          <Action type="share" label="Share">
            <IconShare />
          </Action>
        </div>
      </div>
    </article>
  );
}
