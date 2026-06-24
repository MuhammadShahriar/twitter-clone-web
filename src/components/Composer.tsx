"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createTweet, type Tweet } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { avatarColor, initials } from "@/lib/format";
import { IMAGE_ACCEPT_ATTR, useImageAttachments } from "@/lib/useImageAttachments";
import { AttachmentGrid } from "@/components/MediaGrid";
import {
  IconEmoji,
  IconGif,
  IconImage,
  IconPoll,
  IconSchedule,
} from "@/components/icons";

const MAX = 280;
// IconImage is rendered separately as a real button; the rest stay decorative.
const DECOR_TOOLS = [IconGif, IconPoll, IconEmoji, IconSchedule];

export function Composer({ onPosted }: { onPosted: (tweet: Tweet) => void }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const images = useImageAttachments();

  // Don't flash the gate before the auth bootstrap resolves.
  if (isLoading) return null;

  if (!isAuthenticated || !user) {
    return (
      <div className="compose-gate">
        <Link href="/login">Sign in</Link> to post what&apos;s happening.
      </div>
    );
  }

  const trimmed = text.trim();
  const remaining = MAX - text.length;
  const over = remaining < 0;
  // Backend rule: content OR at least one image.
  const hasImages = images.items.length > 0;
  const canPost = (trimmed.length > 0 || hasImages) && !over && !posting;

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) images.addFiles(e.target.files);
    e.target.value = ""; // allow re-picking the same file after a remove
  }

  async function handleSubmit() {
    if (!canPost) return;
    setPosting(true);
    setError(null);
    try {
      const created = await createTweet({
        content: trimmed,
        images: images.items.map((i) => i.file),
      });
      onPosted(created);
      setText("");
      images.clear();
      if (taRef.current) taRef.current.style.height = "auto";
    } catch (err) {
      // Keep text + selected images so the user can retry.
      setError(err instanceof Error ? err.message : "Failed to post.");
    } finally {
      setPosting(false);
    }
  }

  const counterClass = over
    ? "char-count over"
    : remaining <= 20
      ? "char-count warn"
      : "char-count";

  return (
    <>
      <div className="compose">
        <span className="avatar" style={{ background: avatarColor(user.handle) }}>
          {initials(user.displayName)}
        </span>
        <div className="compose-main">
          <textarea
            ref={taRef}
            className="compose-input"
            placeholder="What's happening?"
            rows={1}
            value={text}
            aria-label="Tweet text"
            onChange={(e) => {
              setText(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter to post, matching common composer UX.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <AttachmentGrid items={images.items} onRemove={images.removeAt} />

          <div className="compose-bar">
            <div className="compose-tools">
              <button
                type="button"
                className="compose-tool"
                aria-label="Add images"
                onClick={() => fileRef.current?.click()}
                disabled={posting || images.full}
              >
                <IconImage />
              </button>
              {DECOR_TOOLS.map((Tool, i) => (
                <span className="compose-tool" key={i} aria-hidden>
                  <Tool />
                </span>
              ))}
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_ACCEPT_ATTR}
                multiple
                hidden
                onChange={onPickFiles}
              />
            </div>
            <div className="compose-right">
              {text.length > 0 && (
                <span className={counterClass}>{remaining}</span>
              )}
              <button
                type="button"
                className="btn-post"
                disabled={!canPost}
                onClick={handleSubmit}
              >
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {(images.error || error) && (
        <div className="compose-error">{images.error || error}</div>
      )}
    </>
  );
}
