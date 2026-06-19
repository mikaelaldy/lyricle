import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customPuzzlesTable } from "./custom-puzzles";

export const puzzlePlaysTable = pgTable("puzzle_plays", {
  id: serial("id").primaryKey(),
  puzzleId: text("puzzle_id").notNull().references(() => customPuzzlesTable.id),
  playerId: text("player_id").notNull(),
  won: boolean("won").notNull(),
  stagesUsed: integer("stages_used").notNull(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPuzzlePlaySchema = createInsertSchema(puzzlePlaysTable).omit({
  id: true,
  playedAt: true,
});
export type InsertPuzzlePlay = z.infer<typeof insertPuzzlePlaySchema>;
export type PuzzlePlay = typeof puzzlePlaysTable.$inferSelect;
