// API client for the Twitter clone backend (Module 1 — auth wired).
//
// Auth strategy (mirrors the backend):
//   • The access token lives in memory only (the module-scoped variable below) —
//     never localStorage/sessionStorage.
//   • The refresh token is an httpOnly cookie the browser stores and sends
//     automatically when a request uses `credentials: "include"`. JS never reads it.
//   • On a 401 from a protected call, fetchWithAuth calls /api/auth/refresh once,
//     updates the in-memory token, and retries the original request once.

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

function apiUrl(path: string): string {
  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Add it to .env.local (see .env.example)."
    );
  }
  return `${baseUrl}${path}`;
}

/** Error carrying the HTTP status so callers can branch (401 vs 423 vs 400). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---- Types (mirror the API DTOs exactly; camelCase JSON) ----

/** One image attached to a tweet (Module 2D). `publicId` is never exposed to clients. */
export interface TweetMedia {
  url: string;
  order: number;
}

/** Who reposted a tweet into the Following feed (Module 3B/3D); null otherwise. */
export interface RetweetedBy {
  handle: string;
  displayName: string;
}

export interface Tweet {
  id: string;
  content: string;
  /** Parent tweet id when this is a reply; null for top-level tweets. */
  parentId: string | null;
  /** Number of direct replies (Module 2A). */
  replyCount: number;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  /** Author's uploaded avatar URL (Module 4B); null when unset → initials fallback. */
  authorAvatarUrl: string | null;
  createdAtUtc: string; // ISO 8601 UTC
  /** Attached images, ordered (Module 2D); empty array when none. */
  media: TweetMedia[];
  /** Total likes (Module 3A). */
  likeCount: number;
  /** Total retweets (Module 3A). */
  retweetCount: number;
  /** Whether the authenticated caller has liked this tweet (false when anonymous). */
  likedByCurrentUser: boolean;
  /** Whether the authenticated caller has retweeted this tweet (false when anonymous). */
  retweetedByCurrentUser: boolean;
  /**
   * Whether the authenticated caller has bookmarked this tweet (false when
   * anonymous). Bookmarks are private (Module 6) — there is deliberately NO
   * bookmark count, only this per-caller flag.
   */
  bookmarkedByCurrentUser: boolean;
  /**
   * The follower whose retweet surfaced this tweet in the Following feed
   * (Module 3B/3D). Null for normal items and outside that feed.
   */
  retweetedBy?: RetweetedBy | null;
}

/** A user surfaced by GET /api/users/suggestions (Module 3D). */
export interface UserSuggestion {
  id: string;
  handle: string;
  displayName: string;
  /** Always null until the profile module; render an initials avatar. */
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
}

/** Public profile (GET /api/users/{handle}); full profile fields in Module 4. */
export interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  /** Account creation time (ISO 8601 UTC) — drives the "Joined …" line (4B). */
  createdAtUtc: string;
  followerCount: number;
  followingCount: number;
  tweetCount: number;
  isFollowedByCurrentUser: boolean;
}

/** A cursor-paginated page of tweets (GET /api/tweets). */
export interface TweetPage {
  items: Tweet[];
  /** Opaque cursor for the next page; null when there are no more. */
  nextCursor: string | null;
}

/**
 * One user row in a followers/following list (Module 7A). Public-readable; the
 * `isFollowedByCurrentUser` flag is false for an anonymous caller and drives the
 * follow-back button's initial state.
 */
export interface UserListItem {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  isFollowedByCurrentUser: boolean;
}

/** A cursor-paginated page of users (followers/following lists). */
export interface UserListPage {
  items: UserListItem[];
  nextCursor: string | null;
}

// ---- Notifications (Module 5) ----

/** The kinds of notification the backend emits. */
export type NotificationType = "Like" | "Follow" | "Reply" | "Retweet";

/** The user who triggered a notification (the "actor"). */
export interface NotificationActor {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

/** One notification (GET /api/notifications item, and the SignalR push payload). */
export interface Notification {
  id: string;
  type: NotificationType;
  isRead: boolean;
  createdAtUtc: string; // ISO 8601 UTC
  actor: NotificationActor;
  /** The related tweet for Like/Reply/Retweet; null for Follow. */
  tweetId: string | null;
  /** A short excerpt of the related tweet, when present. */
  tweetPreview: string | null;
}

/** A cursor-paginated page of notifications (GET /api/notifications). */
export interface NotificationPage {
  items: Notification[];
  nextCursor: string | null;
}

/** Payload pushed over SignalR on the `ReceiveNotification` event. */
export interface NotificationPush {
  notification: Notification;
  unreadCount: number;
}

/** Body of POST /api/auth/login and /api/auth/refresh (AuthenticationResult). */
export interface AuthSession {
  accessToken: string;
  expiresAtUtc: string;
  userId: string;
  handle: string;
  displayName: string;
}

export interface RegisterInput {
  email: string;
  handle: string;
  displayName: string;
  password: string;
}

export interface RegisterResult {
  userId: string;
  email: string;
  handle: string;
  displayName: string;
}

export interface CurrentUser {
  userId: string;
  email: string;
  handle: string;
  displayName: string;
  /** The signed-in user's avatar (Module 4A); null when unset. */
  avatarUrl: string | null;
}

/**
 * Updated user echoed by the profile-edit endpoints (PUT /api/users/me and the
 * avatar POST/DELETE). A superset is fine — we only read these fields when
 * applying the change to the header and auth state.
 */
export interface UserDto {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAtUtc: string;
}

// ---- In-memory access token (NOT persisted anywhere) ----

let accessToken: string | null = null;
// Epoch ms when the current access token expires (0 when none). Used only to
// decide whether the SignalR access-token factory should pre-emptively refresh.
let accessTokenExpiryMs = 0;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token === null) accessTokenExpiryMs = 0;
}

/** Record the access token's expiry (from AuthSession.expiresAtUtc). */
function setAccessTokenExpiry(expiresAtUtc: string): void {
  const ms = new Date(expiresAtUtc).getTime();
  accessTokenExpiryMs = Number.isNaN(ms) ? 0 : ms;
}

// The AuthProvider registers this so a failed silent refresh can clear React state.
let onAuthLost: (() => void) | null = null;

export function setAuthLostHandler(handler: (() => void) | null): void {
  onAuthLost = handler;
}

// ---- Error parsing: turn RFC 7807 bodies into a readable message ----

async function toApiError(res: Response): Promise<ApiError> {
  let message = `Request failed (HTTP ${res.status})`;
  try {
    const body = await res.json();
    if (body && typeof body === "object") {
      if (body.errors && typeof body.errors === "object") {
        // ValidationProblemDetails: { errors: { Field: [msg, ...] } }
        const all = Object.values(body.errors as Record<string, string[]>).flat();
        if (all.length) message = all.join(" ");
      } else if (typeof body.detail === "string" && body.detail) {
        message = body.detail;
      } else if (typeof body.title === "string" && body.title) {
        message = body.title;
      }
    }
  } catch {
    // Non-JSON body (e.g. empty 401) — keep the default message.
  }
  return new ApiError(res.status, message);
}

// ---- Auth endpoints (credentialed so the refresh cookie is set/sent) ----

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const res = await fetch(apiUrl("/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await toApiError(res);
  const session: AuthSession = await res.json();
  setAccessToken(session.accessToken);
  setAccessTokenExpiry(session.expiresAtUtc);
  return session;
}

/** POST /api/auth/refresh — no body; the refresh cookie identifies the session. */
export async function refresh(): Promise<AuthSession> {
  const res = await fetch(apiUrl("/api/auth/refresh"), {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw await toApiError(res);
  const session: AuthSession = await res.json();
  setAccessToken(session.accessToken);
  setAccessTokenExpiry(session.expiresAtUtc);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
  } finally {
    // Clear the in-memory token even if the network call fails.
    setAccessToken(null);
  }
}

export async function getMe(): Promise<CurrentUser> {
  const res = await fetchWithAuth("/api/auth/me", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

// ---- Authenticated fetch with single, de-duped refresh-and-retry ----

// One shared in-flight refresh: concurrent 401s await the same call instead of
// each firing their own /refresh (which would rotate the cookie repeatedly).
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refresh()
      .then((session) => session.accessToken)
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function authedFetch(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...init, headers, credentials: "include" });
}

/**
 * Token source for the SignalR `accessTokenFactory` (Module 5). SignalR calls
 * this on every (re)connect; it must hand back the *current* in-memory access
 * token — the same one `fetchWithAuth` sends — so the socket authenticates with
 * a live JWT. When there is no token, or it is within 30s of expiry, it goes
 * through the same de-duped refresh path as a 401 to mint a fresh one first.
 * The token is never persisted anywhere new; it is only read from memory here.
 */
export async function getAccessTokenForSocket(): Promise<string> {
  const SKEW_MS = 30_000;
  const current = getAccessToken();
  if (current && Date.now() < accessTokenExpiryMs - SKEW_MS) return current;
  const fresh = await refreshAccessToken();
  return fresh ?? current ?? "";
}

/** Absolute URL of the notifications SignalR hub ({API_ORIGIN}/hubs/notifications). */
export function notificationsHubUrl(): string {
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not set. Add it to .env.local.");
  }
  return `${baseUrl}/hubs/notifications`;
}

/**
 * Like fetch, but attaches the bearer token and, on a 401, performs exactly one
 * silent refresh + retry. The retry calls authedFetch directly (not itself), so
 * there is no chance of an infinite refresh loop.
 */
export async function fetchWithAuth(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await authedFetch(path, init);
  if (res.status !== 401) return res;

  const newToken = await refreshAccessToken();
  if (!newToken) {
    onAuthLost?.();
    return res; // still 401 — caller surfaces the error
  }
  return authedFetch(path, init);
}

// ---- Tweets (Module 2A: cursor-paginated, top-level feed) ----

/**
 * GET /api/tweets?cursor=&limit= — public; top-level tweets, newest first,
 * cursor-paginated. `cursor` is the opaque token from a previous page's
 * `nextCursor`; omit it for the first page.
 */
export async function getTweets(
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<TweetPage> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor); // already decoded; URLSearchParams encodes
  const query = params.toString();
  // Authenticated when a token is present so the backend can fill the
  // *ByCurrentUser flags (Module 3A); still works anonymously (no token → 200,
  // flags false). fetchWithAuth won't refresh-loop: a public 200 never 401s.
  const res = await fetchWithAuth(`/api/tweets${query ? `?${query}` : ""}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** GET /api/tweets/{id} — public; a single tweet. Authed when possible (see getTweets). */
export async function getTweet(id: string): Promise<Tweet> {
  const res = await fetchWithAuth(`/api/tweets/${id}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * GET /api/tweets/{id}/replies?cursor=&limit= — public; direct replies to a
 * tweet, **oldest-first**, cursor-paginated.
 */
export async function getReplies(
  id: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<TweetPage> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const query = params.toString();
  const res = await fetchWithAuth(
    `/api/tweets/${id}/replies${query ? `?${query}` : ""}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

export interface CreateTweetInput {
  /** May be empty when at least one image is attached (backend allows image-only). */
  content: string;
  /** Set to post a reply (used by the thread page in 2C). */
  parentId?: string;
  /** Up to 4 images (Module 2D); uploaded to Cloudinary by the backend. */
  images?: File[];
}

/**
 * POST /api/tweets — requires auth; the author is taken from the token.
 *
 * Always sent as multipart/form-data (Module 2D): `content`, optional `parentId`,
 * and each image under the `images` field. We deliberately do NOT set a
 * Content-Type header — the browser must add the multipart boundary itself.
 */
export async function createTweet(input: CreateTweetInput): Promise<Tweet> {
  const { content, parentId, images } = input;
  const form = new FormData();
  form.append("content", content ?? "");
  if (parentId) form.append("parentId", parentId);
  for (const file of images ?? []) form.append("images", file);

  const res = await fetchWithAuth("/api/tweets", {
    method: "POST",
    headers: { Accept: "application/json" }, // no Content-Type: let the browser set the boundary
    body: form,
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** DELETE /api/tweets/{id} — requires auth; author-only (enforced by the API). */
export async function deleteTweet(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/tweets/${id}`, { method: "DELETE" });
  if (!res.ok) throw await toApiError(res);
}

// ---- Engagement: like / retweet (Module 3A backend, 3C frontend) ----

/**
 * Read the updated tweet from a like/retweet response. The add endpoints return
 * the updated tweet (200); the remove endpoints may return either the updated
 * tweet (200) or an empty 204 depending on the backend. Returns null when there
 * is no body — the caller keeps its optimistic state, which is already correct
 * for a toggle. Never throws on an empty/non-JSON body.
 */
async function readUpdatedTweet(res: Response): Promise<Tweet | null> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as Tweet;
  } catch {
    return null;
  }
}

/** POST /api/tweets/{id}/like — auth; idempotent. Returns the updated tweet. */
export async function likeTweet(id: string): Promise<Tweet | null> {
  const res = await fetchWithAuth(`/api/tweets/${id}/like`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return readUpdatedTweet(res);
}

/** DELETE /api/tweets/{id}/like — auth; idempotent. */
export async function unlikeTweet(id: string): Promise<Tweet | null> {
  const res = await fetchWithAuth(`/api/tweets/${id}/like`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return readUpdatedTweet(res);
}

/** POST /api/tweets/{id}/retweet — auth; idempotent. Returns the updated tweet. */
export async function retweetTweet(id: string): Promise<Tweet | null> {
  const res = await fetchWithAuth(`/api/tweets/${id}/retweet`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return readUpdatedTweet(res);
}

/** DELETE /api/tweets/{id}/retweet — auth; idempotent. */
export async function unretweetTweet(id: string): Promise<Tweet | null> {
  const res = await fetchWithAuth(`/api/tweets/${id}/retweet`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return readUpdatedTweet(res);
}

// ---- Bookmarks (Module 6: private saves — toggle + list, no count) ----

/**
 * POST /api/tweets/{id}/bookmark — auth; idempotent. Returns the updated tweet
 * (with `bookmarkedByCurrentUser: true`). Mirrors like/retweet, but bookmarks
 * are private so there is no count to reconcile — only the flag.
 */
export async function bookmarkTweet(id: string): Promise<Tweet | null> {
  const res = await fetchWithAuth(`/api/tweets/${id}/bookmark`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return readUpdatedTweet(res);
}

/** DELETE /api/tweets/{id}/bookmark — auth; idempotent. Returns the updated tweet. */
export async function unbookmarkTweet(id: string): Promise<Tweet | null> {
  const res = await fetchWithAuth(`/api/tweets/${id}/bookmark`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return readUpdatedTweet(res);
}

/**
 * GET /api/bookmarks?cursor=&limit= — auth-only; the caller's bookmarked tweets,
 * newest-saved first, cursor-paginated (same page shape as the feeds). Private:
 * each item carries `bookmarkedByCurrentUser: true`.
 */
export async function getBookmarks(
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<TweetPage> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const query = params.toString();
  const res = await fetchWithAuth(`/api/bookmarks${query ? `?${query}` : ""}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

// ---- Profile edit: displayName/bio + avatar (Module 4A backend, 4C frontend) ----

/** PUT /api/users/me — auth; update the signed-in user's displayName + bio. */
export async function updateProfile(input: {
  displayName: string;
  bio: string;
}): Promise<UserDto> {
  const res = await fetchWithAuth("/api/users/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * POST /api/users/me/avatar — auth; multipart single image. We deliberately do
 * NOT set Content-Type (the browser adds the multipart boundary).
 *
 * NOTE: the multipart field name (`AVATAR_FIELD`) must match the 4A controller's
 * IFormFile parameter name. If 4A names it differently (e.g. "image"/"avatar"),
 * change the one constant below — it's the single source of truth.
 */
const AVATAR_FIELD = "image";

export async function uploadAvatar(file: File): Promise<UserDto> {
  const form = new FormData();
  form.append(AVATAR_FIELD, file);
  const res = await fetchWithAuth("/api/users/me/avatar", {
    method: "POST",
    headers: { Accept: "application/json" }, // no Content-Type: browser sets the boundary
    body: form,
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** DELETE /api/users/me/avatar — auth; clear the avatar. Returns the updated user. */
export async function removeAvatar(): Promise<UserDto> {
  const res = await fetchWithAuth("/api/users/me/avatar", {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

// ---- Follow graph + suggestions + following feed (Module 3B backend, 3D frontend) ----

/** GET /api/users/suggestions?limit= — auth; users you don't follow yet. */
export async function getSuggestions(limit?: number): Promise<UserSuggestion[]> {
  const query = limit != null ? `?limit=${limit}` : "";
  const res = await fetchWithAuth(`/api/users/suggestions${query}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * Build the encoded path segment for the /api/users/{handle} family of routes.
 *
 * The app speaks **bare** handles everywhere — URLs are `/ada` (Twitter-style,
 * no `@`) and the UI adds the `@` for display. The API, however, expects the
 * handle **`@`-prefixed** (Module 4A, e.g. `@ada`). This is the single place
 * that bridges the two: strip any leading `@`(s), add exactly one, then encode
 * (so `@` becomes `%40`). Every user-scoped endpoint below routes through it, so
 * the mapping lives in one spot rather than being scattered across call sites.
 */
function userHandleSegment(handle: string): string {
  const bare = handle.replace(/^@+/, "");
  return encodeURIComponent(`@${bare}`);
}

/** GET /api/users/{handle} — public profile (Module 4A). */
export async function getUser(handle: string): Promise<UserProfile> {
  const res = await fetchWithAuth(`/api/users/${userHandleSegment(handle)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * GET /api/users/{handle}/tweets?cursor=&limit= — public; the user's top-level
 * tweets, newest-first, cursor-paginated (Module 4A). Authed when a token is
 * present so the *ByCurrentUser flags fill (see getTweets).
 */
export async function getUserTweets(
  handle: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<TweetPage> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const query = params.toString();
  const res = await fetchWithAuth(
    `/api/users/${userHandleSegment(handle)}/tweets${query ? `?${query}` : ""}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * GET /api/users/{handle}/likes?cursor=&limit= — public; tweets the user liked,
 * most-recently-liked first, cursor-paginated (Module 4A). Authed like above.
 */
export async function getUserLikedTweets(
  handle: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<TweetPage> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const query = params.toString();
  const res = await fetchWithAuth(
    `/api/users/${userHandleSegment(handle)}/likes${query ? `?${query}` : ""}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * GET /api/users/{handle}/followers?cursor=&limit= — public; users who follow
 * {handle}, **newest-follow first**, cursor-paginated (Module 7A). Authed when a
 * token is present so each row's `isFollowedByCurrentUser` fills (see getTweets);
 * still works anonymously (flag false). 404 on an unknown handle.
 */
export async function getFollowers(
  handle: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<UserListPage> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const query = params.toString();
  const res = await fetchWithAuth(
    `/api/users/${userHandleSegment(handle)}/followers${query ? `?${query}` : ""}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * GET /api/users/{handle}/following?cursor=&limit= — public; users {handle}
 * follows, cursor-paginated (Module 7A). Authed like getFollowers. 404 on unknown.
 */
export async function getFollowing(
  handle: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<UserListPage> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const query = params.toString();
  const res = await fetchWithAuth(
    `/api/users/${userHandleSegment(handle)}/following${query ? `?${query}` : ""}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** POST /api/users/{handle}/follow — auth; idempotent. */
export async function followUser(handle: string): Promise<void> {
  const res = await fetchWithAuth(
    `/api/users/${userHandleSegment(handle)}/follow`,
    { method: "POST", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
}

/** DELETE /api/users/{handle}/follow — auth; idempotent. */
export async function unfollowUser(handle: string): Promise<void> {
  const res = await fetchWithAuth(
    `/api/users/${userHandleSegment(handle)}/follow`,
    { method: "DELETE", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
}

/**
 * GET /api/feed/following?cursor=&limit= — auth-only; tweets from followed users
 * plus their retweets (those carry a non-null `retweetedBy`), cursor-paginated.
 */
export async function getFollowingFeed(
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<TweetPage> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const query = params.toString();
  const res = await fetchWithAuth(
    `/api/feed/following${query ? `?${query}` : ""}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

// ---- Search (Module 8: users + tweets) ----

/**
 * GET /api/search/users?q=&cursor=&limit= — public; users whose handle or
 * display name match `q` (case-insensitive, `@`-tolerant), cursor-paginated.
 * Authed when a token is present so each row's `isFollowedByCurrentUser` fills
 * (see getTweets); still works anonymously. Empty/whitespace `q` → empty page.
 */
export async function searchUsers(
  q: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<UserListPage> {
  const params = new URLSearchParams({ q });
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const res = await fetchWithAuth(`/api/search/users?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * GET /api/search/tweets?q=&cursor=&limit= — public; tweets whose content
 * matches `q`, newest-first, cursor-paginated. Authed like searchUsers so the
 * by-me engagement flags fill. Empty/whitespace `q` → empty page.
 */
export async function searchTweets(
  q: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<TweetPage> {
  const params = new URLSearchParams({ q });
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const res = await fetchWithAuth(`/api/search/tweets?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

// ---- Notifications (Module 5: REST reads + mark-all-read) ----

/**
 * GET /api/notifications?cursor=&limit= — auth; the signed-in user's
 * notifications, newest first, cursor-paginated (same shape as the feeds).
 */
export async function getNotifications(
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<NotificationPage> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const query = params.toString();
  const res = await fetchWithAuth(
    `/api/notifications${query ? `?${query}` : ""}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** GET /api/notifications/unread-count — auth; the unread badge count. */
export async function getUnreadCount(): Promise<{ unreadCount: number }> {
  const res = await fetchWithAuth("/api/notifications/unread-count", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** POST /api/notifications/read — auth; marks all read. Returns `{ unreadCount: 0 }`. */
export async function markNotificationsRead(): Promise<{ unreadCount: number }> {
  const res = await fetchWithAuth("/api/notifications/read", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}
