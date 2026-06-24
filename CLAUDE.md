@AGENTS.md

# CLAUDE.md — twitter-clone-web

## What this is

`twitter-clone-web` is the **frontend** of a Twitter clone, built with **Next.js
(App Router) + TypeScript + Tailwind CSS**. This is **Module 0: a walking
skeleton** — intentionally unstyled and minimal. Its only job is to prove the
full stack works end-to-end: a browser page can **read** tweets from and
**post** tweets to the already-deployed live API.

> ⚠️ **No Twitter styling yet.** The real Twitter-styled UI and the locked
> design system arrive in **later modules**. Do not add design, component
> libraries, or polish to Module 0 — plain default Tailwind only.

## API it consumes

- The base URL is read from the env var **`NEXT_PUBLIC_API_URL`** (never
  hardcoded in code).
- Production API base: **`https://twitter-clone-api-9zoz.onrender.com`**
  (a free Render service — it **cold-starts ~15-30s** after idle; the UI shows a
  loading state and must not treat a slow first request as an error).

### API contract (camelCase JSON)

`Tweet` / `TweetDto`:
```
{ id: string (uuid), content: string, authorHandle: string, createdAtUtc: string (ISO-8601 UTC) }
```

Endpoints:
- `GET  /api/tweets`      → `Tweet[]` (newest first)
- `POST /api/tweets`      → body `{ content, authorHandle }` → created `Tweet` (201)
- `GET  /api/tweets/{id}` → a single `Tweet`

The client lives in `src/lib/api.ts` (`getTweets`, `createTweet`, `Tweet`).

## CORS

The frontend calls the API on a **different origin**, so the API's CORS policy
must allow the web origin. The API reads it from `Cors:WebOrigin` /
`Cors__WebOrigin`. It must include `http://localhost:3000` (dev) and the Vercel
URL (prod), or browser requests fail with CORS errors.

## Auth

None yet — the API has no auth. Login/auth UI arrives in **Module 1**.
