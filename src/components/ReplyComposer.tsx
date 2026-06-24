"use client";

import { useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { createTweet, type Tweet } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { avatarColor, initials } from "@/lib/format";
import { IMAGE_ACCEPT_ATTR, useImageAttachments } from "@/lib/useImageAttachments";
import { AttachmentGrid } from "@/components/MediaGrid";
import { IconImage } from "@/components/icons";

const MAX = 280;

export function ReplyComposer({
  parentId,
  replyingTo,
  onReplied,
  inputRef,
}: {
  parentId: string;
  replyingTo: string;
  onReplied: (reply: Tweet) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const images = useImageAttachments();

  if (isLoading) return null;

  if (!isAuthenticated || !user) {
    return (
      <div className="compose-gate">
        <Link href="/login">Sign in</Link> to reply to @{replyingTo}.
      </div>
    );
  }

  const trimmed = text.trim();
  const remaining = MAX - text.length;
  const over = remaining < 0;
  const hasImages = images.items.length > 0;
  const canPost = (trimmed.length > 0 || hasImages) && !over && !posting;
  const open = focused || text.length > 0 || hasImages;

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) images.addFiles(e.target.files);
    e.target.value = "";
  }

  async function handleSubmit() {
    if (!canPost) return;
    setPosting(true);
    setError(null);
    try {
      const reply = await createTweet({
        content: trimmed,
        parentId,
        images: images.items.map((i) => i.file),
      });
      onReplied(reply);
      setText("");
      images.clear();
      if (inputRef?.current) inputRef.current.style.height = "auto";
    } catch (err) {
      // Keep text + selected images so the user can retry.
      setError(err instanceof Error ? err.message : "Failed to reply.");
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
      <div className={`reply-box ${open ? "open" : ""}`}>
        <span className="avatar" style={{ background: avatarColor(user.handle) }}>
          {initials(user.displayName)}
        </span>
        <div className="reply-main">
          {open && (
            <div className="replying-to">
              Replying to <span className="tag">@{replyingTo}</span>
            </div>
          )}
          <div className="reply-row">
            <textarea
              ref={inputRef}
              className="reply-input"
              placeholder="Post your reply"
              rows={1}
              value={text}
              aria-label="Reply text"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                setText(e.target.value);
                autoGrow(e.target);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="reply-foot">
              <button
                type="button"
                className="compose-tool"
                aria-label="Add images"
                onClick={() => fileRef.current?.click()}
                disabled={posting || images.full}
              >
                <IconImage />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_ACCEPT_ATTR}
                multiple
                hidden
                onChange={onPickFiles}
              />
              {text.length > 0 && (
                <span className={counterClass}>{remaining}</span>
              )}
              <button
                type="button"
                className="btn-post"
                disabled={!canPost}
                onClick={handleSubmit}
              >
                {posting ? "Replying…" : "Reply"}
              </button>
            </div>
          </div>
          <AttachmentGrid items={images.items} onRemove={images.removeAt} />
        </div>
      </div>
      {(images.error || error) && (
        <div className="compose-error">{images.error || error}</div>
      )}
    </>
  );
}
