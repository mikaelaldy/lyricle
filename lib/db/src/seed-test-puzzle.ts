import { db } from "./index";
import { customPuzzlesTable, userStatsTable } from "./schema";

async function seed() {
  const puzzleId = "abc123";
  const creatorId = "seed_user_001";

  await db
    .insert(userStatsTable)
    .values({
      userId: creatorId,
      points: 10,
      puzzlesCreated: 1,
      puzzlesPlayed: 0,
      puzzlesWon: 0,
      playsToday: 0,
    })
    .onConflictDoNothing();

  await db
    .insert(customPuzzlesTable)
    .values({
      id: puzzleId,
      trackId: "111439019",
      trackName: "Blinding Lights",
      artistName: "The Weeknd",
      albumArt: "https://e.snmc.io/i/600/s/d9e0d1196abc3dc70d46a5a47c5d5a02/7830219",
      personalClue: "I blast this every time I'm driving at night and feeling unstoppable.",
      maskedLyricIndex: 3,
      creatorId,
    })
    .onConflictDoNothing();

  console.log(`Seeded puzzle id=${puzzleId} and creator stats for ${creatorId}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
