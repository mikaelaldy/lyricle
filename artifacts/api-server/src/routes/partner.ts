/**
 * Partner API proxy routes — JamBase (concerts) and Songstats (stream counts).
 * Both routes degrade gracefully if the env keys are absent or the upstream
 * API returns no data, so the UI can safely hide sections rather than error.
 */
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const JAMBASE_KEY = process.env.JAMBASE_API_KEY ?? "";
const SONGSTATS_KEY = process.env.SONGSTATS_API_KEY ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function jsonGet<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    logger.warn({ url, err }, "Partner API fetch error");
    return null;
  }
}

/** Convert an artist name to a JamBase-style slug: lowercase, spaces → hyphens. */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ─── GET /artist/concerts?artist=<name> ──────────────────────────────────────
// Proxies JamBase events API. Returns up to 3 upcoming events for the artist.

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
    const slug = toSlug(artist);
    const url = new URL("https://www.jambase.com/jb-api/v1/events");
    url.searchParams.set("artistSlug", slug);
    url.searchParams.set("apikey", JAMBASE_KEY);
    url.searchParams.set("page", "0");
    url.searchParams.set("perPage", "3");

    type JamBaseResponse = { success: boolean; events?: JamBaseEvent[] };
    const data = await jsonGet<JamBaseResponse>(url.toString());

    if (!data?.success || !data.events?.length) {
      res.json({ concerts: [] });
      return;
    }

    const concerts: ConcertResult[] = data.events.map((e) => ({
      venueName: e.location?.name ?? "Venue TBA",
      city: [
        e.location?.address?.addressLocality,
        e.location?.address?.addressRegion,
      ]
        .filter(Boolean)
        .join(", ") || "Location TBA",
      date: e.startDate ?? "",
      url: e.url ?? null,
    }));

    res.json({ concerts });
  } catch (err) {
    logger.error({ err, artist }, "JamBase concerts error");
    res.json({ concerts: [] }); // graceful fallback
  }
});

// ─── GET /track/stats?artist=<name>&title=<title> ────────────────────────────
// Proxies Songstats API. Returns Spotify stream count for the track.

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
    // Step 1: search for the track on Songstats
    const searchUrl = new URL("https://api.songstats.com/enterprise/v1/tracks/search");
    searchUrl.searchParams.set("q", `${title} ${artist}`);
    searchUrl.searchParams.set("limit", "5");

    type SongstatsSearchResult = {
      tracks?: Array<{
        isrc?: string;
        spotify_track_id?: string;
        title?: string;
        artist_name?: string;
      }>;
    };

    const searchData = await jsonGet<SongstatsSearchResult>(searchUrl.toString(), {
      apikey: SONGSTATS_KEY,
    });

    const track = searchData?.tracks?.[0];
    if (!track) {
      res.json({ streams: null });
      return;
    }

    // Step 2: fetch Spotify stats for the track using its ISRC or spotify ID
    const statsUrl = new URL("https://api.songstats.com/enterprise/v1/tracks/stats");
    if (track.isrc) statsUrl.searchParams.set("isrc", track.isrc);
    else if (track.spotify_track_id) statsUrl.searchParams.set("spotifyTrackId", track.spotify_track_id);
    else {
      res.json({ streams: null });
      return;
    }
    statsUrl.searchParams.set("source", "spotify");

    type SongstatsStatsResult = {
      stats?: { spotify?: { streams?: number } };
    };

    const statsData = await jsonGet<SongstatsStatsResult>(statsUrl.toString(), {
      apikey: SONGSTATS_KEY,
    });

    const streams = statsData?.stats?.spotify?.streams ?? null;
    res.json({ streams });
  } catch (err) {
    logger.error({ err, artist, title }, "Songstats stats error");
    res.json({ streams: null }); // graceful fallback
  }
});

export default router;
