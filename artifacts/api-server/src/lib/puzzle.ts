import { join } from "path";
import { promises as fsp } from "fs";
import { logger } from "./logger";
import {
  fetchChartTracks,
  fetchLyrics,
  fetchLyricslens,
  fetchRichsync,
  fetchSnippet,
  fetchTranslations,
  normalizeName,
  normalizeTitle,
  pickTranslationLanguage,
  type MxmTrack,
} from "./musixmatch";
import {
  getCuratedSong,
  CURATED_SONGS,
  buildRichsyncWords,
  type CuratedSong,
} from "./curated-puzzles";
import {
  fetchItunesChartTracks,
  lookupItunesTrack,
} from "./itunes";

// ─── Disk cache for album art ──────────────────────────────────────────────────
// Persists albumArtUrl across server restarts so a cold-start oEmbed failure
// never leaves Stage 4 without art. The filename includes the track ID so a
// day where the song changes (e.g. MXM chart update) never serves stale media.

const DISK_CACHE_DIR = join(process.cwd(), ".puzzle-cache");

interface DiskCacheData {
  albumArtUrl?: string | null;
  previewUrl?: string | null;
}

function diskCacheKey(date: string, trackId: string | number): string {
  return `${date}-${trackId}`;
}

async function readDiskCache(date: string, trackId: string | number): Promise<DiskCacheData> {
  try {
    const key = diskCacheKey(date, trackId);
    const content = await fsp.readFile(join(DISK_CACHE_DIR, `${key}.json`), "utf-8");
    return JSON.parse(content) as DiskCacheData;
  } catch {
    return {};
  }
}

async function writeDiskCache(date: string, trackId: string | number, data: DiskCacheData): Promise<void> {
  try {
    await fsp.mkdir(DISK_CACHE_DIR, { recursive: true });
    const key = diskCacheKey(date, trackId);
    await fsp.writeFile(
      join(DISK_CACHE_DIR, `${key}.json`),
      JSON.stringify(data),
      "utf-8",
    );
  } catch (err) {
    logger.warn({ err }, "Failed to write puzzle disk cache");
  }
}

async function cleanOldDiskCache(today: string): Promise<void> {
  try {
    const files = await fsp.readdir(DISK_CACHE_DIR);
    for (const file of files) {
      if (file.endsWith(".json") && !file.startsWith(`${today}-`)) {
        fsp.unlink(join(DISK_CACHE_DIR, file)).catch(() => {});
      }
    }
  } catch {
    // Directory doesn't exist yet — nothing to clean.
  }
}

// ─── Puzzle epoch ─────────────────────────────────────────────────────────────
// Day 1 of Lyricle = 2026-01-01 UTC
const EPOCH_DATE = new Date("2026-01-01T00:00:00Z");

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getPuzzleNumber(dateStr?: string): number {
  const d = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  const today = new Date(d.toISOString().slice(0, 10) + "T00:00:00Z");
  const diff = today.getTime() - EPOCH_DATE.getTime();
  return Math.max(1, Math.floor(diff / (24 * 60 * 60 * 1000)) + 1);
}

export function getNextPuzzleAt(): string {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.toISOString();
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface PuzzleCache {
  date: string;
  puzzleNumber: number;
  track: MxmTrack | null;
  curated: CuratedSong | null;
  albumArtUrl: string | null;
  previewUrl: string | null;
  clues: Partial<Record<number, ClueData>>;
}

export type ClueData = {
  stage: number;
  stageLabel: string;
  // Stage 0
  themes?: string[] | null;
  mood?: string | null;
  // Stage 1
  translatedLine?: string | null;
  translationLanguage?: string | null;
  translationLanguageCode?: string | null;
  // Stage 2
  snippet?: string | null;
  // Stage 3
  richsyncWords?: Array<{ word: string; startMs: number; endMs: number }> | null;
  richsyncDurationMs?: number | null;
  // Stage 4
  previewUrl?: string | null;
  albumArtUrl?: string | null;
  spotifyTrackId?: string | null;
};

const STAGE_LABELS = [
  "Vibes & Themes",
  "Lost in Translation",
  "Lyric Snippet",
  "Word by Word",
  "Audio Preview",
];

let cache: PuzzleCache | null = null;

/** Fuzzy-match an iTunes chart entry against the curated songs list. */
function matchCuratedSong(itunesTitle: string, itunesArtist: string): CuratedSong | null {
  const lower = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const lt = lower(itunesTitle);
  const la = lower(itunesArtist);
  return (
    CURATED_SONGS.find((s) => {
      const ct = lower(s.trackName);
      const ca = lower(s.artistName);
      return (
        (ct === lt || ct.includes(lt) || lt.includes(ct)) &&
        (ca === la || ca.split(" ")[0] === la.split(" ")[0])
      );
    }) ?? null
  );
}

async function loadTodayTrack(): Promise<{ track: MxmTrack | null; curated: CuratedSong | null }> {
  // 1. Try Musixmatch live chart
  //    Key has access to: chart, snippet, lyrics, richsync (200)
  //    Key does NOT have: mood/lyricslens, translations (403) — those fall back to curated data
  try {
    const tracks = await fetchChartTracks(100);
    if (tracks.length > 0) {
      const pn = getPuzzleNumber();
      const idx = (pn - 1) % tracks.length;
      const track = tracks[idx];
      // Check for curated match (gives us mood + translation clues for free)
      const curatedMatch = matchCuratedSong(track.track_name, track.artist_name);
      if (curatedMatch) {
        logger.info(
          { trackId: track.track_id, title: track.track_name, artist: track.artist_name },
          "Today's puzzle track (MXM live) matched curated song",
        );
        return { track, curated: curatedMatch };
      }
      logger.info(
        { trackId: track.track_id, title: track.track_name, artist: track.artist_name },
        "Today's puzzle track selected (MXM live)",
      );
      return { track, curated: null };
    }
  } catch (err) {
    logger.error({ err }, "Musixmatch chart failed");
  }

  // 2. Try Apple Music top chart — cross-reference with curated for rich clues
  try {
    const pn = getPuzzleNumber();
    const itunesTracks = await fetchItunesChartTracks(100);
    if (itunesTracks.length > 0) {
      const idx = (pn - 1) % itunesTracks.length;
      const it = itunesTracks[idx];
      // Check if this chart hit matches one of our curated songs (rich clues available)
      const curatedMatch = matchCuratedSong(it.trackName, it.artistName);
      if (curatedMatch) {
        logger.info(
          { title: curatedMatch.trackName, artist: curatedMatch.artistName },
          "Today's puzzle track from iTunes chart → matched curated song",
        );
        return { track: null, curated: curatedMatch };
      }
      logger.info(
        { title: it.trackName, artist: it.artistName },
        "Today's puzzle track selected (iTunes chart, no curated match)",
      );
      // Use curated data by puzzle number for quality clues; media from iTunes
      const curated = getCuratedSong(pn);
      return { track: null, curated };
    }
  } catch (err) {
    logger.error({ err }, "iTunes chart failed");
  }

  // 3. Final fallback: curated puzzle by puzzle number
  const pn = getPuzzleNumber();
  const curated = getCuratedSong(pn);
  logger.info(
    { title: curated.trackName, artist: curated.artistName },
    "Today's puzzle track selected (curated fallback)",
  );
  return { track: null, curated };
}

export async function getPuzzleCache(): Promise<PuzzleCache | null> {
  const today = getTodayDateString();
  if (cache && cache.date === today) return cache;

  // Clean up cache files from previous days before building a fresh cache.
  cleanOldDiskCache(today);

  const { track, curated } = await loadTodayTrack();
  if (!track && !curated) return null;

  // Stable track identifier used as part of the disk cache key so a song change
  // during the same UTC day never serves stale art or preview URLs.
  const trackCacheId: string | number = curated?.id ?? track?.track_id ?? "fallback";

  // Resolve album art + preview URL — check disk first so a cold-start failure
  // never leaves Stage 4 without art.
  const diskData = await readDiskCache(today, trackCacheId);
  let albumArtUrl: string | null = diskData.albumArtUrl ?? null;
  let previewUrl: string | null = diskData.previewUrl ?? null;

  if (albumArtUrl) {
    logger.info("Album art loaded from disk cache — skipping round-trips");
  } else {
    // Try Spotify oEmbed first
    const spotifyId = curated?.spotifyTrackId ?? track?.track_spotify_id ?? null;
    if (spotifyId) {
      const spotifyData = await fetchSpotifyData(spotifyId);
      albumArtUrl = spotifyData.albumArtUrl;
      previewUrl = spotifyData.previewUrl;
    }

    // If Spotify failed, try iTunes as backup for album art + preview
    if (!albumArtUrl || !previewUrl) {
      const artistName = curated?.artistName ?? track?.artist_name ?? "";
      const trackName = curated?.trackName ?? track?.track_name ?? "";
      if (artistName && trackName) {
        try {
          const itunesData = await lookupItunesTrack(artistName, trackName);
          if (itunesData) {
            albumArtUrl = albumArtUrl ?? itunesData.artworkUrl600;
            previewUrl = previewUrl ?? itunesData.previewUrl;
            logger.info({ title: trackName }, "Media resolved via iTunes lookup");
          }
        } catch {}
      }
    }

    if (!albumArtUrl && track) {
      albumArtUrl = track.album_coverart_800x800 || track.album_coverart_100x100 || null;
    }

    // Persist so the next cold start skips all fetches
    await writeDiskCache(today, trackCacheId, { albumArtUrl, previewUrl });
  }

  cache = {
    date: today,
    puzzleNumber: getPuzzleNumber(),
    track,
    curated,
    albumArtUrl,
    previewUrl,
    clues: {},
  };
  return cache;
}

// ─── Clue builders ────────────────────────────────────────────────────────────

async function buildClue0(puzzle: PuzzleCache): Promise<ClueData> {
  // Curated fallback
  if (puzzle.curated) {
    return {
      stage: 0,
      stageLabel: STAGE_LABELS[0],
      themes: puzzle.curated.themes,
      mood: puzzle.curated.mood,
    };
  }

  const { track } = puzzle;
  if (!track) return { stage: 0, stageLabel: STAGE_LABELS[0], themes: ["mystery", "longing", "night"], mood: "Emotional" };

  let themes: string[] | null = null;
  let mood: string | null = null;

  try {
    const lens = await fetchLyricslens(track.track_id);
    if (lens) {
      themes = lens.theme_clusters?.slice(0, 4).map((t) => t.label) ?? null;
      mood = lens.mood_clusters?.[0]?.label ?? null;
    }
  } catch {}

  // Lyricslens (403 on dev key) — derive themes from lyrics words + genre
  if (!themes) {
    try {
      const lyrics = await fetchLyrics(track.track_id);
      if (lyrics?.lyrics_body) {
        // Extract meaningful content words (skip stop words)
        const stopWords = new Set(["that","this","with","have","from","they","will","been","were","your","what","when","their","there","then","than","just","like","into","over","also","more","some","such","only","same","other","each","most","which","these","those","about","after","would","could","should","every","never","always","because","before","little","still","where"]);
        const words = lyrics.lyrics_body
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 4 && !stopWords.has(w));
        // Deduplicate and pick top words by frequency
        const freq: Record<string, number> = {};
        for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
        const topWords = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([w]) => w);
        themes = topWords.length >= 2 ? topWords : null;
      }
    } catch {}
  }

  // Derive mood from genre if available
  if (!mood && track.primary_genres) {
    const genre = (track as unknown as { primary_genres?: { music_genre_list?: Array<{ music_genre: { music_genre_name: string } }> } })
      .primary_genres?.music_genre_list?.[0]?.music_genre?.music_genre_name;
    if (genre) {
      const genreMoodMap: Record<string, string> = {
        Pop: "Upbeat", Rock: "Powerful", Country: "Heartfelt", "Hip-Hop": "Energetic",
        "R&B": "Soulful", Electronic: "Electric", Jazz: "Smooth", Classical: "Elegant",
        Folk: "Intimate", Metal: "Intense", Soul: "Emotional", Indie: "Wistful",
      };
      mood = genreMoodMap[genre] ?? genre;
    }
  }

  // If we have at least some themes, return them; otherwise omit so the
  // ClueCard renders a graceful "unavailable" state instead of nonsense.
  return {
    stage: 0,
    stageLabel: STAGE_LABELS[0],
    themes: themes ?? null,
    mood: mood ?? null,
  };
}

async function buildClue1(puzzle: PuzzleCache): Promise<ClueData> {
  // Curated fallback — has hand-crafted translations
  if (puzzle.curated) {
    return {
      stage: 1,
      stageLabel: STAGE_LABELS[1],
      translatedLine: puzzle.curated.translatedLine,
      translationLanguage: puzzle.curated.translationLanguage,
      translationLanguageCode: puzzle.curated.translationLanguageCode,
    };
  }

  const { track, puzzleNumber } = puzzle;
  if (!track) return { stage: 1, stageLabel: STAGE_LABELS[1], translatedLine: null, translationLanguage: null, translationLanguageCode: null };

  const lang = pickTranslationLanguage(puzzleNumber);
  let translatedLine: string | null = null;

  // Try MXM translations (requires Pro tier — may be 403)
  try {
    const translations = await fetchTranslations(track.track_id);
    const match = translations.find((t) => t.language === lang.code);
    if (match?.description) translatedLine = match.description;
  } catch {}

  // Fallback: use MXM snippet as the "clue line" (snippet.get returns 200 on dev key)
  if (!translatedLine) {
    try {
      const snippet = await fetchSnippet(track.track_id);
      if (snippet?.snippet_body) translatedLine = snippet.snippet_body;
    } catch {}
  }

  // Last resort: pick a line from the full lyrics
  if (!translatedLine) {
    try {
      const lyrics = await fetchLyrics(track.track_id);
      if (lyrics?.lyrics_body) {
        const lines = lyrics.lyrics_body.split("\n").filter((l) => l.trim().length > 10);
        translatedLine = lines[Math.floor(lines.length * 0.3)] ?? lines[0] ?? null;
      }
    } catch {}
  }

  // The dev-tier MXM key never returns real translations (always 403), so
  // anything in translatedLine is an English snippet/lyric. Label it honestly
  // as "Lyric hint" so players aren't misled into thinking it's a translation.
  return {
    stage: 1,
    stageLabel: STAGE_LABELS[1],
    translatedLine,
    translationLanguage: translatedLine ? "Lyric hint" : null,
    translationLanguageCode: null,
  };
}

async function buildClue2(puzzle: PuzzleCache): Promise<ClueData> {
  // Curated fallback
  if (puzzle.curated) {
    return {
      stage: 2,
      stageLabel: STAGE_LABELS[2],
      snippet: puzzle.curated.snippet,
    };
  }

  const { track } = puzzle;
  if (!track) return { stage: 2, stageLabel: STAGE_LABELS[2], snippet: null };

  let snippet: string | null = null;

  try {
    const data = await fetchSnippet(track.track_id);
    if (data?.snippet_body) snippet = data.snippet_body;
  } catch {}

  if (!snippet) {
    try {
      const lyrics = await fetchLyrics(track.track_id);
      if (lyrics?.lyrics_body) {
        const lines = lyrics.lyrics_body.split("\n").filter((l) => l.trim().length > 0);
        snippet = lines[1] ?? lines[0] ?? null;
      }
    } catch {}
  }

  return { stage: 2, stageLabel: STAGE_LABELS[2], snippet };
}

async function buildClue3(puzzle: PuzzleCache): Promise<ClueData> {
  // Curated fallback
  if (puzzle.curated) {
    const words = buildRichsyncWords(puzzle.curated.snippetWords);
    return {
      stage: 3,
      stageLabel: STAGE_LABELS[3],
      richsyncWords: words,
      richsyncDurationMs: words.length > 0 ? words[words.length - 1].endMs - words[0].startMs + 500 : null,
    };
  }

  const { track } = puzzle;
  if (!track) return { stage: 3, stageLabel: STAGE_LABELS[3], richsyncWords: null, richsyncDurationMs: null };

  let richsyncWords: ClueData["richsyncWords"] = null;
  let richsyncDurationMs: number | null = null;

  try {
    const lines = await fetchRichsync(track.track_id);
    if (lines && lines.length > 0) {
      const midIdx = Math.floor(lines.length * 0.4);
      const line = lines[midIdx];
      if (line?.l?.length > 0) {
        const durationMs = Math.round((line.te - line.ts) * 1000);
        richsyncWords = line.l.map((w) => ({
          word: w.c,
          startMs: Math.round((line.ts + w.o) * 1000),
          endMs: Math.round((line.ts + w.o) * 1000) + Math.max(300, Math.round(durationMs / line.l.length)),
        }));
        richsyncDurationMs = durationMs;
      }
    }
  } catch {}

  return { stage: 3, stageLabel: STAGE_LABELS[3], richsyncWords, richsyncDurationMs };
}

async function fetchSpotifyData(trackId: string | null): Promise<{ albumArtUrl: string | null; previewUrl: string | null }> {
  if (!trackId) return { albumArtUrl: null, previewUrl: null };
  let albumArtUrl: string | null = null;
  let previewUrl: string | null = null;
  try {
    const oembedRes = await fetch(
      `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (oembedRes.ok) {
      const data = (await oembedRes.json()) as { thumbnail_url?: string };
      albumArtUrl = data.thumbnail_url ?? null;
    }
  } catch {}

  try {
    const embedRes = await fetch(
      `https://open.spotify.com/embed/track/${trackId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (embedRes.ok) {
      const html = await embedRes.text();
      const cdnMatch = html.match(/https:\\u002Fp\.scdn\.co\\u002Fmp3-preview\\u002F[a-f0-9]+/);
      if (cdnMatch?.[0]) {
        previewUrl = cdnMatch[0].replace(/\\u002F/g, "/");
      } else {
        const plainMatch = html.match(/https:\/\/p\.scdn\.co\/mp3-preview\/[a-f0-9]+/);
        previewUrl = plainMatch?.[0] ?? null;
      }
    }
  } catch {}

  return { albumArtUrl, previewUrl };
}

async function buildClue4(puzzle: PuzzleCache): Promise<ClueData> {
  // albumArtUrl and previewUrl are pre-warmed during puzzle initialisation
  if (puzzle.curated) {
    return {
      stage: 4,
      stageLabel: STAGE_LABELS[4],
      previewUrl: puzzle.previewUrl,
      albumArtUrl: puzzle.albumArtUrl,
      spotifyTrackId: puzzle.curated.spotifyTrackId,
    };
  }

  const { track } = puzzle;
  if (!track) return { stage: 4, stageLabel: STAGE_LABELS[4], previewUrl: null, albumArtUrl: null, spotifyTrackId: null };

  return {
    stage: 4,
    stageLabel: STAGE_LABELS[4],
    previewUrl: puzzle.previewUrl,
    albumArtUrl: puzzle.albumArtUrl,
    spotifyTrackId: track.track_spotify_id || null,
  };
}

export async function getClue(stage: number): Promise<ClueData | null> {
  const puzzle = await getPuzzleCache();
  if (!puzzle) return null;

  if (puzzle.clues[stage]) return puzzle.clues[stage]!;

  let clue: ClueData;
  switch (stage) {
    case 0: clue = await buildClue0(puzzle); break;
    case 1: clue = await buildClue1(puzzle); break;
    case 2: clue = await buildClue2(puzzle); break;
    case 3: clue = await buildClue3(puzzle); break;
    case 4: clue = await buildClue4(puzzle); break;
    default: return null;
  }

  puzzle.clues[stage] = clue;
  return clue;
}

// ─── Guess checking ───────────────────────────────────────────────────────────

export async function checkGuess(
  artist: string,
  title: string,
): Promise<{ correct: boolean; normalizedGuess: string; hint: string | null }> {
  const puzzle = await getPuzzleCache();
  if (!puzzle) {
    return { correct: false, normalizedGuess: `${artist} — ${title}`, hint: null };
  }

  let answerArtist: string;
  let answerTitle: string;

  if (puzzle.curated) {
    answerArtist = puzzle.curated.artistName;
    answerTitle = puzzle.curated.trackName;
  } else if (puzzle.track) {
    answerArtist = puzzle.track.artist_name;
    answerTitle = puzzle.track.track_name;
  } else {
    return { correct: false, normalizedGuess: `${artist} — ${title}`, hint: null };
  }

  const normalizedGuess = `${normalizeName(artist)} — ${normalizeTitle(title)}`;
  const titleMatch = normalizeTitle(title) === normalizeTitle(answerTitle);
  const artistMatch = normalizeName(artist) === normalizeName(answerArtist);
  const correct = titleMatch && artistMatch;

  let hint: string | null = null;
  if (!correct) {
    if (titleMatch && !artistMatch) hint = "Right song, wrong artist!";
    else if (!titleMatch && artistMatch) hint = "Right artist, wrong song!";
  }

  return { correct, normalizedGuess, hint };
}

export async function getSongReveal(): Promise<{
  title: string;
  artist: string;
  albumArtUrl: string | null;
  spotifyTrackId: string | null;
  previewUrl: string | null;
  meaning: string | null;
  releaseYear: number | null;
} | null> {
  const puzzle = await getPuzzleCache();
  if (!puzzle) return null;

  if (puzzle.curated) {
    return {
      title: puzzle.curated.trackName,
      artist: puzzle.curated.artistName,
      albumArtUrl: puzzle.albumArtUrl,
      spotifyTrackId: puzzle.curated.spotifyTrackId,
      previewUrl: null,
      meaning: null,
      releaseYear: puzzle.curated.releaseYear,
    };
  }

  if (puzzle.track) {
    const track = puzzle.track;
    const releaseYear = track.first_release_date
      ? parseInt(track.first_release_date.slice(0, 4), 10)
      : null;
    return {
      title: track.track_name,
      artist: track.artist_name,
      albumArtUrl: track.album_coverart_800x800 || track.album_coverart_100x100 || null,
      spotifyTrackId: track.track_spotify_id || null,
      previewUrl: null,
      meaning: null,
      releaseYear: isNaN(releaseYear!) ? null : releaseYear,
    };
  }

  return null;
}
