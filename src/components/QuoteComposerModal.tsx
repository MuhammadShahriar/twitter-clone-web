"use client";

import { useEffect } from "react";
import type { QuotedTweet, Tweet } from "@/lib/api";
import { Composer } from "@/components/Composer";
import { IconClose } from "@/components/icons";

/**
 * Quote composer modal (Module 10B). A thin shell — overlay + close affordance —
 * around the existing `Composer` in quote mode. The Composer owns the text box,
 * the embedded quoted card, image attachments and the Post button; on a
 * successful post it calls `onPosted` (so the feed can prepend the new quote) and
 * then `onDone`/`onClose` to dismiss. Scroll-lock + Esc-to-close mirror the
 * edit-profile modal.
 */
export function QuoteComposerModal({
  quoted,
  onPosted,
  onClose,
}: {
  quoted: QuotedTweet;
  onPosted: (tweet: Tweet) => void;
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
        aria-label="Quote post"
      >
        <header className="modal-head">
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <IconClose size={20} />
          </button>
          <h2 className="modal-title">Quote</h2>
        </header>

        <div className="modal-body quote-modal-body">
          <Composer quotedTweet={quoted} onPosted={onPosted} onDone={onClose} autoFocus />
        </div>
      </div>
    </div>
  );
}
