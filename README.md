# 🎵 Lyricle — Daily Lyric Battle

> **Musicathon 2026 submission** · Built with Musixmatch Pro API · [Live demo →](https://lyricle.replit.app)

A Wordle-style daily music game where every player worldwide guesses the same mystery song from five escalating clues — all powered by the Musixmatch Pro API.

---

## How It Works

Each day a new song is chosen. You get five clue stages, unlocked one at a time. The fewer clues you need, the better your score.

| Stage | Clue | Musixmatch API |
|-------|------|----------------|
| 1 | **Vibes & Themes** — mood tags and thematic clusters | `track.lyrics.mood.get` (Lyricslens) |
| 2 | **Lost in Translation** — one lyric line translated to another language | `crowd.track.translations.get` |
| 3 | **Snippet** — a single cryptic line from the lyrics | `track.snippet.get` |
| 4 | **Word by Word** — the full richsynced lyric, revealed one word at a time | `track.richsync.get` |
| 5 | **Listen** — a 30-second Spotify audio preview + album art | Spotify oEmbed / iTunes |

After your game, share your score as an emoji grid — no spoilers.

---

## Musixmatch Pro API Integration

Lyricle is built around Musixmatch's most distinctive Pro-only data:

- **Lyricslens** (`track.lyrics.mood.get`) — mood and theme clusters become Stage 1 clues. No other data source has this.
- **Translations** (`crowd.track.translations.get`) — crowd-sourced human-quality translations for Stage 2. The language rotates daily.
- **Richsync** (`track.richsync.get`) — word-level timestamps drive the animated word-reveal in Stage 4. Each word fades in timed to the original recording.
- **Chart tracks** (`chart.tracks.get`) — today's puzzle is drawn from the MXM top chart, so the mystery song is always culturally relevant.
- **Track search** (`track.search`) — powers the full-catalog autocomplete in the guess input, complete with album art.

---

## Features

- **One shared puzzle per day** — puzzle epoch is 2026-01-01; everyone globally plays puzzle #N on day N
- **Five progressive clue stages** — each reveal costs a guess attempt
- **Streak tracking** — consecutive daily wins stored per user (Clerk auth) or locally (anonymous)
- **Daily leaderboard** — ranked by clues used and solve time
- **Weekly streak leaderboard** — top streaks across all registered players
- **Emoji share card** — spoiler-free shareable result (🟨🟩 grid)
- **Live stats strip** — animated banner showing today's total plays, average clues, and best streak
- **Mobile-first** — fully responsive, plays great on phone

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js 24, Express 5, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk (optional — anonymous play supported) |
| Music data | **Musixmatch Pro API** (primary) · iTunes Search API (media fallback) |
| Monorepo | pnpm workspaces |
| Hosting | Replit |

**Design aesthetic:** Vinyl liner-note editorial — dark warm background (`#0f0e0c`), cream text (`#f5eedc`), gold accent (`#e8d44d`), Playfair Display + Space Grotesk typography.

---

## Running Locally

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL database

### Setup

```bash
git clone https://github.com/<your-org>/lyricle
cd lyricle
pnpm install
```

### Environment Variables

Create a `.env` file in `artifacts/api-server/`:

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/lyricle
MXM_KEY=<your Musixmatch Pro API key>

# Optional — for Clerk authentication
CLERK_SECRET_KEY=<your Clerk secret key>
VITE_CLERK_PUBLISHABLE_KEY=<your Clerk publishable key>
```

> **Musicathon participants:** Your Musixmatch Pro API key (Scale-plan access) was emailed to you after registration, or is available at [developer.musixmatch.com/admin/applications](https://developer.musixmatch.com/admin/applications).

### Database

```bash
pnpm --filter @workspace/db run push
```

### Development

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 23036)
pnpm --filter @workspace/lyricle run dev
```

Then open `http://localhost:23036`.

---

## Project Structure

```
lyricle/
├── artifacts/
│   ├── api-server/          # Express API
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── musixmatch.ts      # MXM Pro API client
│   │       │   ├── puzzle.ts          # Daily puzzle logic
│   │       │   ├── itunes.ts          # iTunes fallback (media)
│   │       │   └── curated-puzzles.ts # Offline fallback song bank
│   │       └── routes/
│   │           ├── puzzle.ts          # /api/puzzle/* endpoints
│   │           ├── leaderboard.ts     # /api/leaderboard/*
│   │           └── stats.ts           # /api/stats
│   └── lyricle/             # React frontend
│       └── src/
│           ├── pages/
│           │   ├── Landing.tsx        # Marketing landing page
│           │   ├── Game.tsx           # Main game view
│           │   └── Leaderboard.tsx    # Leaderboard page
│           └── components/
│               ├── ClueCard.tsx       # Per-stage clue display
│               ├── AudioPlayer.tsx    # Custom audio player (Stage 5)
│               ├── GuessInput.tsx     # Autocomplete guess field
│               └── ResultModal.tsx    # End-of-game share card
└── packages/
    └── db/                  # Drizzle schema + migrations
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/puzzle/clue/:stage` | Clue data for stage 0–4 |
| `POST` | `/api/puzzle/guess` | Submit a guess |
| `GET` | `/api/puzzle/autocomplete?q=` | Track search (MXM → iTunes → curated) |
| `GET` | `/api/puzzle/result` | Today's result for the current user |
| `GET` | `/api/leaderboard/daily` | Today's top 50 players |
| `GET` | `/api/leaderboard/streaks` | Weekly streak leaderboard |
| `GET` | `/api/stats` | Live aggregate stats |

---

## Puzzle Selection Logic

```
1. Musixmatch top chart (chart.tracks.get)
   → Uses MXM track ID for all clue API calls
2. Apple Music RSS top 100 (no key required)
   → Cross-references with curated song bank for rich clues
3. Curated 30-song bank (offline fallback)
   → Hand-crafted clues for iconic tracks
```

The same deterministic algorithm (puzzle epoch + day offset) ensures every player worldwide gets the same song.

---

## Hackathon

Built for **[Musicathon 2026](https://www.musixmatch.com/pro/api/musicathon)** — the global music tech hackathon by Musixmatch Pro.

**Submission deadline:** June 22, 2026 · **Prizes:** $25,000+ including $5,000 cash

Lyricle demonstrates Musixmatch's unique Pro-only data (Lyricslens, Richsync, Translations) as the core mechanic — not a UI afterthought. Each clue stage is impossible to build without MXM.

---

## License

MIT — content accessed via the Musixmatch Pro API is subject to the [Musixmatch Pro Terms of Service](https://www.musixmatch.com/pro/api/terms).
