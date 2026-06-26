"use client";

import { useEffect } from "react";
import type { Tweet } from "@/lib/api";
import { Composer } from "@/components/Composer";
import { IconClose } from "@/components/icons";

/**
 * Edit-tweet modal (Module 11B). A thin shell — overlay + close affordance —
 * around the existing `Composer` in edit mode (reusing the quote-modal styling).
 * The Composer owns the pre-filled text box, the read-only existing media, and
 * the Save button; on a successful edit it calls `onEdited` (so the card/detail
 * can patch the tweet in place) then `onClose`/`onDone` to dismiss. The X (and
 * Esc / backdrop) act as Cancel. Scroll-lock + Esc mirror the other modals.
 */
export function EditTweetModal({
  tweet,
  onEdited,
  onClose,
}: {
  tweet: Tweet;
  onEdited: (updated: Tweet) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal quote-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit post"
      >
        <header className="modal-head">
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Cancel"
          >
            <IconClose size={20} />
          </button>
          <h2 className="modal-title">Edit post</h2>
        </header>

        <div className="modal-body quote-modal-body">
          <Composer editing={tweet} onEdited={onEdited} onDone={onClose} autoFocus />
        </div>
      </div>
    </div>
  );
}
