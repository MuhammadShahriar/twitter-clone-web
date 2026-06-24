# twitter-clone-web

Frontend for a Twitter clone — **Module 0: walking skeleton**.

This is an intentionally **unstyled, minimal** Next.js (App Router + TypeScript +
Tailwind) app whose only job is to prove the full stack works end-to-end: read
tweets from and post tweets to the live API. Real Twitter-styled UI / the locked
design system arrive in later modules.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Plain `fetch` — no state library, no UI kit

## Run locally

```bash
npm install
```

Create a `.env.local` file (copy from `.env.example`):

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://twitter-clone-api-9zoz.onrender.com
```

Then start the dev server:

```bash
npm run dev
```

Open <http://localhost:3000>. The feed lists existing tweets; the form posts a
new one and refreshes the list.

> **Cold start:** the API is a free Render service and sleeps after idle. The
> first request can take ~15-30s — the page shows a loading state, which is
> expected, not an error.

## Environment variables

| Variable              | Description                                  |
| --------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Base URL of the Twitter clone API (no trailing slash). |

## Deploy to Vercel

1. Push this repo to GitHub.
2. In the Vercel dashboard: **New Project** → import the repo (it auto-detects
   Next.js).
3. Add an environment variable **`NEXT_PUBLIC_API_URL`** =
   `https://twitter-clone-api-9zoz.onrender.com` (for Production, Preview, and
   Development).
4. Deploy.

> **CORS:** the API's allowed-origin config (`Cors__WebOrigin` on Render) must
> include `http://localhost:3000` (local dev) and your Vercel URL (prod),
> otherwise browser requests are blocked by CORS.
