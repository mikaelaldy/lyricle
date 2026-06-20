import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const duelsTable = pgTable("duels", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: text("creator_id").notNull(),
  creatorName: text("creator_name").notNull(),
  opponentId: text("opponent_id"),
  opponentName: text("opponent_name"),
  puzzleType: text("puzzle_type").notNull(),
  puzzleRef: text("puzzle_ref").notNull(),
  wager: integer("wager").notNull().default(0),
  status: text("status").notNull().default("pending"),
  creatorCluesUsed: integer("creator_clues_used").notNull(),
  creatorSolveTimeMs: integer("creator_solve_time_ms").notNull(),
  creatorWon: boolean("creator_won").notNull(),
  opponentCluesUsed: integer("opponent_clues_used"),
  opponentSolveTimeMs: integer("opponent_solve_time_ms"),
  opponentWon: boolean("opponent_won"),
  winnerId: text("winner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
