"use client";

import type { TweetMedia } from "@/lib/api";
import type { Attachment } from "@/lib/useImageAttachments";

// Twitter-style 1–4 image grid. Used read-only in cards/detail (`MediaGrid`) and
// in an editable form with remove buttons in the composers (`AttachmentGrid`).
// Layout is driven entirely by the `count-N` class (see globals.css):
//   1 → single large · 2 → side by side · 3 → one tall + two stacked · 4 → 2×2.
//
// Plain <img> is intentional: next/image would require whitelisting the
// Cloudinary host in next.config (images.remotePatterns for res.cloudinary.com).

/** Read-only media grid for a posted tweet (feed card + focused detail). */
export function MediaGrid({ media }: { media: TweetMedia[] }) {
  if (!media || media.length === 0) return null;
  const shown = [...media].sort((a, b) => a.order - b.order).slice(0, 4);

  return (
    <div className={`media-grid count-${shown.length}`} aria-label="Attached images">
      {shown.map((m) => (
        <div className="media-cell" key={`${m.order}-${m.url}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.url} alt="" loading="lazy" />
        </div>
      ))}
    </div>
  );
}

/** Editable grid of locally-selected images with per-image remove buttons. */
export function AttachmentGrid({
  items,
  onRemove,
}: {
  items: Attachment[];
  onRemove: (key: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className={`media-grid editable count-${items.length}`}>
      {items.map((it) => (
        <div className="media-cell" key={it.key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.url} alt={it.file.name} />
          <button
            type="button"
            className="media-remove"
            aria-label={`Remove ${it.file.name}`}
            onClick={() => onRemove(it.key)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
