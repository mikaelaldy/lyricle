import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { customPuzzlesTable, userStatsTable, puzzlePlaysTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { searchTracks, fetchLyrics } from "../lib/musixmatch";
import { lookupItunesTrack } from "../lib/itunes";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const FREE_PLAYS_PER_DAY = 3;
const UNLOCK_COST_POINTS = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Reset plays_today if more than 24 h have passed since plays_reset_at. */
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

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /search?q=<query>
router.get("/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  try {
    const tracks = await searchTracks(q, 10);
    res.json({
      tracks: tracks.map((t) => ({
        trackId: t.track_id,
        title: t.track_name,
        artist: t.artist_name,
        albumArt: t.album_coverart_100x100 || t.album_coverart_800x800 || null,
      })),
    });
  } catch (err) {
    logger.error({ err }, "MXM search error");
    res.status(502).json({ error: "Search unavailable" });
  }
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

  const { trackId, trackName, artistName, albumArt, personalClue, maskedLyricIndex } = req.body as {
    trackId: string | number;
    trackName: string;
    artistName: string;
    albumArt?: string | null;
    personalClue: string;
    maskedLyricIndex: number;
  };

  if (!trackId || !trackName || !artistName || !personalClue || maskedLyricIndex == null) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (typeof personalClue !== "string" || personalClue.trim().length < 10) {
    res.status(400).json({ error: "Personal clue must be at least 10 characters" });
    return;
  }
  if (typeof maskedLyricIndex !== "number" || maskedLyricIndex < 0) {
    res.status(400).json({ error: "Invalid masked lyric index" });
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
        maskedLyricIndex: Number(maskedLyricIndex),
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
// Returns puzzle metadata + play-limit info for the authenticated user.
router.get("/puzzles/:id", async (req: Request, res): Promise<void> => {
  const { id } = req.params;
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

    // Play-limit info for authenticated users
    let playsRemaining = FREE_PLAYS_PER_DAY;
    let userPoints = 0;

    if (userId) {
      const stats = await getOrResetUserStats(userId);
      if (stats) {
        playsRemaining = Math.max(0, FREE_PLAYS_PER_DAY - stats.playsToday);
        userPoints = stats.points;
      } else {
        // No stats row yet — first time, full plays available
        playsRemaining = FREE_PLAYS_PER_DAY;
      }
    }

    res.json({
      id: puzzle.id,
      trackId: puzzle.trackId,
      trackName: puzzle.trackName,
      artistName: puzzle.artistName,
      albumArt: puzzle.albumArt,
      personalClue: puzzle.personalClue,
      maskedLyricIndex: puzzle.maskedLyricIndex,
      playCount: puzzle.playCount,
      createdAt: puzzle.createdAt,
      playsRemaining,
      userPoints,
    });
  } catch (err) {
    logger.error({ err, id }, "Puzzle fetch error");
    res.status(500).json({ error: "Failed to fetch puzzle" });
  }
});

// GET /puzzles/:id/media
// Returns lyrics lines + iTunes preview URL + enhanced album art.
// Fetched lazily so it doesn't block puzzle load.
router.get("/puzzles/:id/media", async (req, res): Promise<void> => {
  const { id } = req.params;

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

    // Fetch lyrics and iTunes data in parallel
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

// POST /puzzles/:id/play
// Records a completed play, updates stats, and optionally unlocks a play with points.
router.post("/puzzles/:id/play", async (req: Request, res): Promise<void> => {
  const { id } = req.params;
  const { userId } = getAuth(req);

  const { won, stagesUsed, unlock = false } = req.body as {
    won: boolean;
    stagesUsed: number;
    unlock?: boolean;
  };

  if (typeof won !== "boolean" || typeof stagesUsed !== "number") {
    res.status(400).json({ error: "Missing required fields: won, stagesUsed" });
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

    if (userId) {
      // Ensure stats row exists
      await db
        .insert(userStatsTable)
        .values({ userId, points: 0, puzzlesCreated: 0, puzzlesPlayed: 0, puzzlesWon: 0, playsToday: 0 })
        .onConflictDoNothing();

      const stats = await getOrResetUserStats(userId);
      const currentPlays = stats?.playsToday ?? 0;

      if (!unlock && currentPlays >= FREE_PLAYS_PER_DAY) {
        res.status(429).json({
          error: "Daily play limit reached",
          playsRemaining: 0,
          userPoints: stats?.points ?? 0,
          unlockCost: UNLOCK_COST_POINTS,
        });
        return;
      }

      if (unlock) {
        const currentPoints = stats?.points ?? 0;
        if (currentPoints < UNLOCK_COST_POINTS) {
          res.status(402).json({ error: "Not enough points to unlock a play", userPoints: currentPoints });
          return;
        }
        // Deduct unlock cost
        await db
          .update(userStatsTable)
          .set({ points: sql`${userStatsTable.points} - ${UNLOCK_COST_POINTS}` })
          .where(eq(userStatsTable.userId, userId));
      }

      // Points earned: +20 for win, +5 per stage survived regardless
      const pointsEarned = (won ? 20 : 0) + (5 * Math.max(0, stagesUsed - 1));

      await db
        .update(userStatsTable)
        .set({
          puzzlesPlayed: sql`${userStatsTable.puzzlesPlayed} + 1`,
          puzzlesWon: sql`${userStatsTable.puzzlesWon} + ${won ? 1 : 0}`,
          playsToday: sql`${userStatsTable.playsToday} + 1`,
          points: sql`${userStatsTable.points} + ${pointsEarned}`,
        })
        .where(eq(userStatsTable.userId, userId));

      // Give creator +2 points per play
      if (puzzle.creatorId !== userId) {
        await db
          .insert(userStatsTable)
          .values({ userId: puzzle.creatorId, points: 2, puzzlesCreated: 0, puzzlesPlayed: 0, puzzlesWon: 0, playsToday: 0 })
          .onConflictDoUpdate({
            target: userStatsTable.userId,
            set: { points: sql`${userStatsTable.points} + 2` },
          });
      }

      // Record the play
      await db.insert(puzzlePlaysTable).values({
        puzzleId: id,
        playerId: userId,
        won,
        stagesUsed,
      });
    }

    // Increment puzzle play count
    await db
      .update(customPuzzlesTable)
      .set({ playCount: sql`${customPuzzlesTable.playCount} + 1` })
      .where(eq(customPuzzlesTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, id }, "Play recording error");
    res.status(500).json({ error: "Failed to record play" });
  }
});

export default router;
