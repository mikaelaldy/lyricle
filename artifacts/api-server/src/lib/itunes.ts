/**
 * iTunes Search API client — no API key required.
 * Provides track search (for autocomplete) and chart data as a free
 * replacement when Musixmatch is unavailable.
 */

import { logger } from "./logger";

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const APPLE_RSS = "https://rss.applemarketingtools.com/api/v2/us/music/most-played";

export interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl600: string | null;
  previewUrl: string | null;
}

// ─── Internal fetch helper ─────────────────────────────────────────────────────

async function itunesGet<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    logger.warn({ url, err }, "iTunes fetch error");
    return null;
  }
}

function artworkAt600(url100: string | null | undefined): string | null {
  if (!url100) return null;
  return url100.replace("100x100bb", "600x600bb");
}

// ─── Public functions ─────────────────────────────────────────────────────────

/** Search for songs by query string — powers autocomplete. */
export async function searchItunesTracks(q: string, limit = 8): Promise<ItunesTrack[]> {
  if (!q.trim()) return [];
  const url = new URL(ITUNES_SEARCH);
  url.searchParams.set("term", q);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("country", "us");

  type SearchResult = {
    results: Array<{
      trackId: number;
      trackName: string;
      artistName: string;
      collectionName: string;
      artworkUrl100: string;
      previewUrl?: string;
      kind: string;
    }>;
  };

  const data = await itunesGet<SearchResult>(url.toString());
  if (!data?.results) return [];

  return data.results
    .filter((r) => r.kind === "song")
    .map((r) => ({
      trackId: r.trackId,
      trackName: r.trackName,
      artistName: r.artistName,
      collectionName: r.collectionName ?? "",
      artworkUrl600: artworkAt600(r.artworkUrl100),
      previewUrl: r.previewUrl ?? null,
    }));
}

/** Lookup a specific song by artist + title — fetches preview URL and album art. */
export async function lookupItunesTrack(
  artistName: string,
  trackName: string,
): Promise<ItunesTrack | null> {
  const results = await searchItunesTracks(`${artistName} ${trackName}`, 5);
  // Find closest match
  const lower = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const exact = results.find(
    (r) =>
      lower(r.trackName).includes(lower(trackName)) &&
      lower(r.artistName).includes(lower(artistName).split(" ")[0]),
  );
  return exact ?? results[0] ?? null;
}

/** Fetch Apple Music top songs chart (up to 100 tracks). */
export async function fetchItunesChartTracks(limit = 100): Promise<ItunesTrack[]> {
  type RssEntry = {
    id: string;
    name: string;
    artistName: string;
    artworkUrl100: string;
  };
  type RssFeed = { feed: { results: RssEntry[] } };

  const url = `${APPLE_RSS}/${Math.min(limit, 100)}/songs.json`;
  const data = await itunesGet<RssFeed>(url);
  if (!data?.feed?.results) return [];

  // RSS doesn't include preview URLs — enrich the selected track later via lookupItunesTrack
  return data.feed.results.map((r, i) => ({
    trackId: parseInt(r.id, 10) || i + 9000,
    trackName: r.name,
    artistName: r.artistName,
    collectionName: "",
    artworkUrl600: artworkAt600(r.artworkUrl100),
    previewUrl: null,
  }));
}
