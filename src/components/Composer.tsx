"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, createTweet, editTweet, type QuotedTweet, type Tweet } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Avatar } from "@/components/Avatar";
import { IMAGE_ACCEPT_ATTR, useImageAttachments } from "@/lib/useImageAttachments";
import { AttachmentGrid, MediaGrid } from "@/components/MediaGrid";
import { QuotedTweetCard } from "@/components/QuotedTweetCard";
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

export function Composer({
  onPosted,
  quotedTweet,
  editing,
  onEdited,
  onDone,
  autoFocus = false,
}: {
  /** Called with the created tweet after a successful post (create/quote modes). */
  onPosted?: (tweet: Tweet) => void;
  /**
   * When set, the composer is in "quote mode" (Module 10B): it embeds this tweet
   * below the text box, requires non-empty text, and posts with `quotedTweetId`.
   */
  quotedTweet?: QuotedTweet;
  /**
   * When set, the composer is in "edit mode" (Module 11B): pre-filled with this
   * tweet's content, its media shown read-only (text-only edit), Save disabled
   * until the text is non-empty AND changed; on save it PUTs the new content.
   */
  editing?: Tweet;
  /** Called with the updated tweet after a successful edit (the edit modal patches in place). */
  onEdited?: (tweet: Tweet) => void;
  /** Called after a successful post/edit — the modals use it to close themselves. */
  onDone?: () => void;
  /** Focus the text box on mount (used when opened in a modal). */
  autoFocus?: boolean;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();
  const [text, setText] = useState(editing?.content ?? "");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const images = useImageAttachments();
  const isQuote = quotedTweet != null;
  const isEdit = editing != null;

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (autoFocus) ta.focus();
    // Edit mode mounts pre-filled: grow to fit and drop the caret at the end.
    if (isEdit) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
    }
  }, [autoFocus, isEdit]);

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
  // Backend rule: a normal tweet needs content OR an image; a quote must have
  // non-empty content (the embed is the "image"), so text is required there; an
  // edit must be non-empty AND actually changed from the original.
  const hasImages = images.items.length > 0;
  const editBaseline = editing?.content.trim() ?? "";
  const canPost =
    (isEdit
      ? trimmed.length > 0 && trimmed !== editBaseline
      : isQuote
        ? trimmed.length > 0
        : trimmed.length > 0 || hasImages) &&
    !over &&
    !posting;

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
      if (isEdit) {
        const updated = await editTweet(editing.id, trimmed);
        onEdited?.(updated);
        showToast("Your post was edited.");
        onDone?.();
        return;
      }
      const created = await createTweet({
        content: trimmed,
        quotedTweetId: quotedTweet?.id,
        images: images.items.map((i) => i.file),
      });
      onPosted?.(created);
      setText("");
      images.clear();
      if (taRef.current) taRef.current.style.height = "auto";
      onDone?.();
    } catch (err) {
      // The edit window closed (403 not author / 409 expired) between opening the
      // editor and saving: nothing more to do here, so toast + close.
      if (isEdit && err instanceof ApiError && (err.status === 403 || err.status === 409)) {
        showToast("You can no longer edit this post.");
        onDone?.();
        return;
      }
      // Otherwise keep the text (+ any selected images) so the user can retry.
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? "Failed to save your changes."
            : "Failed to post."
      );
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
        <Avatar seed={user.handle} name={user.displayName} src={user.avatarUrl} />
        <div className="compose-main">
          <textarea
            ref={taRef}
            className="compose-input"
            placeholder={
              isEdit ? "Edit your post" : isQuote ? "Add a comment" : "What's happening?"
            }
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
          {/* Edit mode (11B) is text-only: show the existing media read-only so it's
              clearly preserved, not editable. Otherwise show the new-image previews. */}
          {isEdit ? (
            <MediaGrid media={editing.media} />
          ) : (
            <AttachmentGrid items={images.items} onRemove={images.removeAt} />
          )}

          {/* Quote mode (10B): the read-only embed of the tweet being quoted. */}
          {quotedTweet && <QuotedTweetCard quoted={quotedTweet} preview />}

          <div className="compose-bar">
            {/* No media/affordance tools in edit mode (text-only). */}
            {isEdit ? (
              <span />
            ) : (
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
            )}
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
                {isEdit
                  ? posting
                    ? "Saving…"
                    : "Save"
                  : posting
                    ? "Posting…"
                    : "Post"}
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
