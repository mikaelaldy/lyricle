/**
 * Partner API proxy routes — JamBase (concerts) and Songstats (stream counts).
 * Both routes degrade gracefully if env keys are absent or the upstream API
 * returns no usable data, so the UI can safely hide sections rather than error.
 */
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const JAMBASE_KEY = process.env.JAMBASE_API_KEY ?? "";
const SONGSTATS_KEY = process.env.SONGSTATS_API_KEY ?? "";

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function jsonGet<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timeout);
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "Partner API non-OK response");
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    logger.warn({ url, err }, "Partner API fetch error");
    return null;
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

// ─── GET /artist/concerts?artist=<name> ──────────────────────────────────────
// Proxies JamBase v3 events API. Returns up to 3 upcoming events for the artist.
// Auth: Bearer token in Authorization header (v3 — NOT the old v1 ?apikey= param).
// Docs: https://data.jambase.com/api/docs/getting-started

interface JamBaseEvent {
  name: string;
  startDate: string;
  location?: {
    name?: string;
    address?: { addressLocality?: string; addressRegion?: string };
  };
  url?: string;
}

export interface ConcertResult {
  venueName: string;
  city: string;
  date: string;
  url: string | null;
}

router.get("/artist/concerts", async (req, res): Promise<void> => {
  const artist = typeof req.query.artist === "string" ? req.query.artist.trim() : "";

  if (!artist) {
    res.status(400).json({ error: "artist query parameter is required" });
    return;
  }

  if (!JAMBASE_KEY) {
    logger.warn("JAMBASE_API_KEY not set — returning empty concerts");
    res.json({ concerts: [] });
    return;
  }

  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const url = new URL("https://api.data.jambase.com/v3/events");
    url.searchParams.set("artistName", artist);
    url.searchParams.set("eventDateFrom", today);
    url.searchParams.set("perPage", "3");
    url.searchParams.set("page", "1");

    const headers = {
      "Authorization": `Bearer ${JAMBASE_KEY}`,
      "Accept": "application/json",
      "User-Agent": "Lyricle/1.0",
    };

    // v3 response: { events: [...], totalItems: N } — no "success" wrapper
    type JamBaseV3Response = { events?: JamBaseEvent[]; totalItems?: number };
    const data = await jsonGet<JamBaseV3Response>(url.toString(), headers);

    if (!data?.events?.length) {
      res.json({ concerts: [] });
      return;
    }

    const concerts: ConcertResult[] = data.events.map((e) => ({
      venueName: e.location?.name ?? "Venue TBA",
      city:
        [e.location?.address?.addressLocality, e.location?.address?.addressRegion]
          .filter(Boolean)
          .join(", ") || "Location TBA",
      date: e.startDate ? formatDate(e.startDate) : "",
      url: e.url ?? null,
    }));

    res.json({ concerts });
  } catch (err) {
    logger.error({ err, artist }, "JamBase concerts error");
    res.json({ concerts: [] });
  }
});

// ─── GET /track/stats?artist=<name>&title=<title> ────────────────────────────
// Proxies Songstats API. Returns Spotify stream count for the track.
//
// Songstats API shape (enterprise/v1):
//   Search:  GET /tracks/search?q=<query>&limit=N  → { result, results: [{ songstats_track_id, title, artists }] }
//   Stats:   GET /tracks/stats?songstats_track_id=<id>&source=spotify
//            → { result, stats: [{ source, data: { streams_total: "1234567890.0" } }] }

router.get("/track/stats", async (req, res): Promise<void> => {
  const artist = typeof req.query.artist === "string" ? req.query.artist.trim() : "";
  const title = typeof req.query.title === "string" ? req.query.title.trim() : "";

  if (!artist || !title) {
    res.status(400).json({ error: "artist and title query parameters are required" });
    return;
  }

  if (!SONGSTATS_KEY) {
    logger.warn("SONGSTATS_API_KEY not set — returning null stream count");
    res.json({ streams: null });
    return;
  }

  try {
    // Step 1: search for the track
    const searchUrl = new URL("https://api.songstats.com/enterprise/v1/tracks/search");
    searchUrl.searchParams.set("q", `${title} ${artist}`);
    searchUrl.searchParams.set("limit", "5");

    type SongstatsSearchResult = {
      result: string;
      results?: Array<{
        songstats_track_id: string;
        title?: string;
        artists?: Array<{ name: string; songstats_artist_id: string }>;
        is_remix?: boolean;
      }>;
    };

    const searchData = await jsonGet<SongstatsSearchResult>(searchUrl.toString(), {
      apikey: SONGSTATS_KEY,
    });

    if (searchData?.result !== "success" || !searchData.results?.length) {
      res.json({ streams: null });
      return;
    }

    // Pick the best non-remix match (prefer tracks where artist name appears)
    const lowerArtist = artist.toLowerCase();
    const track =
      searchData.results.find(
        (t) =>
          !t.is_remix &&
          t.artists?.some((a) => a.name.toLowerCase().includes(lowerArtist.split(" ")[0])),
      ) ?? searchData.results[0];

    if (!track?.songstats_track_id) {
      res.json({ streams: null });
      return;
    }

    // Step 2: fetch Spotify stats using the Songstats track ID
    const statsUrl = new URL("https://api.songstats.com/enterprise/v1/tracks/stats");
    statsUrl.searchParams.set("songstats_track_id", track.songstats_track_id);
    statsUrl.searchParams.set("source", "spotify");

    type SongstatsStatsResult = {
      result: string;
      stats?: Array<{
        source: string;
        data?: {
          streams_total?: string | number;
        };
      }>;
    };

    const statsData = await jsonGet<SongstatsStatsResult>(statsUrl.toString(), {
      apikey: SONGSTATS_KEY,
    });

    if (statsData?.result !== "success" || !statsData.stats?.length) {
      res.json({ streams: null });
      return;
    }

    const spotifyStats = statsData.stats.find((s) => s.source === "spotify");
    const rawStreams = spotifyStats?.data?.streams_total;
    const streams = rawStreams != null ? Math.round(parseFloat(String(rawStreams))) : null;

    res.json({ streams: streams && streams > 0 ? streams : null });
  } catch (err) {
    logger.error({ err, artist, title }, "Songstats stats error");
    res.json({ streams: null });
  }
});

export default router;
