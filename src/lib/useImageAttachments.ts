"use client";

// Local image selection + preview state shared by the home composer and the
// reply composer (Module 2D). Files are previewed locally with object URLs and
// only uploaded when the tweet is posted ("upload first" happens server-side as
// part of the single multipart POST). Limits mirror the backend so the user
// gets instant feedback instead of a 400.

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, matches the API
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
/** Value for an <input type="file"> accept attribute. */
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

export interface Attachment {
  /** Stable key for React lists + removal (object URLs can repeat across files). */
  key: string;
  file: File;
  /** Object URL for the local preview; revoked on remove/clear/unmount. */
  url: string;
}

export interface ImageAttachments {
  items: Attachment[];
  error: string | null;
  /** True once 4 images are selected — used to disable the picker button. */
  full: boolean;
  addFiles: (files: FileList | File[]) => void;
  removeAt: (key: string) => void;
  clear: () => void;
}

export function useImageAttachments(): ImageAttachments {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mirror of `items` so addFiles can validate against the current selection
  // without going through a functional updater (object-URL creation is a side
  // effect that must not run inside an updater — it would leak in StrictMode).
  const itemsRef = useRef<Attachment[]>([]);
  const counter = useRef(0);

  const commit = useCallback((next: Attachment[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const current = itemsRef.current;
      const additions: Attachment[] = [];
      let rejection: string | null = null;

      for (const file of Array.from(files)) {
        if (current.length + additions.length >= MAX_IMAGES) {
          rejection = `You can attach up to ${MAX_IMAGES} images.`;
          break;
        }
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
          rejection = "Only JPEG, PNG, WebP or GIF images are allowed.";
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          rejection = "Each image must be 5 MB or smaller.";
          continue;
        }
        additions.push({
          key: `img-${counter.current++}`,
          file,
          url: URL.createObjectURL(file),
        });
      }

      if (additions.length) commit([...current, ...additions]);
      setError(rejection);
    },
    [commit]
  );

  const removeAt = useCallback(
    (key: string) => {
      const target = itemsRef.current.find((i) => i.key === key);
      if (target) URL.revokeObjectURL(target.url);
      commit(itemsRef.current.filter((i) => i.key !== key));
      setError(null);
    },
    [commit]
  );

  const clear = useCallback(() => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    commit([]);
    setError(null);
  }, [commit]);

  // Safety net: revoke any URLs still alive when the composer unmounts.
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, []);

  return { items, error, full: items.length >= MAX_IMAGES, addFiles, removeAt, clear };
}
