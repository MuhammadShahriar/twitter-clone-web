/**
 * Shared handle helpers (Module 7B extracted these from Profile so the profile
 * page and the followers/following list pages apply the SAME guard/normalization
 * — one source of truth, mirroring `userHandleSegment` in `api.ts`).
 *
 * App paths that must never be treated as a profile handle. Literal routes
 * (/login, /register, /tweet/…) already take precedence over the dynamic
 * `[handle]` segment in the App Router, so this is a belt-and-suspenders guard
 * that also covers reserved words which don't have a literal route yet — callers
 * short-circuit to the not-found state instead of querying the API for them.
 */
export const RESERVED_HANDLES = new Set([
  "login",
  "register",
  "tweet",
  "home",
  "explore",
  "notifications",
  "messages",
  "bookmarks",
  "settings",
  "compose",
  "search",
  "i",
  "api",
]);

/** True when a path segment is reserved (case-insensitive) and not a real profile. */
export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase());
}

/** Bare (no leading @) form, for comparing/keying handles consistently. */
export function bare(handle: string): string {
  return handle.replace(/^@+/, "");
}
