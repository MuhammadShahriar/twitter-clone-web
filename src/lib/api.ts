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

/** Lite public profile (GET /api/users/{handle}); follow-state only in 3D. */
export interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
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
}

// ---- In-memory access token (NOT persisted anywhere) ----

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
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

/** GET /api/users/{handle} — public lite profile (follow-state in 3D). */
export async function getUser(handle: string): Promise<UserProfile> {
  const res = await fetchWithAuth(`/api/users/${encodeURIComponent(handle)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** POST /api/users/{handle}/follow — auth; idempotent. */
export async function followUser(handle: string): Promise<void> {
  const res = await fetchWithAuth(
    `/api/users/${encodeURIComponent(handle)}/follow`,
    { method: "POST", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw await toApiError(res);
}

/** DELETE /api/users/{handle}/follow — auth; idempotent. */
export async function unfollowUser(handle: string): Promise<void> {
  const res = await fetchWithAuth(
    `/api/users/${encodeURIComponent(handle)}/follow`,
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
