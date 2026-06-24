import { avatarColor, initials } from "@/lib/format";

/**
 * Avatar (Module 3D, image support added in 4B) — the single place that renders
 * a user avatar across the app. When `src` (an `avatarUrl`) is provided it shows
 * the uploaded image; otherwise it falls back to the colored initials
 * placeholder. Size/shape come from the `.avatar` class (+ modifiers).
 */
export function Avatar({
  seed,
  name,
  src,
  className = "",
}: {
  /** Stable seed for the fallback background color (use the handle). */
  seed: string;
  /** Display name the initials are derived from. */
  name: string;
  /** Uploaded avatar URL; null/undefined → initials fallback. */
  src?: string | null;
  /** Extra size modifier, e.g. "sm" / "lg". */
  className?: string;
}) {
  if (src) {
    return (
      <span className={`avatar ${className}`.trim()} aria-hidden>
        {/* Plain <img>: avatars are small, fixed-size, external (Cloudinary) URLs;
            next/image's optimizer/loader adds no benefit here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="avatar-img" src={src} alt="" />
      </span>
    );
  }
  return (
    <span
      className={`avatar ${className}`.trim()}
      style={{ background: avatarColor(seed) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
