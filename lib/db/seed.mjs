import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    const puzzleId = "abc123";
    const creatorId = "seed_user_001";

    await client.query(
      `INSERT INTO user_stats (user_id, points, puzzles_created, puzzles_played, puzzles_won, plays_today, plays_reset_at)
       VALUES ($1, 10, 1, 0, 0, 0, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [creatorId]
    );

    await client.query(
      `INSERT INTO custom_puzzles (id, track_id, track_name, artist_name, album_art, personal_clue, masked_lyric_index, creator_id, play_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        puzzleId,
        "111439019",
        "Blinding Lights",
        "The Weeknd",
        "https://e.snmc.io/i/600/s/d9e0d1196abc3dc70d46a5a47c5d5a02/7830219",
        "I blast this every time I'm driving at night and feeling unstoppable.",
        3,
        creatorId,
      ]
    );

    console.log(`Seeded puzzle id=${puzzleId} and creator stats for ${creatorId}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
