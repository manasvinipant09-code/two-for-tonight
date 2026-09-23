import type { PooledTitle, SearchBrief } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

const LANGUAGE_TO_ISO: Record<string, string> = {
  hindi: "hi",
  english: "en",
  tamil: "ta",
  telugu: "te",
  kannada: "kn",
};

export function languagesToIso(langs: string[]): string[] {
  return langs.map((l) => LANGUAGE_TO_ISO[l]).filter(Boolean);
}

async function discover(mediaType: "movie" | "tv", brief: SearchBrief, page: number) {
  const params = new URLSearchParams({
    include_adult: "false",
    page: String(page),
    sort_by: brief.sort_by || "popularity.desc",
    "vote_average.gte": String(brief["vote_average.gte"] ?? 6),
    "vote_count.gte": "50",
  });

  if (brief.with_genres.length) params.set("with_genres", brief.with_genres.join(","));
  if (brief.without_genres.length) params.set("without_genres", brief.without_genres.join(","));
  if (brief.with_original_language.length === 1) {
    params.set("with_original_language", brief.with_original_language[0]);
  }
  const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";
  if (brief.release_date_gte) params.set(`${dateField}.gte`, brief.release_date_gte);
  if (brief.release_date_lte) params.set(`${dateField}.lte`, brief.release_date_lte);

  const res = await fetch(`${TMDB_BASE}/discover/${mediaType}?${params.toString()}`, {
    headers: authHeaders(),
    // Discover results change slowly; cache briefly to avoid duplicate calls
    // when both partners' pool-building requests land close together.
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`TMDB discover ${mediaType} failed: ${res.status}`);
  const data = await res.json();
  return data.results as any[];
}

async function fetchDetails(mediaType: "movie" | "tv", id: number) {
  const res = await fetch(
    `${TMDB_BASE}/${mediaType}/${id}?append_to_response=external_ids`,
    { headers: authHeaders(), next: { revalidate: 3600 } }
  );
  if (!res.ok) return null;
  return res.json();
}

function toPooledTitle(mediaType: "movie" | "tv", raw: any, details: any | null): PooledTitle {
  const title = mediaType === "movie" ? raw.title : raw.name;
  const dateStr = mediaType === "movie" ? raw.release_date : raw.first_air_date;
  const year = dateStr ? Number(dateStr.slice(0, 4)) : null;
  const runtime =
    mediaType === "movie"
      ? details?.runtime ?? null
      : details?.episode_run_time?.[0] ?? null;
  const imdbId =
    details?.external_ids?.imdb_id ?? details?.imdb_id ?? null;

  return {
    tmdb_id: raw.id,
    imdb_id: imdbId,
    media_type: mediaType,
    title,
    year,
    poster_path: raw.poster_path ?? null,
    imdb_rating: raw.vote_average ? Math.round(raw.vote_average * 10) / 10 : null,
    runtime_minutes: runtime,
    synopsis: raw.overview ?? null,
  };
}

/**
 * Pull up to `count` titles from TMDB matching a Claude-generated brief.
 * Fetches a couple of discover pages per media type, hydrates runtime via
 * detail calls, and dedupes against `excludeIds` (titles already shown in
 * earlier rounds).
 */
export async function fetchTitlesForBrief(
  brief: SearchBrief,
  count: number,
  excludeIds: Set<number> = new Set()
): Promise<PooledTitle[]> {
  const mediaTypes: ("movie" | "tv")[] = brief.media_types.length ? brief.media_types : ["movie"];
  const perType = Math.ceil((count * 1.6) / mediaTypes.length); // overfetch, we'll trim after excludes

  const raw: { mediaType: "movie" | "tv"; item: any }[] = [];
  for (const mt of mediaTypes) {
    for (const page of [1, 2]) {
      if (raw.filter((r) => r.mediaType === mt).length >= perType) break;
      try {
        const results = await discover(mt, brief, page);
        for (const item of results) raw.push({ mediaType: mt, item });
      } catch {
        // one bad page shouldn't sink the whole pool
      }
    }
  }

  const seen = new Set<number>();
  const candidates = raw.filter(({ mediaType, item }) => {
    const key = item.id;
    if (excludeIds.has(key) || seen.has(key)) return false;
    if (!item.overview || !item.poster_path) return false; // no half-empty cards
    seen.add(key);
    return true;
  });

  // Hydrate runtime for a capped number of candidates to keep this fast.
  const hydrated: PooledTitle[] = [];
  for (const { mediaType, item } of candidates.slice(0, count)) {
    const details = await fetchDetails(mediaType, item.id).catch(() => null);
    hydrated.push(toPooledTitle(mediaType, item, details));
  }

  return hydrated.slice(0, count);
}

export const TMDB_GENRES: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
};
