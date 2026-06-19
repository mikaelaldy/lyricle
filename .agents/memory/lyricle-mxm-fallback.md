---
name: Lyricle MXM API fallback
description: Musixmatch returned 401 with the provided key; curated static puzzles implemented as fallback
---

# Lyricle Musixmatch Fallback

## The Rule
The Musixmatch API key (stored in MXM_KEY secret) returns HTTP 401 both with and without hyphens. The key is genuinely invalid/unauthorized — this is not a code bug.

## What was built
`artifacts/api-server/src/lib/curated-puzzles.ts` — 30 curated songs with hand-crafted clues for all 5 stages. `puzzle.ts` tries live Musixmatch first; if it returns 0 tracks (or errors), it falls back to the curated data. The autocomplete route does the same: live MXM → empty → search curated songs.

**Why:** The hackathon deadline is June 22, 14:00 CEST and the game must work for the demo regardless of API status.

## How to apply
- If the Musixmatch key gets fixed, the live path automatically takes over (no code change needed).
- To add more curated songs, append to the `CURATED_SONGS` array in `curated-puzzles.ts`.
- Puzzle selection: `(puzzleNumber - 1) % CURATED_SONGS.length` — 30 songs cycle every 30 days.
- Today (puzzle 170): index 19 → "Dance Monkey" by Tones and I.
