"use client";

import { useRouter } from "next/navigation";
import type { QuotedTweet, Tweet } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { bare } from "@/lib/handles";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { MediaGrid } from "@/components/MediaGrid";

/**
 * Build the one-level quoted preview from a full tweet — used when opening the
 * quote composer from a card (we already hold the whole `Tweet`, the backend only
 * gives the nested preview shape back on quote tweets). Deliberately drops any
 * nested quote so the embed stays one level deep.
 */
export function toQuotedPreview(t: Tweet): QuotedTweet {
  return {
    id: t.id,
    content: t.content,
    author: {
      handle: t.authorHandle,
      displayName: t.authorDisplayName,
      avatarUrl: t.authorAvatarUrl,
    },
    media: t.media,
    createdAtUtc: t.createdAtUtc,
  };
}

/**
 * The embedded quoted card (Module 10B): a compact, non-interactive preview of a
 * quoted tweet, bordered and inset inside the quoting tweet. It is NOT a full
 * TweetCard — no like/reply/retweet actions, and it never renders its own quoted
 * card (the backend preview is one level deep, and `QuotedTweet` has no nested
 * quote). Mentions/hashtags still render via RichText (their links stopPropagation
 * so they don't trigger this card's click-through).
 *
 * - `quoted` is an object → render the preview; clicking it opens the quoted
 *   tweet's detail (`/tweet/{id}`) with stopPropagation so the outer card's
 *   navigation doesn't also fire.
 * - `quoted` is null → render the muted "This post is unavailable" placeholder
 *   (the quoted tweet was deleted).
 * - `preview` (composer) → render read-only with no click-through / keyboard nav.
 */
export function QuotedTweetCard({
  quoted,
  preview = false,
}: {
  quoted: QuotedTweet | null;
  preview?: boolean;
}) {
  const router = useRouter();

  if (!quoted) {
    return (
      <div className="quoted-card unavailable">
        <span className="quoted-gone">This post is unavailable.</span>
      </div>
    );
  }

  const handle = bare(quoted.author.handle);
  const open = () => router.push(`/tweet/${quoted.id}`);

  // In composer preview the embed is fully read-only; in cards it click-throughs
  // to the quoted tweet (stopPropagation so the surrounding card doesn't navigate).
  const interactive = preview
    ? {}
    : {
        role: "link" as const,
        tabIndex: 0,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          open();
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        },
      };

  return (
    <div className={`quoted-card${preview ? " preview" : ""}`} {...interactive}>
      <div className="quoted-head">
        <Avatar
          seed={quoted.author.handle}
          name={quoted.author.displayName}
          src={quoted.author.avatarUrl}
          className="quoted-avatar"
        />
        <span className="quoted-name">{quoted.author.displayName}</span>
        <span className="quoted-handle">@{handle}</span>
        <span className="quoted-dot">·</span>
        <span className="quoted-time">{relativeTime(quoted.createdAtUtc)}</span>
      </div>

      {quoted.content && (
        <div className="quoted-body">
          <RichText text={quoted.content} />
        </div>
      )}

      <MediaGrid media={quoted.media} />
    </div>
  );
}

/**
 * Decides whether a tweet shows an embedded quote and which state:
 *   • `quotedTweet` object → the embedded preview card.
 *   • a quote whose target was deleted (`isQuote` true, `quotedTweet` null)
 *     → the "unavailable" placeholder.
 *   • a normal non-quote tweet (`isQuote` falsy) → nothing.
 * `isQuote` is used rather than `quotedTweet != null` because the backend quote
 * FK is SET NULL on delete, so a deleted-target quote and a non-quote both have a
 * null preview — only the delete-surviving `isQuote` flag tells them apart.
 * Rendered by TweetCard and FocusedTweet so quotes appear everywhere a tweet does.
 */
export function QuoteEmbed({ tweet }: { tweet: Tweet }) {
  if (tweet.quotedTweet) return <QuotedTweetCard quoted={tweet.quotedTweet} />;
  if (tweet.isQuote) return <QuotedTweetCard quoted={null} />;
  return null;
}
