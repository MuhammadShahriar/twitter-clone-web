"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Tweet } from "@/lib/api";
import { absoluteTime, fmtCount } from "@/lib/format";
import { useEngagement } from "@/lib/useEngagement";
import { Avatar } from "@/components/Avatar";
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

type BigActionProps = {
  type: "reply" | "retweet" | "like" | "bookmark" | "share";
  active?: boolean;
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
};

function BigAction({ type, active, label, onClick, children }: BigActionProps) {
  const [popped, setPopped] = useState(false);
  const handle = () => {
    if (type === "like" && !active) {
      setPopped(true);
      setTimeout(() => setPopped(false), 300);
    }
    onClick?.();
  };
  return (
    <button
      type="button"
      className={`big-action ${type} ${active ? "on" : ""}`}
      onClick={handle}
      aria-pressed={active ?? undefined}
      aria-label={label}
    >
      <span className={`ico ${popped ? "like-pop" : ""}`}>{children}</span>
    </button>
  );
}

export function FocusedTweet({
  tweet,
  replyCount,
  canDelete = false,
  onDelete,
  onReply,
  onEngage,
}: {
  tweet: Tweet;
  /** Live reply count (Thread bumps it when a reply is posted). */
  replyCount: number;
  canDelete?: boolean;
  onDelete?: () => Promise<void> | void;
  /** Focus the reply composer. */
  onReply?: () => void;
  /** Field-scoped patch for the focused tweet after an optimistic like/retweet (Module 3C). */
  onEngage?: (id: string, patch: Partial<Tweet>) => void;
}) {
  const { toggleLike, toggleRetweet, toggleBookmark } = useEngagement(tweet, onEngage);
  // Profile URLs use the bare handle (no `@`); the DTO handle may carry one.
  const authorHref = `/${tweet.authorHandle.replace(/^@+/, "")}`;

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

  // Real engagement counts (Module 3C). Bookmarks are private (Module 6) — no
  // count is shown anywhere, so they're deliberately absent from the stats bar.
  const stats: Array<[number, string]> = [
    [replyCount, replyCount === 1 ? "Reply" : "Replies"],
    [tweet.retweetCount, "Reposts"],
    [tweet.likeCount, "Likes"],
  ];
  const shownStats = stats.filter(([n]) => n > 0);

  async function handleDelete() {
    setMenuOpen(false);
    setDeleting(true);
    try {
      await onDelete?.();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <article
      className="focused"
      style={deleting ? { opacity: 0.5, pointerEvents: "none" } : undefined}
    >
      <div className="focused-head">
        <Link href={authorHref} className="avatar-link" aria-label={`${tweet.authorDisplayName} profile`}>
          <Avatar
            seed={tweet.authorHandle}
            name={tweet.authorDisplayName}
            src={tweet.authorAvatarUrl}
            className="lg"
          />
        </Link>
        <div className="focused-id">
          <Link href={authorHref} className="focused-name link-name">
            {tweet.authorDisplayName}
          </Link>
          <div className="focused-handle">@{tweet.authorHandle}</div>
        </div>

        {canDelete && (
          <div ref={menuRef} style={{ position: "relative", flex: "none" }}>
            <button
              type="button"
              className="focused-more"
              aria-label="More"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
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

      <div className="focused-text">
        <RichText text={tweet.content} />
      </div>

      <MediaGrid media={tweet.media} />

      <div className="focused-meta">{absoluteTime(tweet.createdAtUtc)}</div>

      {shownStats.length > 0 && (
        <div className="stats-bar">
          {shownStats.map(([n, label]) => (
            <div className="stat" key={label}>
              <b>{fmtCount(n)}</b> <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="big-bar">
        <BigAction type="reply" label="Reply" onClick={onReply}>
          <IconReply size={22} />
        </BigAction>
        <BigAction
          type="retweet"
          label={tweet.retweetedByCurrentUser ? "Undo repost" : "Repost"}
          active={tweet.retweetedByCurrentUser}
          onClick={toggleRetweet}
        >
          <IconRetweet size={22} />
        </BigAction>
        <BigAction
          type="like"
          label={tweet.likedByCurrentUser ? "Unlike" : "Like"}
          active={tweet.likedByCurrentUser}
          onClick={toggleLike}
        >
          <IconLike size={22} on={tweet.likedByCurrentUser} />
        </BigAction>
        <BigAction
          type="bookmark"
          label={tweet.bookmarkedByCurrentUser ? "Remove bookmark" : "Bookmark"}
          active={tweet.bookmarkedByCurrentUser}
          onClick={toggleBookmark}
        >
          <IconBookmark size={22} on={tweet.bookmarkedByCurrentUser} />
        </BigAction>
        <BigAction type="share" label="Share">
          <IconShare size={22} />
        </BigAction>
      </div>
    </article>
  );
}
