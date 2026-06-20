import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userStatsTable, customPuzzlesTable, dailyResultsTable } from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";

const router: IRouter = Router();

async function getDisplayInfo(userId: string): Promise<{ displayName: string; country: string | null }> {
  const rows = await db
    .select({ displayName: dailyResultsTable.displayName, country: dailyResultsTable.country })
    .from(dailyResultsTable)
    .where(eq(dailyResultsTable.clerkUserId, userId))
    .orderBy(desc(dailyResultsTable.createdAt))
    .limit(1);
  return { displayName: rows[0]?.displayName ?? "Anonymous", country: rows[0]?.country ?? null };
}

// GET /leaderboard/guessers — top 50 by points; include user's own rank if outside top 50
router.get("/leaderboard/guessers", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const myUserId = auth?.userId ?? null;

  const top50 = await db
    .select({
      userId: userStatsTable.userId,
      points: userStatsTable.points,
      puzzlesPlayed: userStatsTable.puzzlesPlayed,
      puzzlesWon: userStatsTable.puzzlesWon,
    })
    .from(userStatsTable)
    .orderBy(desc(userStatsTable.points))
    .limit(50);

  const infos = await Promise.all(top50.map((r) => getDisplayInfo(r.userId)));

  const allEntries = top50.map((r, i) => ({
    userId: r.userId,
    displayName: infos[i].displayName,
    country: infos[i].country,
    points: r.points,
    puzzlesPlayed: r.puzzlesPlayed,
    puzzlesWon: r.puzzlesWon,
    isMe: r.userId === myUserId,
  }));

  // Filter out entries with no display name (anonymous / never played)
  const namedEntries = allEntries.filter((e) => e.displayName !== "Anonymous");
  const entries = namedEntries.map((e, i) => ({ ...e, rank: i + 1 }));

  let myEntry = myUserId ? entries.find((e) => e.isMe) ?? null : null;

  if (myUserId && !myEntry) {
    const myStats = await db
      .select({ points: userStatsTable.points, puzzlesPlayed: userStatsTable.puzzlesPlayed, puzzlesWon: userStatsTable.puzzlesWon })
      .from(userStatsTable)
      .where(eq(userStatsTable.userId, myUserId))
      .limit(1);

    if (myStats[0]) {
      const rankRow = await db
        .select({ cnt: count() })
        .from(userStatsTable)
        .where(sql`${userStatsTable.points} > ${myStats[0].points}`);
      const myRank = (rankRow[0]?.cnt ?? 0) + 1;
      const myInfo = await getDisplayInfo(myUserId);
      myEntry = {
        rank: myRank,
        userId: myUserId,
        displayName: myInfo.displayName,
        country: myInfo.country,
        points: myStats[0].points,
        puzzlesPlayed: myStats[0].puzzlesPlayed,
        puzzlesWon: myStats[0].puzzlesWon,
        isMe: true,
      };
    }
  }

  res.json({ entries, myEntry });
});

// GET /leaderboard/creators — top 50 by total plays received; include user's own rank if outside top 50
router.get("/leaderboard/creators", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const myUserId = auth?.userId ?? null;

  const top50 = await db
    .select({
      creatorId: customPuzzlesTable.creatorId,
      totalPlays: sql<number>`SUM(${customPuzzlesTable.playCount})`,
      puzzleCount: sql<number>`COUNT(*)`,
    })
    .from(customPuzzlesTable)
    .groupBy(customPuzzlesTable.creatorId)
    .orderBy(desc(sql`SUM(${customPuzzlesTable.playCount})`))
    .limit(50);

  const infos = await Promise.all(top50.map((r) => getDisplayInfo(r.creatorId)));

  const allCreatorEntries = top50.map((r, i) => ({
    userId: r.creatorId,
    displayName: infos[i].displayName,
    country: infos[i].country,
    totalPlays: Number(r.totalPlays),
    puzzleCount: Number(r.puzzleCount),
    isMe: r.creatorId === myUserId,
  }));

  // Filter out entries with no display name (anonymous / never played)
  const namedCreatorEntries = allCreatorEntries.filter((e) => e.displayName !== "Anonymous");
  const entries = namedCreatorEntries.map((e, i) => ({ ...e, rank: i + 1 }));

  let myEntry = myUserId ? entries.find((e) => e.isMe) ?? null : null;

  if (myUserId && !myEntry) {
    const myAgg = await db
      .select({
        totalPlays: sql<number>`SUM(${customPuzzlesTable.playCount})`,
        puzzleCount: sql<number>`COUNT(*)`,
      })
      .from(customPuzzlesTable)
      .where(eq(customPuzzlesTable.creatorId, myUserId));

    if (myAgg[0] && myAgg[0].totalPlays != null) {
      const rankRow = await db
        .select({ cnt: count() })
        .from(
          db
            .select({ total: sql<number>`SUM(${customPuzzlesTable.playCount})` })
            .from(customPuzzlesTable)
            .groupBy(customPuzzlesTable.creatorId)
            .as("sub")
        )
        .where(sql`sub.total > ${Number(myAgg[0].totalPlays)}`);

      const myRank = (rankRow[0]?.cnt ?? 0) + 1;
      const myInfo = await getDisplayInfo(myUserId);
      myEntry = {
        rank: myRank,
        userId: myUserId,
        displayName: myInfo.displayName,
        country: myInfo.country,
        totalPlays: Number(myAgg[0].totalPlays),
        puzzleCount: Number(myAgg[0].puzzleCount),
        isMe: true,
      };
    }
  }

  res.json({ entries, myEntry });
});

// GET /users/me/points — returns signed-in user's current points
router.get("/users/me/points", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const rows = await db
    .select({ points: userStatsTable.points })
    .from(userStatsTable)
    .where(eq(userStatsTable.userId, auth.userId))
    .limit(1);

  res.json({ points: rows[0]?.points ?? 0 });
});

export default router;
