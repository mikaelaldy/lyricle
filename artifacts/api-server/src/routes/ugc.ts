import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { customPuzzlesTable, userStatsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { searchTracks, fetchLyrics } from "../lib/musixmatch";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /search?q=<query>
// Proxies MXM track.search and returns track candidates for the creator
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
        albumArt:
          t.album_coverart_100x100 ||
          t.album_coverart_800x800 ||
          null,
      })),
    });
  } catch (err) {
    logger.error({ err }, "MXM search error");
    res.status(502).json({ error: "Search unavailable" });
  }
});

// GET /lyrics/:trackId
// Returns the full lyrics for a track split into individual lines
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
// Saves a new custom puzzle to the DB and increments creator stats.
// Requires Clerk authentication.
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
      .values({
        userId,
        points: 10,
        puzzlesCreated: 1,
        puzzlesPlayed: 0,
        puzzlesWon: 0,
        playsToday: 0,
      })
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
// Returns puzzle metadata for the player flow (without revealing the answer song name directly)
router.get("/puzzles/:id", async (req, res): Promise<void> => {
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
    });
  } catch (err) {
    logger.error({ err, id }, "Puzzle fetch error");
    res.status(500).json({ error: "Failed to fetch puzzle" });
  }
});

export default router;
