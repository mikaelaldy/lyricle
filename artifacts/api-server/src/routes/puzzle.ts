import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { dailyResultsTable, playerStreaksTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  GetPuzzleClueParams,
  PuzzleAutocompleteQueryParams,
  SubmitGuessBody,
  SubmitResultBody,
} from "@workspace/api-zod";
import {
  getClue,
  checkGuess,
  getSongReveal,
  getPuzzleCache,
  getPuzzleNumber,
  getTodayDateString,
  getNextPuzzleAt,
} from "../lib/puzzle";
import { searchTracks } from "../lib/musixmatch";
import { searchCuratedSongs } from "../lib/curated-puzzles";

const router: IRouter = Router();

// GET /puzzle/today
router.get("/puzzle/today", async (_req, res): Promise<void> => {
  const date = getTodayDateString();
  const puzzleNumber = getPuzzleNumber();
  res.json({
    puzzleNumber,
    date,
    totalClues: 5,
    nextPuzzleAt: getNextPuzzleAt(),
  });
});

// GET /puzzle/clue/:stage
router.get("/puzzle/clue/:stage", async (req, res): Promise<void> => {
  const params = GetPuzzleClueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clue = await getClue(params.data.stage);
  if (!clue) {
    res.status(503).json({ error: "Clue unavailable" });
    return;
  }
  res.json(clue);
});

// GET /puzzle/autocomplete?q=
router.get("/puzzle/autocomplete", async (req, res): Promise<void> => {
  const query = PuzzleAutocompleteQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const mxmTracks = await searchTracks(query.data.q, 8);

  if (mxmTracks.length > 0) {
    res.json({
      tracks: mxmTracks.map((t) => ({
        displayName: `${t.artist_name} — ${t.track_name}`,
        artist: t.artist_name,
        title: t.track_name,
        albumArtUrl: t.album_coverart_100x100 || null,
      })),
    });
    return;
  }

  // Fallback: search curated songs when MXM is unavailable
  const curated = searchCuratedSongs(query.data.q, 8);
  res.json({
    tracks: curated.map((s) => ({
      displayName: `${s.artistName} — ${s.trackName}`,
      artist: s.artistName,
      title: s.trackName,
      albumArtUrl: null,
    })),
  });
});

// POST /puzzle/guess
router.post("/puzzle/guess", async (req, res): Promise<void> => {
  const parsed = SubmitGuessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await checkGuess(parsed.data.artist, parsed.data.title);
  res.json(result);
});

// GET /puzzle/answer
router.get("/puzzle/answer", async (_req, res): Promise<void> => {
  const reveal = await getSongReveal();
  if (!reveal) {
    res.status(503).json({ error: "Answer unavailable" });
    return;
  }
  res.json(reveal);
});

// POST /puzzle/result
router.post("/puzzle/result", async (req, res): Promise<void> => {
  const parsed = SubmitResultBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = getTodayDateString();
  const puzzleNumber = getPuzzleNumber();
  const { playerId, displayName, cluesUsed, won, solveTimeMs } = parsed.data;

  // Derive clerkUserId server-side from Clerk auth — never trust client-provided value
  const { userId: clerkUserId } = getAuth(req as Request);

  // Upsert daily result (one per player per day)
  const existing = await db
    .select()
    .from(dailyResultsTable)
    .where(and(eq(dailyResultsTable.playerId, playerId), eq(dailyResultsTable.puzzleDate, today)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(dailyResultsTable).values({
      playerId,
      displayName,
      puzzleDate: today,
      puzzleNumber,
      cluesUsed,
      won,
      solveTimeMs: solveTimeMs ?? null,
      clerkUserId: clerkUserId ?? null,
    });
  }

  // Update streak for anonymous player
  const streakRows = await db
    .select()
    .from(playerStreaksTable)
    .where(eq(playerStreaksTable.playerId, playerId))
    .limit(1);

  let newStreak = 1;

  if (streakRows.length === 0) {
    await db.insert(playerStreaksTable).values({
      playerId,
      currentStreak: won ? 1 : 0,
      maxStreak: won ? 1 : 0,
      lastPlayedDate: today,
      totalPlays: 1,
      winCount: won ? 1 : 0,
    });
    newStreak = won ? 1 : 0;
  } else {
    const row = streakRows[0];
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let currentStreak = row.currentStreak;
    if (won) {
      if (row.lastPlayedDate === yesterdayStr) {
        currentStreak += 1;
      } else if (row.lastPlayedDate !== today) {
        currentStreak = 1;
      }
    } else {
      currentStreak = 0;
    }
    newStreak = currentStreak;

    await db
      .update(playerStreaksTable)
      .set({
        currentStreak,
        maxStreak: Math.max(row.maxStreak, currentStreak),
        lastPlayedDate: today,
        totalPlays: row.totalPlays + (existing.length === 0 ? 1 : 0),
        winCount: row.winCount + (won && existing.length === 0 ? 1 : 0),
      })
      .where(eq(playerStreaksTable.playerId, playerId));
  }

  res.json({ ok: true, streak: newStreak });
});

// GET /puzzle/leaderboard
router.get("/puzzle/leaderboard", async (_req, res): Promise<void> => {
  const today = getTodayDateString();
  const results = await db
    .select()
    .from(dailyResultsTable)
    .where(eq(dailyResultsTable.puzzleDate, today))
    .orderBy(
      sql`${dailyResultsTable.won} DESC`,
      dailyResultsTable.cluesUsed,
      sql`COALESCE(${dailyResultsTable.solveTimeMs}, 999999999)`,
    )
    .limit(100);

  const leaderboard = results.map((r, i) => ({
    rank: i + 1,
    displayName: r.displayName,
    cluesUsed: r.cluesUsed,
    solveTimeMs: r.solveTimeMs,
    won: r.won,
  }));

  res.json(leaderboard);
});

// GET /puzzle/stats
router.get("/puzzle/stats", async (_req, res): Promise<void> => {
  const today = getTodayDateString();
  const puzzleNumber = getPuzzleNumber();

  const results = await db
    .select()
    .from(dailyResultsTable)
    .where(eq(dailyResultsTable.puzzleDate, today));

  const totalPlays = results.length;
  const winCount = results.filter((r) => r.won).length;
  const winRate = totalPlays > 0 ? winCount / totalPlays : 0;

  // Distribution by cluesUsed × won
  const distMap = new Map<string, number>();
  for (const r of results) {
    const key = `${r.cluesUsed}:${r.won}`;
    distMap.set(key, (distMap.get(key) ?? 0) + 1);
  }

  const clueDistribution = Array.from(distMap.entries()).map(([k, count]) => {
    const [cluesStr, wonStr] = k.split(":");
    return { cluesUsed: parseInt(cluesStr, 10), won: wonStr === "true", count };
  });

  res.json({ puzzleNumber, totalPlays, winCount, winRate, clueDistribution });
});

export default router;
