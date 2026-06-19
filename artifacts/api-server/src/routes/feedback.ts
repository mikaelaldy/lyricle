import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { feedbackTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Lightweight in-memory rate limit for the unauthenticated feedback endpoint:
// max 5 submissions per IP per 10-minute window. Prevents trivial spam / DB
// bloat without external infrastructure. Resets when the process restarts.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const feedbackHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (feedbackHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    feedbackHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  feedbackHits.set(ip, recent);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (feedbackHits.size > 5000) {
    for (const [key, times] of feedbackHits) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) feedbackHits.delete(key);
    }
  }
  return false;
}

// POST /feedback — submit feedback. No auth required (anyone can send).
router.post("/feedback", async (req, res): Promise<void> => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many submissions. Please try again later." });
    return;
  }

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const context = typeof req.body?.context === "string" ? req.body.context.trim() : "";
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId.trim() : "";

  if (!message || message.length < 2) {
    res.status(400).json({ error: "Feedback message is required" });
    return;
  }

  const { userId: clerkUserId } = getAuth(req as Request);

  try {
    await db.insert(feedbackTable).values({
      message: message.slice(0, 2000),
      email: email ? email.slice(0, 320) : null,
      context: context ? context.slice(0, 200) : null,
      playerId: playerId || null,
      clerkUserId: clerkUserId ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Feedback insert error");
    res.status(500).json({ error: "Could not save feedback" });
  }
});

export default router;
