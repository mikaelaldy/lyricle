import { Router, type Request } from "express";
import { getAuth } from "@clerk/express";
import { db, duelsTable, userStatsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

const router = Router();

router.post("/duels", async (req, res): Promise<void> => {
  const auth = getAuth(req as Request);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { puzzleType, puzzleRef, wager, cluesUsed, solveTimeMs, won, displayName } = req.body;

  // Validate points balance
  const [stats] = await db.select().from(userStatsTable).where(eq(userStatsTable.userId, auth.userId)).limit(1);
  if (!stats || stats.points < wager) {
    res.status(400).json({ error: "Insufficient points balance for wager" });
    return;
  }

  // Deduct points
  await db.update(userStatsTable).set({ points: stats.points - wager }).where(eq(userStatsTable.userId, auth.userId));

  // Insert Duel record
  const [duel] = await db.insert(duelsTable).values({
    creatorId: auth.userId,
    creatorName: displayName || "Anonymous",
    puzzleType,
    puzzleRef,
    wager,
    creatorCluesUsed: cluesUsed,
    creatorSolveTimeMs: solveTimeMs,
    creatorWon: won,
    status: "pending",
  }).returning();

  res.json({ duel });
});

router.get("/duels/public", async (req, res): Promise<void> => {
  const openDuels = await db.select().from(duelsTable).where(
    and(eq(duelsTable.status, "pending"), isNull(duelsTable.opponentId))
  );
  res.json({ duels: openDuels });
});

router.get("/duels/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [duel] = await db.select().from(duelsTable).where(eq(duelsTable.id, id)).limit(1);
  if (!duel) {
    res.status(404).json({ error: "Duel not found" });
    return;
  }
  res.json({ duel });
});

router.post("/duels/:id/accept", async (req, res): Promise<void> => {
  const auth = getAuth(req as Request);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { id } = req.params;
  const { displayName } = req.body;

  const [duel] = await db.select().from(duelsTable).where(eq(duelsTable.id, id)).limit(1);
  if (!duel || duel.status !== "pending") {
    res.status(400).json({ error: "Duel unavailable" });
    return;
  }

  if (duel.creatorId === auth.userId) {
    res.status(400).json({ error: "Cannot accept your own duel" });
    return;
  }

  const [stats] = await db.select().from(userStatsTable).where(eq(userStatsTable.userId, auth.userId)).limit(1);
  if (!stats || stats.points < duel.wager) {
    res.status(400).json({ error: "Insufficient points" });
    return;
  }

  // Deduct wager
  await db.update(userStatsTable).set({ points: stats.points - duel.wager }).where(eq(userStatsTable.userId, auth.userId));

  // Accept duel
  await db.update(duelsTable).set({
    opponentId: auth.userId,
    opponentName: displayName || "Anonymous",
    status: "playing",
  }).where(eq(duelsTable.id, id));

  res.json({ success: true });
});

router.post("/duels/:id/submit", async (req, res): Promise<void> => {
  const auth = getAuth(req as Request);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { id } = req.params;
  const { cluesUsed, solveTimeMs, won } = req.body;

  const [duel] = await db.select().from(duelsTable).where(eq(duelsTable.id, id)).limit(1);
  if (!duel || duel.status !== "playing") {
    res.status(400).json({ error: "Duel not in playing state" });
    return;
  }

  let winnerId: string | null = null;
  let status = "completed";

  if (won && !duel.creatorWon) {
    winnerId = auth.userId;
  } else if (!won && duel.creatorWon) {
    winnerId = duel.creatorId;
  } else if (won && duel.creatorWon) {
    // Both solved, compare clue stage count
    if (cluesUsed < duel.creatorCluesUsed) {
      winnerId = auth.userId;
    } else if (duel.creatorCluesUsed < cluesUsed) {
      winnerId = duel.creatorId;
    } else {
      // Clues are tie, check solve time
      if (solveTimeMs < duel.creatorSolveTimeMs) {
        winnerId = auth.userId;
      } else if (duel.creatorSolveTimeMs < solveTimeMs) {
        winnerId = duel.creatorId;
      } else {
        // Absolute tie
        winnerId = null;
      }
    }
  }

  // Update duel
  await db.update(duelsTable).set({
    opponentCluesUsed: cluesUsed,
    opponentSolveTimeMs: solveTimeMs,
    opponentWon: won,
    winnerId,
    status,
    completedAt: new Date(),
  }).where(eq(duelsTable.id, id));

  // Payout wagers
  const pool = duel.wager * 2;
  if (winnerId) {
    await db.update(userStatsTable).set({
      points: db.raw(`${userStatsTable.points} + ${pool}`)
    }).where(eq(userStatsTable.userId, winnerId));
  } else {
    // Refund wagers on tie
    await db.update(userStatsTable).set({
      points: db.raw(`${userStatsTable.points} + ${duel.wager}`)
    }).where(eq(userStatsTable.userId, duel.creatorId));
    await db.update(userStatsTable).set({
      points: db.raw(`${userStatsTable.points} + ${duel.wager}`)
    }).where(eq(userStatsTable.userId, auth.userId));
  }

  res.json({ success: true, winnerId });
});

export default router;
