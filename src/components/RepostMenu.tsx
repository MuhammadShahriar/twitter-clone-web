"use client";

import { useEffect, useRef, useState } from "react";
import { IconQuote, IconRetweet } from "@/components/icons";

/**
 * The "Repost / Quote" dropdown (Module 10B) that the retweet button now opens.
 *
 * Behaviour is unchanged for plain reposts — "Repost" / "Undo repost" calls the
 * existing optimistic `onRepost` (useEngagement's toggleRetweet). "Quote" opens
 * the quote composer via `onQuote`. The menu itself owns its open state + the
 * outside-click close (same pattern as the per-tweet ⋯ delete menu); the caller
 * supplies the styled trigger via the `children` render prop so the action-bar
 * and the focused-tweet bar can each keep their own button look.
 */
export function RepostMenu({
  reposted,
  onRepost,
  onQuote,
  children,
}: {
  reposted: boolean;
  onRepost: () => void;
  onQuote: () => void;
  /** Render the trigger button; receives a toggle handler + the open state. */
  children: (args: { toggle: () => void; open: boolean }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const choose = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="repost-wrap">
      {children({ toggle: () => setOpen((v) => !v), open })}
      {open && (
        <div className="tweet-menu repost-menu" role="menu">
          <button type="button" role="menuitem" onClick={choose(onRepost)}>
            <IconRetweet size={18} />
            {reposted ? "Undo repost" : "Repost"}
          </button>
          <button type="button" role="menuitem" onClick={choose(onQuote)}>
            <IconQuote size={18} />
            Quote
          </button>
        </div>
      )}
    </div>
  );
}
