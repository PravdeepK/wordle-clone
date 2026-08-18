# FakeWordle — project notes for Claude

Wordle clone: Next.js 16 App Router app + a standalone Node WebSocket server, on
Firebase Auth/Firestore, with Claude Haiku for word generation and guess validation.

This file covers **project-specific decisions and gotchas only**. Firebase Agent
Skills are installed (`firebase init`, see `skills-lock.json`) — don't duplicate
generic Firebase API/CLI docs here; use those skills for that.

---

## 1. Topology: two deployable units

| Unit | Where it runs | Talks to |
|---|---|---|
| Next.js app (repo root) | Vercel | Firebase, Anthropic, Resend |
| `ws-server/` | Long-running Node host (Fly/Railway) — **not** Vercel serverless | `POST {WORDLE_API_URL}/api/word` |

- The browser connects to `ws-server` via `NEXT_PUBLIC_WS_URL`.
- `ws-server` calls **back into the Next app** for word generation
  ([multiplayer-server.ts:78](ws-server/multiplayer-server.ts#L78),
  [:107](ws-server/multiplayer-server.ts#L107)). It has no Anthropic key of its own.
- Deploy ordering: deploy the **Next app first**, then `ws-server`. `ws-server`
  depends on `/api/word` existing; the Next app never calls `ws-server`.

### The known confusing failure mode
If `WORDLE_API_URL` is wrong/unset in the ws-server environment, it silently falls
back to `http://localhost:3000`, the word fetch fails, and `fetchWordFromAPI`
returns `null` → the client gets a generic `"Could not generate word."` error.

- **Multiplayer breaks. Solo play keeps working perfectly.** Nothing in Vercel logs
  or Sentry shows it — the failure is a `console.error` inside the ws-server process.
- If someone reports "multiplayer is broken but the game works," check
  `WORDLE_API_URL` on the ws-server host **first**, before anything else.

### Deploy target — settled
README ("Vercel") and `.env.local` ("Railway") are **not** contradictory. The
Railway/Fly reference is scoped to `NEXT_PUBLIC_WS_URL` only: Next app on Vercel,
`ws-server` on a long-running host. Confirmed against
[README.md](README.md) ("Deployment") and the `.env.local` comments. Treat as resolved.

---

## 2. Environment variables

`.env*` is gitignored — **never commit secrets, and never paste a real key into
this file, the README, or a commit message.** [.env.example](.env.example) documents
every var with placeholders — start there.

**Next app (Vercel):** `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_FIREBASE_*` (6 vars),
`FIREBASE_ADMIN_PROJECT_ID` / `_CLIENT_EMAIL` / `_PRIVATE_KEY`, `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`, `FEEDBACK_TO_EMAIL` (optional), `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_COMING_SOON`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_SENTRY_DSN`,
`SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` (all optional, Sentry-only).

**ws-server host:** `WORDLE_API_URL`, `PORT` (defaults 3005). Nothing else.

**Any new env var must be added to [.env.example](.env.example) in the same change**
(placeholder value + a comment naming its consumer and whether it's required), or the
file silently goes stale and stops being trustworthy.

When adding a new env var, do all five:
1. Add it to `.env.example` **and** the README env table, with its consumer.
2. Note whether it is `NEXT_PUBLIC_` (**shipped to the browser — never a secret**)
   or server-only.
3. Say which unit needs it (Next app, ws-server, or both).
4. Set it in the deploy target(s) — a Vercel-only var will not reach ws-server.
5. Never put a real value in `.env.example` — placeholders only.

Gotcha: `FIREBASE_ADMIN_PRIVATE_KEY` is stored with escaped `\n`; every route
un-escapes with `.replace(/\\n/g, "\n")`. Paste it escaped.

---

## 3. Firestore rules — the deploy step that is easy to forget

`firestore.rules` is **not** deployed by `git push`. It is a separate command:

```bash
firebase deploy --only firestore:rules
```

Success looks like:
```
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  firestore: released rules firestore.rules to cloud.firestore
```
If you don't see **both** lines, it did not ship.

**Rule of thumb: any change to what a client reads or writes must be paired with a
rules change in the same PR, and the deploy must be run.** Code that "works locally"
against unchanged rules will 403 in production, or worse, silently over-permit.

`lib/reservedUsernames.ts` and the `reservedUsernames()` / `allowlistedUsernames()`
functions in [firestore.rules](firestore.rules) are **duplicated by hand**. Change one,
change the other, then deploy the rules.

---

## 4. The `users` collection holds two different document shapes

**Read this before "cleaning up" the collection or touching the username length cap.**

```
users/{username}              -> { email, uid }        username → email lookup index
users/{uid}/games/{bucket}/entries/{doc}  -> a player's game history
```

- `{bucket}` is `"3".."10"` (word length), `"custom"`, or `"multiplayer"`.
- Two different ID schemes live side by side in one collection. Both are correct.
- **`users/{uid}` parent docs generally do not exist as documents** — only their
  `games` subcollections do. This matters for deletes (§7).

### Why usernames are capped at 20 characters
Firebase UIDs are **28 characters**. The 20-char ceiling (enforced in
`USERNAME_PATTERN` and mirrored in `validUsername()` in the rules) is a **deliberate
design choice** guaranteeing a username can never collide with a uid-keyed games
bucket in the same collection. Raising the cap toward 28 reintroduces that collision.
Do not change it without redesigning the collection layout.

---

## 5. Word generation and validation — Claude Haiku, live, every time

- **There is no static word list as the source of truth.** Both word selection
  ([api/word](app/api/word/route.ts)) and guess validation
  ([api/validate](app/api/validate/route.ts)) are live `claude-haiku-4-5` calls.
- `/api/word` has hardcoded `fallbackPools` — a **last-resort** fallback for API
  failure and length mismatch, not the generator.
- `/api/word` randomizes seed letter + category + nonce, and takes a client-supplied
  `recent` list (localStorage, `lib/recentWords.ts`) to avoid repeats. ws-server keeps
  its own 40-word server-side recent list.

### Planned (NOT implemented): dictionary fast-path for `/api/validate`
Check a local word list first; fall through to Claude Haiku only on a miss. Cuts cost
and latency on the common case. **Currently a documented plan, not behavior.**

**When you build it — the dictionary must NOT be a scrubbed/sanitized word list.**
The product intentionally accepts profanity and anatomical terms as valid guesses; the
existing prompt explicitly instructs Haiku to accept *"mild profanity"*. The plan is:

> standard word list **∪** a small hand-maintained custom allowlist (for words a
> sanitized list would exclude), with the Haiku call remaining as fallback for
> anything neither list resolves.

Swapping in a fully sanitized list is not a cleanup — it silently breaks intended
behavior. Do not "fix" it that way.

---

## 6. Fail-open vs fail-closed — current, intentional decisions

| Call site | Behavior on third-party failure | Intent |
|---|---|---|
| `/api/validate` (Haiku) | **Fail OPEN** — returns `valid: true` on error *and* on ambiguous replies | Never block a real word because the API hiccuped |
| `lib/validateWord.ts` (client) | **Fail CLOSED** — returns `false` on fetch error | ⚠️ inconsistent with the route above; a network error rejects a valid guess |
| `/api/word` (Haiku) | Degrades to `pickFallback()`, still 200 | Game must always start |
| `/api/send-verification-email` (Resend) | Hard-fails 500 | User must know the mail didn't send |
| `/api/send-password-reset-email` | Hard-fails 500, **except** `auth/user-not-found` → returns success | Deliberate: avoids email enumeration |
| `/api/feedback` (Resend) | Hard-fails 500 | User must know feedback was lost |
| Firestore game saves (client) | Swallowed to Sentry, game continues | History loss ≠ ruined game |

Rule: **user-visible transactional email hard-fails; gameplay degrades gracefully.**
When adding a third-party call, pick one deliberately and note it here. The
client/server mismatch on validate is a real inconsistency worth resolving.

`lib/anthropic429Retry.ts` retries only HTTP 429 (honors `Retry-After`, max 5 attempts).
Anthropic clients are constructed with `maxRetries: 0` so this wrapper is the only
retry layer — don't add SDK-level retries on top.

---

## 7. Destructive Firestore operations

Any script that wipes data (e.g. clearing test accounts) **must** use
`listDocuments()` + `recursiveDelete()`.

**Why:** `users/{uid}` parent docs mostly don't exist as documents (§4) — the data
lives in `users/{uid}/games/**` subcollections. A naive collection delete or a
`getDocs()`-based sweep only sees real documents and **orphans every subcollection
entry** under those phantom parents. `listDocuments()` returns missing-parent refs too;
`recursiveDelete()` walks the whole subtree.

There is no `scripts/` directory today. If you add one, put this pattern in it and
require an explicit target uid/username argument — no "delete everything" default.

---

## 8. Rate limiting — currently in-memory, this is a known gap

[lib/rateLimit.ts](lib/rateLimit.ts) is a `Map` in module scope. On Vercel it is
**per-instance and lost on every cold start**, so the effective limit is
`limit × instances`. Its own doc comment says as much.

Current caps: `/api/word` 500/min, `/api/validate` 1000/min (both hit the paid
Anthropic API), auth routes 10–20/min, email routes 5/min + 3/min per address.

**Anything that calls the Anthropic API needs a rate limit that survives cold starts
and multiple instances.** Upstash/Redis-backed limiting is queued as fix #2 — it needs
env vars from the developer. Until then, do not treat the cost-sensitive endpoints as
protected, and do not add new Anthropic-calling routes relying on this module.

---

## 9. Auth security — what's fixed, what's accepted

**Fixed, deployed, verified live** (verified against current
[firestore.rules](firestore.rules)):

- **Username/email enumeration.** Pre-auth `users` lookups moved out of the client
  and into firebase-admin-backed routes: [/api/auth/resolve-email](app/api/auth/resolve-email/route.ts)
  and [/api/auth/username-available](app/api/auth/username-available/route.ts).
  Rules set `users/{userId}` to `allow read: if false` — only `users/{uid}/games/**`
  stays owner-readable. Verified: unauth read, bulk list, and cross-user game reads all
  return permission-denied; share links (`customChallenges`) remain readable.
- **Reserved usernames.** [lib/reservedUsernames.ts](lib/reservedUsernames.ts) is the
  single source of truth (~45 names across privilege/impersonation, site identity, role
  addresses, app routes, and state-like placeholders), plus `RESERVED_SUBSTRINGS` and
  two allowlisted owner test accounts (`pravadmin`, `pravadmin1`).
  Enforced at three layers:
  1. client-side instant check (UX),
  2. server route check (UX / good errors),
  3. **`firestore.rules` `create` requiring `validUsername(userId)` — this is the only
     real gate.** Signup writes `users/{username}` directly from the client SDK, so
     without the rules layer someone could claim `admin` by calling the SDK directly.
  Deployed and confirmed live.

**Accepted limitation, not an oversight:** login-by-username still lets an attacker
harvest usernames at the rate-limited pace (10/min per IP) — resolving username → email
is inherent to the login flow. Fully closing it requires moving sign-in server-side
(Identity Toolkit `signInWithPassword` + custom token). **Intentionally out of scope.**
Don't re-litigate it as a new finding.

---

## 10. Known technical debt (intentionally deferred)

- **`getAdminApp()` is copy-pasted into 5 route files** —
  `auth/resolve-email`, `auth/username-available`, `custom-challenge`,
  `send-verification-email`, `send-password-reset-email`. Should become
  `lib/firebaseAdmin.ts`. Fix in a **dedicated pass**, not bundled into unrelated changes.
- **Game loop duplicated across 3 pages** — `WordleHomePage.tsx`,
  `multiplayer/page.tsx`, `custom-challenge/[id]/page.tsx` each reimplement
  guess/flip/keyboard state. Planned extraction: `useWordleGame` (fix #5).
- **Custom challenges have no real TTL.** A challenge doc is deleted when the *first*
  player finishes it; "expired" in the UI just means the doc is missing. Abandoned
  challenges live forever, and a shared link is consumed by whoever finishes first.
  A `timestamp` field is written at creation but nothing reads it. (fix #3)

---

## 11. Fix queue (current order)

1. ~~Username/email enumeration + reserved usernames~~ — **complete, deployed, verified live**
2. Upstash-backed rate limiting — *blocked: needs env vars from the developer*
3. Custom challenge TTL fix
4. ~~Confirm deploy target~~ — resolved, see §1
5. Extract shared game-loop hook → `useWordleGame`

Unsequenced: dictionary fast-path for `/api/validate` (§5).

---

## 12. Before merging

There is **no CI**. Nothing enforces any of this on push — run it locally:

```bash
npm run lint            # eslint .                   (flat config, ESLint 9)
npx tsc --noEmit        # typecheck (root)           ✅ passes
npm run build           # App Router / RSC errors    ✅ passes
cd ws-server && npm run typecheck                   # ✅ passes
```

### ESLint setup (migrated — don't reintroduce FlatCompat)
`next lint` was **removed in Next.js 16.0.0**; the replacement is the ESLint CLI
directly (`eslint .`). [eslint.config.mjs](eslint.config.mjs) is flat config and imports
`eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` **directly** —
in v16 these already ship as flat config arrays.

⚠️ **Do not wrap them in `@eslint/eslintrc`'s `FlatCompat`.** That was the previous
setup and it fails with `TypeError: Converting circular structure to JSON`: FlatCompat
treats an already-flat config as a legacy eslintrc shareable config and runs it through
the eslintrc schema validator, which chokes on the plugins' circular references.

`globalIgnores()` **replaces** eslint-config-next's default ignores, so the defaults
(`.next/**`, `out/**`, `build/**`, `next-env.d.ts`) are restated there. `ws-server/**`
is also ignored — it's a separate package with its own tsconfig (`strict: false`), and
the root `tsconfig.json` already excludes it. Keep the two boundaries identical.
`ws-server` has no lint config of its own; it is typecheck-gated only.

**Known: `npm run lint` currently exits 1** with 7 errors from `eslint-plugin-react-hooks`
v7's newer rules (`set-state-in-effect`, `refs`) across `useDarkMode`,
`useGlobalGuessKeyboard`, `useWebSocket`, `WordleLogoTiles`, `FeedbackModal`,
`auth/action`, `multiplayer`. These are pre-existing patterns, not regressions from the
config migration, and fixing them touches hydration-sensitive behavior — treat as its own
task. `npx eslint . --quiet` exits 0 (warnings only) if you need a green signal meanwhile.

Plus, when the change touches them:
- Changed what a client reads/writes? → update `firestore.rules` **and**
  `firebase deploy --only firestore:rules` (§3).
- Changed `lib/reservedUsernames.ts`? → mirror into `firestore.rules` and deploy.
- Changed `/api/word` or its shape? → ws-server consumes it; verify multiplayer,
  since it fails silently (§1).
- Added an env var? → all four steps in §2.

---

## 13. Git conventions

### Never add Claude as a co-author
Commit messages must **not** contain a `Co-Authored-By: Claude ...` trailer, or any
other AI attribution. This overrides the default Claude Code behavior of appending
one — the override is deliberate, so don't reintroduce it after seeing that default
elsewhere. The author and committer are the repo owner; commits stand on their own.

Same for PR bodies: no "Generated with Claude Code" footer.

Referencing `CLAUDE.md` **inside** a message is fine — that's a file path, not
attribution.

### Branch per fix
Work on a dedicated branch, never directly on `main`. One branch per numbered fix
from the queue in §11, named `fix/<short-slug>` (e.g. `fix/upstash-rate-limit`).
Do not commit or push unless asked.
