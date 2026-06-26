"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Tweet } from "@/lib/api";
import { fmtCount, relativeTime, withinEditWindow } from "@/lib/format";
import { useEngagement } from "@/lib/useEngagement";
import { useQuoteComposer } from "@/context/QuoteComposerContext";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { MediaGrid } from "@/components/MediaGrid";
import { QuoteEmbed, toQuotedPreview } from "@/components/QuotedTweetCard";
import { RepostMenu } from "@/components/RepostMenu";
import { EditTweetModal } from "@/components/EditTweetModal";
import {
  IconBookmark,
  IconEdit,
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

// Action-bar button. like/retweet/bookmark are functional with optimistic state
// (like/retweet from Module 3C, bookmark from 6B); share stays visual-only (out
// of scope). reply/like/retweet show real counts; bookmark is a private toggle
// with no count.
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
  const { toggleLike, toggleRetweet, toggleBookmark } = useEngagement(tweet, onEngage);
  const { openQuote } = useQuoteComposer();

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Edit is author-only (same gate as Delete) AND only within the edit window —
  // past it the API returns 409, so hiding it is the clean UX. Recomputed each
  // render (e.g. when the menu opens), so it's fresh enough without a timer.
  const canEdit = canDelete && withinEditWindow(tweet.createdAtUtc);

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
  // Profile URLs use the bare handle (no `@`); the API/DTO handle may carry one.
  const authorHref = `/${tweet.authorHandle.replace(/^@+/, "")}`;
  // Author links live inside the card's role="link" click target, so they must
  // stop propagation to avoid also triggering the tweet-detail navigation.
  const stopCardNav = (e: React.MouseEvent) => e.stopPropagation();

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
    <>
    <article
      className="tweet"
      role="link"
      tabIndex={0}
      aria-label={`Tweet by ${tweet.authorDisplayName}`}
      onClick={openTweet}
      onKeyDown={onKeyDown}
      style={deleting ? { opacity: 0.5, pointerEvents: "none" } : undefined}
    >
      <Link
        href={authorHref}
        className="avatar-link"
        onClick={stopCardNav}
        aria-label={`${tweet.authorDisplayName} profile`}
      >
        <Avatar
          seed={tweet.authorHandle}
          name={tweet.authorDisplayName}
          src={tweet.authorAvatarUrl}
        />
      </Link>

      <div className="tweet-main">
        <div className="tweet-head">
          <Link href={authorHref} className="t-name link-name" onClick={stopCardNav}>
            {tweet.authorDisplayName}
          </Link>
          <span className="t-handle">@{tweet.authorHandle}</span>
          <span className="t-dot">·</span>
          <span className="t-time">{relativeTime(tweet.createdAtUtc)}</span>
          {tweet.editedAtUtc && (
            <>
              <span className="t-dot">·</span>
              <span className="t-edited" title="Edited">
                Edited
              </span>
            </>
          )}

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
                  {canEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        setEditing(true);
                      }}
                    >
                      <IconEdit size={18} />
                      Edit
                    </button>
                  )}
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

        <QuoteEmbed tweet={tweet} />

        <div className="actions">
          <Action type="reply" label="Reply" count={tweet.replyCount}>
            <IconReply />
          </Action>
          <RepostMenu
            reposted={tweet.retweetedByCurrentUser}
            onRepost={toggleRetweet}
            onQuote={() => openQuote(toQuotedPreview(tweet))}
          >
            {({ toggle, open }) => (
              <button
                type="button"
                className={`action retweet ${tweet.retweetedByCurrentUser ? "on" : ""}`}
                aria-label={tweet.retweetedByCurrentUser ? "Undo repost" : "Repost"}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(e) => {
                  e.stopPropagation(); // never trigger the card-click navigation
                  toggle();
                }}
              >
                <span className="ico">
                  <IconRetweet />
                </span>
                <span className="cnt">
                  {tweet.retweetCount > 0 ? fmtCount(tweet.retweetCount) : ""}
                </span>
              </button>
            )}
          </RepostMenu>
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
            label={tweet.bookmarkedByCurrentUser ? "Remove bookmark" : "Bookmark"}
            active={tweet.bookmarkedByCurrentUser}
            onClick={toggleBookmark}
          >
            <IconBookmark on={tweet.bookmarkedByCurrentUser} />
          </Action>
          <Action type="share" label="Share">
            <IconShare />
          </Action>
        </div>
      </div>
    </article>

      {/* Rendered as a sibling of the card (not a child) so its clicks never bubble
          to the card's role="link" navigation — no stopPropagation gymnastics. */}
      {editing && (
        <EditTweetModal
          tweet={tweet}
          onEdited={(updated) =>
            onEngage?.(tweet.id, {
              content: updated.content,
              editedAtUtc: updated.editedAtUtc,
            })
          }
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
