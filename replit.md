# Lyricle

A daily music guessing game and UGC social puzzle platform built for Musicathon 2026. Players guess a song from five escalating clues, create their own lyric puzzles to share with friends, earn points, and compete on a global leaderboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (Express, port via `$PORT`)
- `pnpm --filter @workspace/lyricle run dev` — run the React front-end (Vite, port via `$PORT`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

### Required secrets

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk backend auth |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend auth |
| `JAMBASE_API_KEY` _(optional)_ | Concert/tour data in the daily puzzle result modal; omit to hide that section |
| `SONGSTATS_API_KEY` _(optional)_ | Spotify stream counts in the daily puzzle result modal; omit to hide that section |
| `MXM_KEY` _(optional)_ | Musixmatch API for live daily puzzle clues; falls back to curated puzzles without it |

## Stack

- **Monorepo:** pnpm workspaces, Node.js 24, TypeScript 5.9
- **Front-end:** React 19, Vite, Tailwind CSS v4, shadcn/ui, Framer Motion, Wouter
- **Auth:** Clerk (hosted, OpenID Connect)
- **API:** Express 5, Fastify-style structured logging (pino)
- **DB:** PostgreSQL + Drizzle ORM + drizzle-zod
- **API contract:** OpenAPI spec → Orval codegen → typed React Query hooks in `@workspace/api-client-react`
- **Build:** esbuild (CJS bundle for API server)

## Where things live

```
artifacts/
  lyricle/          React + Vite front-end (preview path: /)
  api-server/       Express API server
  mockup-sandbox/   Component preview server (canvas/design exploration)
packages/
  db/               Drizzle schema + migrations (source of truth for DB shape)
  api-spec/         OpenAPI spec (source of truth for API contract)
  api-client-react/ Auto-generated React Query hooks (do not hand-edit)
```

**Key files:**
- `packages/db/src/schema.ts` — database schema
- `packages/api-spec/openapi.yaml` — API contract
- `artifacts/lyricle/src/index.css` — design tokens (light theme, orange primary `#FF5500`, Inter + Outfit fonts)
- `artifacts/lyricle/src/App.tsx` — router, Clerk provider, auth appearance
- `artifacts/api-server/src/routes/` — API route handlers

## Architecture decisions

- **Curated-puzzle fallback:** When `MXM_KEY` is absent or returns a 401, `curated-puzzles.ts` serves 30 hand-picked songs across all 5 clue stages. This lets the game run without a paid Musixmatch key.
- **Daily puzzle keyed by date:** The daily puzzle rotates at UTC midnight using a date-indexed lookup. Puzzle state is persisted in `localStorage` (`lyricle_daily_<puzzleNumber>`) so players can resume mid-game.
- **UGC puzzles separate from daily:** User-created puzzles live in the `puzzles` table; the daily puzzle is served from a separate endpoint (`/api/puzzle/today`). Play limits (3 free/day, unlockable with 50 pts) are enforced server-side.
- **Points architecture:** Points are stored per Clerk user in the `users` table. The `lyricle:points-updated` custom DOM event tells the Header badge to refetch without prop drilling.
- **Orval codegen:** Never hand-edit files under `packages/api-client-react/`. Always update `openapi.yaml` then run `codegen` — the generated hooks are the contract between front-end and back-end.

## Product

- **Daily Puzzle** — one new song every day at midnight; five escalating clues (mood/themes → translated lyric → lyric snippet → richsync words → audio + album art)
- **UGC Puzzle Creator** — pick any song via Musixmatch search, write a personal clue, choose a lyric line to mask, and get a shareable link
- **Play Gate** — unauthenticated users can play the daily puzzle freely; UGC puzzles require sign-in; free users get 3 UGC plays/day (spend 50 pts to unlock more)
- **Gamification** — points for wins (more points for fewer guesses), bonus points for creators per play received, daily streak tracking
- **Leaderboard** — separate tabs for top guessers (by points) and top creators (by total plays received)
- **Partner integrations** — JamBase concert listings and Songstats stream counts displayed in the result modal after completing the daily puzzle

## User preferences

- Footer credit: "Made by mikacend (mikaships.site)" — keep on all public-facing pages
- Theme: Musixmatch-inspired — white/light background, orange primary `#FF5500`, Outfit (headings) + Inter (body) + JetBrains Mono (code/mono), no dark mode

## GitHub sync

Every Replit task merge automatically mirrors the workspace to **github.com/mikaelaldy/lyricle** via `scripts/post-merge.sh`.

**How it works:**
1. `pnpm install` + `pnpm --filter db push` run first (as before).
2. The script opens a temporary git credential file (mode 600, deleted on exit) so the `GITHUB_TOKEN` secret is never embedded in a URL or exposed in process listings.
3. It attempts a standard (non-force) `git push` to `https://github.com/mikaelaldy/lyricle.git HEAD:main`.
4. If the push is rejected (remote has diverged — e.g. someone committed directly to GitHub), the script logs a clear warning and exits cleanly without blocking the rest of setup. No automatic force-push is performed.

**Required secret:** `GITHUB_TOKEN` — a GitHub Personal Access Token with **Contents: write** permission on `mikaelaldy/lyricle`. If the secret is absent the sync step is skipped with a log message.

**If sync fails:** Pull the conflicting commits locally, resolve, then push. Once the remote is fast-forwardable from the Replit workspace the next merge will sync automatically.

## Gotchas

- `MXM_KEY` with a UUID-format value will always 401 — Musixmatch keys are alphanumeric strings. The app falls back to curated puzzles automatically.
- After editing `openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` before touching front-end code that calls those endpoints.
- The Vite dev server must allow all hosts (`server.allowedHosts: true`) because the Replit preview is proxied through an iframe from a different origin.
- Clerk proxy URL (`VITE_CLERK_PROXY_URL`) is required in production for the auth flow to work correctly behind Replit's reverse proxy.
