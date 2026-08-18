# Wordle By Prav

A personal Wordle clone. Pick a word length, guess in six tries, and challenge friends with custom words.

Built with Next.js (App Router), Firebase Auth + Firestore, Resend for transactional email, and a Node WebSocket server for real-time multiplayer.

## Features

- **Flexible word length** — 3 to 10 letters, picked before each game.
- **Accounts** — Firebase email sign-in with email verification (skipped in local dev).
- **Custom challenges** — create a word and share a link.
- **Real-time multiplayer** — head-to-head over a WebSocket server (`ws-server/`).
- **Scoreboard** — game results stored per user in Firestore.
- **Coming soon mode** — toggle a minimal landing page via `NEXT_PUBLIC_COMING_SOON=true`.
- **Light + dark theme** — NYT-Wordle-style palette throughout.
- **In-app feedback** — bug reports / suggestions sent via Resend, with optional image/video attachments and a generated ticket ID.

## Project layout

```
app/                    Next.js App Router pages, layouts, and API routes
  api/                  Server routes (verify email, validate word, feedback, etc.)
  custom-challenge/     Shared custom-word link pages
  multiplayer/          Multiplayer lobby + match UI
  opengraph-image.tsx   Generated OG/Twitter card
  robots.ts             /robots.txt
  sitemap.ts            /sitemap.xml
components/             Shared React components (modals, keyboard, logo, etc.)
config/                 Firebase client config
hooks/                  Reusable React hooks (dark mode, animations, keys)
lib/                    Shared utilities (word validation, rate limiting, etc.)
ws-server/              Standalone WebSocket server for multiplayer
public/                 Static assets
```

## Getting started

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

Run the multiplayer WebSocket server in a separate process:

```bash
cd ws-server
npm install
npm start
```

## Environment variables

Create a `.env.local` based on the table below. Features that depend on a missing variable will fail at runtime; the dev server still boots without them.

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client | Standard Firebase web config (apiKey, authDomain, projectId, etc.) |
| `FIREBASE_ADMIN_PROJECT_ID` | API routes | Firebase Admin SDK |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | API routes | Firebase Admin SDK |
| `FIREBASE_ADMIN_PRIVATE_KEY` | API routes | Newlines escaped as `\n`; the route un-escapes them |
| `RESEND_API_KEY` | `/api/send-verification-email`, `/api/feedback` | Resend API key |
| `RESEND_FROM_EMAIL` | Same | Verified sender address |
| `FEEDBACK_TO_EMAIL` | `/api/feedback` | Where bug reports land (optional; defaults to project owner) |
| `NEXT_PUBLIC_SITE_URL` | OG image, sitemap, robots | Canonical site URL, e.g. `https://wordlebyprav.com` |
| `NEXT_PUBLIC_COMING_SOON` | Home page, robots, sitemap | When `"true"`, shows the waitlist landing |
| `NEXT_PUBLIC_WS_URL` | Multiplayer client | URL of the `ws-server` |
| `UPSTASH_REDIS_REST_URL` | `lib/rateLimit.ts` (all rate-limited routes) | Optional but strongly recommended in production. Set with the token below |
| `UPSTASH_REDIS_REST_TOKEN` | Same | Secret. Without both, rate limits fall back to per-instance in-memory and reset on cold start |

## Scripts

```bash
npm run dev      # Next dev server
npm run build    # Production build
npm start        # Production server
npm run lint     # ESLint
npm run clean    # rm -rf .next
```

## Deployment

Deployed on Vercel. The WebSocket server runs separately (it isn't compatible with Vercel's serverless runtime — host it on Fly, Railway, or any long-running Node host, and point `NEXT_PUBLIC_WS_URL` at it).

## License

Personal project — no license granted. Code is shared for portfolio / reference purposes.
