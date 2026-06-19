CREATE TABLE "daily_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"display_name" text NOT NULL,
	"puzzle_date" date NOT NULL,
	"puzzle_number" integer NOT NULL,
	"clues_used" integer NOT NULL,
	"won" boolean NOT NULL,
	"solve_time_ms" integer,
	"clerk_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_streaks" (
	"player_id" text PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL,
	"last_played_date" date,
	"total_plays" integer DEFAULT 0 NOT NULL,
	"win_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_puzzles" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"track_name" text NOT NULL,
	"artist_name" text NOT NULL,
	"album_art" text,
	"personal_clue" text NOT NULL,
	"masked_lyric_index" integer NOT NULL,
	"creator_id" text NOT NULL,
	"play_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" text PRIMARY KEY NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"puzzles_created" integer DEFAULT 0 NOT NULL,
	"puzzles_played" integer DEFAULT 0 NOT NULL,
	"puzzles_won" integer DEFAULT 0 NOT NULL,
	"plays_today" integer DEFAULT 0 NOT NULL,
	"plays_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "puzzle_plays" (
	"id" serial PRIMARY KEY NOT NULL,
	"puzzle_id" text NOT NULL,
	"player_id" text NOT NULL,
	"won" boolean NOT NULL,
	"stages_used" integer NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "puzzle_plays" ADD CONSTRAINT "puzzle_plays_puzzle_id_custom_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."custom_puzzles"("id") ON DELETE no action ON UPDATE no action;