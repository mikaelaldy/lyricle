import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { customPuzzlesTable, userStatsTable, puzzlePlaysTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { searchTracks, fetchLyrics, fetchSnippet, fetchLyricslens } from "../lib/musixmatch";
import { lookupItunesTrack, searchItunesTracks } from "../lib/itunes";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const FREE_PLAYS_PER_DAY = 3;
const UNLOCK_COST_POINTS = 50;

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Return user stats, resetting playsToday if more than 24 h have passed. */
async function getOrResetUserStats(userId: string) {
  const rows = await db
    .select()
    .from(userStatsTable)
    .where(eq(userStatsTable.userId, userId))
    .limit(1);

  if (rows.length === 0) return null;

  const stats = rows[0];
  const msPerDay = 24 * 60 * 60 * 1000;
  const resetAt = stats.playsResetAt ? new Date(stats.playsResetAt).getTime() : 0;

  if (Date.now() - resetAt >= msPerDay) {
    await db
      .update(userStatsTable)
      .set({ playsToday: 0, playsResetAt: new Date() })
      .where(eq(userStatsTable.userId, userId));
    return { ...stats, playsToday: 0 };
  }

  return stats;
}

/** Normalise a string for fuzzy answer matching. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*[\(\[].+?[\)\]]\s*/g, "")
    .replace(/\bfeat\.?\s+.+/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function guessIsCorrect(guess: string, trackName: string, artistName: string): boolean {
  const g = norm(guess);
  if (g.length < 2) return false;
  const t = norm(trackName);
  const a = norm(artistName);
  return (
    t === g ||
    a === g ||
    (g.length >= 3 && t.startsWith(g)) ||
    (g.length >= 3 && a.startsWith(g)) ||
    (g.length >= 4 && t.includes(g)) ||
    (g.length >= 4 && a.includes(g))
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /search?q=<query>
router.get("/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  try {
    const [mxmTracks, itunesTracks] = await Promise.all([
      searchTracks(q, 10),
      searchItunesTracks(q, 10),
    ]);

    // Build a quick lookup from iTunes results keyed by normalised "title|artist"
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const itunesMap = new Map<string, string>();
    for (const it of itunesTracks) {
      if (it.artworkUrl600) {
        itunesMap.set(`${normalize(it.trackName)}|${normalize(it.artistName)}`, it.artworkUrl600);
      }
    }

    res.json({
      tracks: mxmTracks.map((t) => {
        const mxmArt = t.album_coverart_800x800 || t.album_coverart_100x100 || null;
        // Fall back to iTunes art when MXM art is absent
        const itunesArt = !mxmArt
          ? (itunesMap.get(`${normalize(t.track_name)}|${normalize(t.artist_name)}`) ?? null)
          : null;
        return {
          trackId: t.track_id,
          title: t.track_name,
          artist: t.artist_name,
          albumArt: mxmArt || itunesArt,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "MXM search error");
    res.status(502).json({ error: "Search unavailable" });
  }
});

// GET /theme/:trackId
// Returns auto-generated mood + theme tags for a track. Used during puzzle creation.
router.get("/theme/:trackId", async (req, res): Promise<void> => {
  const trackId = parseInt(req.params.trackId, 10);
  if (isNaN(trackId)) {
    res.status(400).json({ error: "Invalid track ID" });
    return;
  }

  let themes: string[] | null = null;
  let mood: string | null = null;

  try {
    const lens = await fetchLyricslens(trackId);
    if (lens) {
      themes = lens.theme_clusters?.slice(0, 4).map((t) => t.label) ?? null;
      mood = lens.mood_clusters?.[0]?.label ?? null;
    }
  } catch {}

  if (!themes) {
    try {
      const lyrics = await fetchLyrics(trackId);
      if (lyrics?.lyrics_body) {
        const stopWords = new Set(["that","this","with","have","from","they","will","been","were","your","what","when","their","there","then","than","just","like","into","over","also","more","some","such","only","same","other","each","most","which","these","those","about","after","would","could","should","every","never","always","because","before","little","still","where"]);
        const words = lyrics.lyrics_body
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 4 && !stopWords.has(w));
        const freq: Record<string, number> = {};
        for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
        const topWords = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([w]) => w);
        themes = topWords.length >= 2 ? topWords : null;
      }
    } catch {}
  }

  if (!themes) {
    try {
      const snip = await fetchSnippet(trackId);
      if (snip?.snippet_body) themes = ["music"];
    } catch {}
  }

  res.json({ themes: themes ?? [], mood });
});

// GET /lyrics/:trackId
router.get("/lyrics/:trackId", async (req, res): Promise<void> => {
  const trackId = parseInt(req.params.trackId, 10);
  if (isNaN(trackId)) {
    res.status(400).json({ error: "Invalid track ID" });
    return;
  }

  try {
    const lyrics = await fetchLyrics(trackId);
    if (!lyrics || !lyrics.lyrics_body) {
      res.status(404).json({ error: "Lyrics not found for this track" });
      return;
    }

    const lines = lyrics.lyrics_body
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          !l.startsWith("*") &&
          !l.toLowerCase().includes("lyrics is not for commercial"),
      );

    res.json({ lines });
  } catch (err) {
    logger.error({ err, trackId }, "Lyrics fetch error");
    res.status(502).json({ error: "Lyrics unavailable" });
  }
});

// POST /puzzles
router.post("/puzzles", async (req: Request, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "You must be signed in to create a puzzle" });
    return;
  }

  const { trackId, trackName, artistName, albumArt, personalClue, lyricSnippet, songTheme } = req.body as {
    trackId: string | number;
    trackName: string;
    artistName: string;
    albumArt?: string | null;
    personalClue: string;
    lyricSnippet: string;
    songTheme?: string | null;
  };

  if (!trackId || !trackName || !artistName || !personalClue || !lyricSnippet) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (typeof personalClue !== "string" || personalClue.trim().length < 10) {
    res.status(400).json({ error: "Personal clue must be at least 10 characters" });
    return;
  }
  if (typeof lyricSnippet !== "string" || lyricSnippet.trim().length < 2) {
    res.status(400).json({ error: "Lyric snippet must be at least 2 characters" });
    return;
  }

  try {
    const [puzzle] = await db
      .insert(customPuzzlesTable)
      .values({
        trackId: String(trackId),
        trackName: String(trackName),
        artistName: String(artistName),
        albumArt: albumArt || null,
        personalClue: personalClue.trim(),
        lyricSnippet: lyricSnippet.trim(),
        songTheme: songTheme ?? null,
        creatorId: userId,
      })
      .returning();

    await db
      .insert(userStatsTable)
      .values({ userId, points: 10, puzzlesCreated: 1, puzzlesPlayed: 0, puzzlesWon: 0, playsToday: 0 })
      .onConflictDoUpdate({
        target: userStatsTable.userId,
        set: {
          points: sql`${userStatsTable.points} + 10`,
          puzzlesCreated: sql`${userStatsTable.puzzlesCreated} + 1`,
        },
      });

    res.status(201).json({ puzzleId: puzzle.id });
  } catch (err) {
    logger.error({ err, userId }, "Puzzle creation error");
    res.status(500).json({ error: "Failed to create puzzle" });
  }
});

// GET /puzzles/:id
// Returns puzzle metadata for the player — answer fields (trackName, artistName) are OMITTED.
// Unauthenticated callers always receive playsRemaining: 0 so the play gate shows correctly.
router.get("/puzzles/:id", async (req: Request, res): Promise<void> => {
  const id = req.params.id as string;
  const { userId } = getAuth(req);

  try {
    const rows = await db
      .select()
      .from(customPuzzlesTable)
      .where(eq(customPuzzlesTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Puzzle not found" });
      return;
    }

    const puzzle = rows[0];

    // Unauthenticated users get playsRemaining: 0 — they must sign in to play.
    let playsRemaining = 0;
    let userPoints = 0;

    if (userId) {
      const stats = await getOrResetUserStats(userId);
      if (stats) {
        playsRemaining = Math.max(0, FREE_PLAYS_PER_DAY - stats.playsToday);
        userPoints = stats.points;
      } else {
        // No stats row yet — first time player, full plays available.
        playsRemaining = FREE_PLAYS_PER_DAY;
      }
    }

    // NOTE: trackName and artistName are intentionally excluded to prevent answer leakage.
    res.json({
      id: puzzle.id,
      trackId: puzzle.trackId,
      albumArt: puzzle.albumArt,
      personalClue: puzzle.personalClue,
      lyricSnippet: puzzle.lyricSnippet ?? null,
      songTheme: puzzle.songTheme ?? null,
      playCount: puzzle.playCount,
      createdAt: puzzle.createdAt,
      playsRemaining,
      userPoints,
      requiresAuth: !userId,
    });
  } catch (err) {
    logger.error({ err, id }, "Puzzle fetch error");
    res.status(500).json({ error: "Failed to fetch puzzle" });
  }
});

// GET /puzzles/:id/media
// Returns lyrics + iTunes audio URL + enhanced album art for progressive reveal stages.
router.get("/puzzles/:id/media", async (req: Request, res): Promise<void> => {
  const id = req.params.id as string;
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Sign in to play this puzzle" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(customPuzzlesTable)
      .where(eq(customPuzzlesTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Puzzle not found" });
      return;
    }

    const puzzle = rows[0];

    const [lyricsData, itunesTrack] = await Promise.all([
      fetchLyrics(parseInt(puzzle.trackId, 10)).catch(() => null),
      lookupItunesTrack(puzzle.artistName, puzzle.trackName).catch(() => null),
    ]);

    const lines: string[] = lyricsData?.lyrics_body
      ? lyricsData.lyrics_body
          .split("\n")
          .map((l) => l.trim())
          .filter(
            (l) =>
              l.length > 0 &&
              !l.startsWith("*") &&
              !l.toLowerCase().includes("lyrics is not for commercial"),
          )
      : [];

    res.json({
      lyrics: lines,
      audioPreviewUrl: itunesTrack?.previewUrl ?? null,
      albumArt: itunesTrack?.artworkUrl600 ?? puzzle.albumArt ?? null,
    });
  } catch (err) {
    logger.error({ err, id }, "Media fetch error");
    res.status(502).json({ error: "Media unavailable" });
  }
});

// POST /puzzles/:id/guess
// Validates a single guess server-side. Returns only {correct} — the answer is
// NEVER revealed here; it is returned by POST /play once the game is recorded.
router.post("/puzzles/:id/guess", async (req: Request, res): Promise<void> => {
  const id = req.params.id as string;
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Sign in to play this puzzle" });
    return;
  }

  const { artist, title } = req.body as { artist: string; title: string };

  if (typeof artist !== "string" || typeof title !== "string" || !artist.trim() || !title.trim()) {
    res.status(400).json({ error: "Missing required fields: artist, title" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(customPuzzlesTable)
      .where(eq(customPuzzlesTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Puzzle not found" });
      return;
    }

    const puzzle = rows[0];

    const correct =
      guessIsCorrect(artist, puzzle.trackName, puzzle.artistName) ||
      guessIsCorrect(title, puzzle.trackName, puzzle.artistName);

    // Never include finalReveal here — client gets the answer only from POST /play
    // once the game is recorded and the daily cap slot is consumed.
    res.json({ correct });
  } catch (err) {
    logger.error({ err, id }, "Guess validation error");
    res.status(500).json({ error: "Failed to validate guess" });
  }
});

// POST /puzzles/:id/unlock
// Spends 50 points to grant one extra play by decrementing playsToday.
// Does NOT record a play or update puzzle stats — that happens via /play after the game completes.
router.post("/puzzles/:id/unlock", async (req: Request, res): Promise<void> => {
  const id = req.params.id as string;
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Sign in to unlock a play" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(customPuzzlesTable)
      .where(eq(customPuzzlesTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Puzzle not found" });
      return;
    }

    // Ensure stats row exists.
    await db
      .insert(userStatsTable)
      .values({ userId, points: 0, puzzlesCreated: 0, puzzlesPlayed: 0, puzzlesWon: 0, playsToday: 0 })
      .onConflictDoNothing();

    const stats = await getOrResetUserStats(userId);
    const currentPoints = stats?.points ?? 0;

    if (currentPoints < UNLOCK_COST_POINTS) {
      res.status(402).json({ error: "Not enough points to unlock a play", userPoints: currentPoints });
      return;
    }

    // Deduct points and decrement playsToday to grant one more play slot.
    await db
      .update(userStatsTable)
      .set({
        points: sql`${userStatsTable.points} - ${UNLOCK_COST_POINTS}`,
        playsToday: sql`GREATEST(0, ${userStatsTable.playsToday} - 1)`,
      })
      .where(eq(userStatsTable.userId, userId));

    res.json({
      ok: true,
      playsRemaining: 1,
      userPoints: currentPoints - UNLOCK_COST_POINTS,
    });
  } catch (err) {
    logger.error({ err, id }, "Unlock error");
    res.status(500).json({ error: "Failed to unlock play" });
  }
});

// POST /puzzles/:id/play
// Records a completed game (win or loss) and awards points.
// Requires authentication — unauthenticated plays cannot be tracked.
router.post("/puzzles/:id/play", async (req: Request, res): Promise<void> => {
  const id = req.params.id as string;
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Sign in to record your play" });
    return;
  }

  const { won, stagesUsed } = req.body as { won: boolean; stagesUsed: number };

  if (typeof won !== "boolean" || typeof stagesUsed !== "number") {
    res.status(400).json({ error: "Missing required fields: won, stagesUsed" });
    return;
  }

  // Clamp stagesUsed to [1, 5] to prevent unbounded points inflation.
  if (!Number.isInteger(stagesUsed) || stagesUsed < 1 || stagesUsed > 5) {
    res.status(400).json({ error: "stagesUsed must be an integer between 1 and 5" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(customPuzzlesTable)
      .where(eq(customPuzzlesTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Puzzle not found" });
      return;
    }

    const puzzle = rows[0];

    // Ensure stats row exists.
    await db
      .insert(userStatsTable)
      .values({ userId, points: 0, puzzlesCreated: 0, puzzlesPlayed: 0, puzzlesWon: 0, playsToday: 0 })
      .onConflictDoNothing();

    const stats = await getOrResetUserStats(userId);
    const currentPlays = stats?.playsToday ?? 0;

    if (currentPlays >= FREE_PLAYS_PER_DAY) {
      res.status(429).json({
        error: "Daily play limit reached — use /unlock to spend points for an extra play",
        playsRemaining: 0,
        userPoints: stats?.points ?? 0,
        unlockCost: UNLOCK_COST_POINTS,
      });
      return;
    }

    // Points earned for the player: +20 for win, +5 per stage survived.
    const pointsEarned = (won ? 20 : 0) + 5 * Math.max(0, stagesUsed - 1);

    await db
      .update(userStatsTable)
      .set({
        puzzlesPlayed: sql`${userStatsTable.puzzlesPlayed} + 1`,
        puzzlesWon: sql`${userStatsTable.puzzlesWon} + ${won ? 1 : 0}`,
        playsToday: sql`${userStatsTable.playsToday} + 1`,
        points: sql`${userStatsTable.points} + ${pointsEarned}`,
      })
      .where(eq(userStatsTable.userId, userId));

    // Creator earns +2 per play (skip if creator plays their own puzzle).
    if (puzzle.creatorId !== userId) {
      await db
        .insert(userStatsTable)
        .values({ userId: puzzle.creatorId, points: 2, puzzlesCreated: 0, puzzlesPlayed: 0, puzzlesWon: 0, playsToday: 0 })
        .onConflictDoUpdate({
          target: userStatsTable.userId,
          set: { points: sql`${userStatsTable.points} + 2` },
        });
    }

    // Record individual play row.
    await db.insert(puzzlePlaysTable).values({ puzzleId: id, playerId: userId, won, stagesUsed });

    // Increment puzzle play count.
    await db
      .update(customPuzzlesTable)
      .set({ playCount: sql`${customPuzzlesTable.playCount} + 1` })
      .where(eq(customPuzzlesTable.id, id));

    // Return the answer only after the play slot is consumed — this is the single
    // authorised reveal point; /guess never returns the answer.
    res.json({
      ok: true,
      pointsEarned,
      finalReveal: {
        trackName: puzzle.trackName,
        artistName: puzzle.artistName,
        albumArt: puzzle.albumArt,
      },
    });
  } catch (err) {
    logger.error({ err, id }, "Play recording error");
    res.status(500).json({ error: "Failed to record play" });
  }
});

export default router;
