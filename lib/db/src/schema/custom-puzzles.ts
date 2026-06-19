import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { nanoid } from "nanoid";

export const customPuzzlesTable = pgTable("custom_puzzles", {
  id: text("id").primaryKey().$defaultFn(() => nanoid(8)),
  trackId: text("track_id").notNull(),
  trackName: text("track_name").notNull(),
  artistName: text("artist_name").notNull(),
  albumArt: text("album_art"),
  personalClue: text("personal_clue").notNull(),
  maskedLyricIndex: integer("masked_lyric_index").notNull(),
  creatorId: text("creator_id").notNull(),
  playCount: integer("play_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomPuzzleSchema = createInsertSchema(customPuzzlesTable).omit({
  playCount: true,
  createdAt: true,
});
export type InsertCustomPuzzle = z.infer<typeof insertCustomPuzzleSchema>;
export type CustomPuzzle = typeof customPuzzlesTable.$inferSelect;
