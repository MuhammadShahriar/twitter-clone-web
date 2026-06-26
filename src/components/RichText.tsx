"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { bare } from "@/lib/handles";

// Candidate @mention / #hashtag tokens. The highlight set keeps the Bangla
// codepoints (ঀ-৿) from 2B so Bangla tags still light up, but only ASCII
// letters/digits/underscore tokens become real *links* — that's the charset the
// backend uses to parse + notify mentions, so a clickable token matches exactly
// what the API recognized (and an email's "@" or a bare "#" isn't mis-linked).
const TOKEN_RE = /[@#][\wঀ-৿]+/g;
const LINKABLE = /^[@#][A-Za-z0-9_]+$/;
// A token only starts at a boundary: the @/# must not be glued onto a preceding
// word char (so "foo@bar.com" stays plain text) or another @/#.
const BOUNDARY = /[\wঀ-৿@#]/;

/**
 * Render tweet text with clickable @mentions (→ profile) and #hashtags
 * (→ tweet search). XSS-safe by construction: every token is a React element or
 * a plain-string child — never `dangerouslySetInnerHTML` / raw HTML. The token
 * links `stopPropagation` so clicking one doesn't also open the parent tweet.
 * Used by TweetCard (feed + replies) and FocusedTweet (detail).
 */
export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;

  // matchAll iterates without mutating TOKEN_RE's lastIndex (no shared state).
  for (const m of text.matchAll(TOKEN_RE)) {
    const tok = m[0];
    const start = m.index ?? 0;

    // Glued to a preceding word/@/# char → not a token start. Leave it in the
    // plain run (it'll be emitted by the next slice) and keep scanning.
    const prev = start > 0 ? text[start - 1] : "";
    if (prev && BOUNDARY.test(prev)) continue;

    // Flush the plain text since the last emitted token.
    if (start > last) {
      out.push(<Fragment key={key++}>{text.slice(last, start)}</Fragment>);
    }

    if (LINKABLE.test(tok)) {
      const href =
        tok[0] === "@"
          ? `/${bare(tok.slice(1))}` // profile route uses the bare handle
          : `/search?q=${encodeURIComponent(tok)}`; // keep the # so the search finds hashtag uses
      out.push(
        <Link
          key={key++}
          href={href}
          className="tag"
          onClick={(e) => e.stopPropagation()}
        >
          {tok}
        </Link>
      );
    } else {
      // Non-ASCII tag (e.g. Bangla): keep the display-only highlight, no link.
      out.push(
        <span key={key++} className="tag">
          {tok}
        </span>
      );
    }

    last = start + tok.length;
  }

  if (last < text.length) {
    out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  }

  return <>{out}</>;
}
