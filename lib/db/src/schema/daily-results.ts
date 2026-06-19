import { pgTable, serial, text, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyResultsTable = pgTable("daily_results", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  displayName: text("display_name").notNull(),
  puzzleDate: date("puzzle_date", { mode: "string" }).notNull(),
  puzzleNumber: integer("puzzle_number").notNull(),
  cluesUsed: integer("clues_used").notNull(),
  won: boolean("won").notNull(),
  solveTimeMs: integer("solve_time_ms"),
  country: text("country"),
  clerkUserId: text("clerk_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyResultSchema = createInsertSchema(dailyResultsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDailyResult = z.infer<typeof insertDailyResultSchema>;
export type DailyResult = typeof dailyResultsTable.$inferSelect;
