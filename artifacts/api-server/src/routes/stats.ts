import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { dailyResultsTable, playerStreaksTable } from "@workspace/db";
import { eq, count, countDistinct, gte } from "drizzle-orm";
import { getTodayDateString } from "../lib/puzzle";

const router: IRouter = Router();

const CACHE_TTL_MS = 60_000;

let cachedStats: { totalCompletions: number; playersToday: number; streakLeaders: number } | null = null;
let cacheExpiry = 0;
let cachedDate = "";

// GET /stats — public aggregate stats for the landing page
router.get("/stats", async (_req, res): Promise<void> => {
  const today = getTodayDateString();
  const now = Date.now();

  if (cachedStats && now < cacheExpiry && cachedDate === today) {
    res.json(cachedStats);
    return;
  }

  const [totalRow, todayRow, leadersRow] = await Promise.all([
    db
      .select({ count: count() })
      .from(dailyResultsTable)
      .where(eq(dailyResultsTable.won, true)),

    db
      .select({ count: countDistinct(dailyResultsTable.playerId) })
      .from(dailyResultsTable)
      .where(eq(dailyResultsTable.puzzleDate, today)),

    db
      .select({ count: count() })
      .from(playerStreaksTable)
      .where(gte(playerStreaksTable.currentStreak, 2)),
  ]);

  cachedStats = {
    totalCompletions: totalRow[0]?.count ?? 0,
    playersToday: todayRow[0]?.count ?? 0,
    streakLeaders: leadersRow[0]?.count ?? 0,
  };
  cacheExpiry = now + CACHE_TTL_MS;
  cachedDate = today;

  res.json(cachedStats);
});

export default router;
