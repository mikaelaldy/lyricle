import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userStatsTable = pgTable("user_stats", {
  userId: text("user_id").primaryKey(),
  points: integer("points").notNull().default(0),
  puzzlesCreated: integer("puzzles_created").notNull().default(0),
  puzzlesPlayed: integer("puzzles_played").notNull().default(0),
  puzzlesWon: integer("puzzles_won").notNull().default(0),
  playsToday: integer("plays_today").notNull().default(0),
  playsResetAt: timestamp("plays_reset_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserStatsSchema = createInsertSchema(userStatsTable).omit({
  updatedAt: true,
});
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type UserStats = typeof userStatsTable.$inferSelect;
