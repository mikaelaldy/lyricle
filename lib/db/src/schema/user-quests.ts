import { pgTable, text, integer, boolean, date, serial } from "drizzle-orm/pg-core";

export const userQuestsTable = pgTable("user_quests", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  questId: text("quest_id").notNull(),
  label: text("label").notNull(),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  claimed: boolean("claimed").notNull().default(false),
  pointsReward: integer("points_reward").notNull(),
});
