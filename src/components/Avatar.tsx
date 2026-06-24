import { avatarColor, initials } from "@/lib/format";

/**
 * Initials avatar (Module 3D) — the single place that renders the colored
 * initials placeholder used across the app. Real uploaded avatars arrive with
 * the profile module; swapping to a generated-avatar service is a change here
 * only. Mirrors the existing inline `.avatar` markup.
 */
export function Avatar({
  seed,
  name,
  className = "",
}: {
  /** Stable seed for the background color (use the handle). */
  seed: string;
  /** Display name the initials are derived from. */
  name: string;
  /** Extra size modifier, e.g. "sm" / "lg". */
  className?: string;
}) {
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
