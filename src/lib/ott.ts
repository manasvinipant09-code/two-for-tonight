import type { OttOffer } from "./types";

const HOST = process.env.RAPIDAPI_HOST || "ott-details.p.rapidapi.com";

/**
 * Looks up which Indian OTT platforms a title is currently streaming/renting/
 * buying on, via RapidAPI's "OTT details" API (GoX-ai). This API keys its
 * title lookups by IMDb id, not TMDB id, so the caller must pass the imdbId
 * (fetched from TMDB's external_ids on the title's detail call).
 *
 * NOTE: GoX-ai doesn't publish a static reference doc outside RapidAPI's
 * own login-gated "Endpoints" tab, so the exact path/query param names below
 * are a best-effort based on their public endpoint descriptions ("Title
 * Details" endpoint, takes an `imdbid` param, region-aware). Before relying
 * on this in production: open the API's Endpoints tab on RapidAPI, pick the
 * "Title Details" endpoint, copy its exact request URL + param names from
 * the code snippet panel, and paste them in here if they differ.
 */
export async function getIndianOttOffers(imdbId: string): Promise<OttOffer[]> {
  if (!imdbId) return [];
  try {
    const res = await fetch(
      `https://${HOST}/title/details?imdbid=${encodeURIComponent(imdbId)}&region=IN`,
      {
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
          "X-RapidAPI-Host": HOST,
        },
        next: { revalidate: 3600 }, // availability shifts daily at most; cache an hour
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const offers = data?.ott_details ?? data?.streaming_info ?? data?.providers ?? [];

    return offers.map((o: any) => ({
      platform: o.provider_name ?? o.name ?? o.platform ?? "Unknown",
      link: o.link ?? o.url ?? o.deeplink ?? "",
      type: (o.type ?? o.stream_type ?? "sub") as OttOffer["type"],
    }));
  } catch {
    return [];
  }
}

/** Batches OTT lookups with light concurrency limiting to stay under rate limits. */
export async function getIndianOttOffersBatch(
  imdbIds: string[]
): Promise<Record<string, OttOffer[]>> {
  const out: Record<string, OttOffer[]> = {};
  const CONCURRENCY = 4;
  for (let i = 0; i < imdbIds.length; i += CONCURRENCY) {
    const batch = imdbIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((id) => getIndianOttOffers(id)));
    batch.forEach((id, idx) => (out[id] = results[idx]));
  }
  return out;
}
