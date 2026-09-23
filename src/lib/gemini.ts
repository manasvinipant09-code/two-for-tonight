import { GoogleGenAI, Type } from "@google/genai";
import { TMDB_GENRES, languagesToIso } from "./tmdb";
import type { PreferenceProfile, PooledTitle, SearchBrief } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// Flash is fast and cheap enough for a per-session structured-output call;
// swap to a Pro model via env var if you want stronger reasoning on the brief.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const GENRE_LIST = Object.keys(TMDB_GENRES).join(", ");

// Structured output schema — Gemini enforces this shape directly, so unlike
// a plain-text prompt we don't need to parse/repair JSON out of prose.
const BRIEF_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    with_genres: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    without_genres: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    sort_by: { type: Type.STRING },
    rationale: { type: Type.STRING },
  },
  required: ["with_genres", "without_genres", "keywords", "sort_by", "rationale"],
};

function currentYear() {
  return new Date().getFullYear();
}

function eraToDateRange(eras: string[]): { gte: string | null; lte: string | null } {
  if (eras.length === 0 || eras.includes("any")) return { gte: null, lte: null };
  const ranges = eras.map((e) => {
    if (e === "classic") return { gte: "1900-01-01", lte: "1999-12-31" };
    if (e === "2000_2020") return { gte: "2000-01-01", lte: "2020-12-31" };
    if (e === "recent") return { gte: "2021-01-01", lte: `${currentYear()}-12-31` };
    return { gte: null, lte: null };
  });
  const gtes = ranges.map((r) => r.gte).filter(Boolean) as string[];
  const ltes = ranges.map((r) => r.lte).filter(Boolean) as string[];
  return {
    gte: gtes.length ? gtes.sort()[0] : null,
    lte: ltes.length ? ltes.sort().reverse()[0] : null,
  };
}

async function callGemini(systemInstruction: string, userMsg: string): Promise<any> {
  const resp = await ai.models.generateContent({
    model: MODEL,
    contents: userMsg,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: BRIEF_SCHEMA,
    },
  });
  const text = resp.text ?? "{}";
  return JSON.parse(text);
}

/**
 * Round 1: reads both partners' structured preferences AND free-text mood
 * descriptions, and produces a single TMDB search brief that satisfies both
 * — including nuance from the free text that no checkbox captures.
 */
export async function generateSearchBrief(
  prefA: PreferenceProfile,
  prefB: PreferenceProfile,
  history?: { liked: string[]; disliked: string[] }
): Promise<SearchBrief> {
  const bothLanguages = Array.from(new Set([...prefA.languages, ...prefB.languages]));
  const anyLanguage = bothLanguages.includes("any");
  const isoLanguages = anyLanguage ? [] : languagesToIso(bothLanguages);

  const bothEras = Array.from(new Set([...prefA.eras, ...prefB.eras]));
  const { gte, lte } = eraToDateRange(bothEras);

  const strictestRating = Math.max(prefA.minRating, prefB.minRating);
  const includeSeries =
    prefA.contentType === "include_series" || prefB.contentType === "include_series";

  const system = `You are the taste engine behind "Two for Tonight", a movie/TV matchmaker for couples/friends in India who can't agree what to watch. You read two independent, unseen-to-each-other preference profiles and translate them into ONE TMDB discover query brief that will satisfy both people simultaneously — not a compromise that bores both, but a genuine overlap in their actual tastes. Pay special attention to the free-text mood descriptions: they carry nuance the checkboxes can't (pacing, tone, what kind of night this is).

with_genres: 1-4 TMDB genre ids from this list: ${GENRE_LIST}
without_genres: 0-3 ids to actively exclude
keywords: 3-6 short mood/tone keywords blending both free-text descriptions
sort_by: one of popularity.desc, vote_average.desc, primary_release_date.desc
rationale: one sentence, plain language, on the overlap you found between the two people`;

  const userMsg = `PARTNER A
- Mood tags: ${prefA.mood.join(", ") || "none"}
- Mood, in their words: ${prefA.moodFreeText || "(nothing written)"}
- Languages: ${prefA.languages.join(", ")}
- Wants series included: ${prefA.contentType === "include_series"}
- Minimum rating: ${prefA.minRating}+
- Eras: ${prefA.eras.join(", ")}

PARTNER B
- Mood tags: ${prefB.mood.join(", ") || "none"}
- Mood, in their words: ${prefB.moodFreeText || "(nothing written)"}
- Languages: ${prefB.languages.join(", ")}
- Wants series included: ${prefB.contentType === "include_series"}
- Minimum rating: ${prefB.minRating}+
- Eras: ${prefB.eras.join(", ")}
${
  history && (history.liked.length || history.disliked.length)
    ? `\nTHIS PAIR'S HISTORY TOGETHER\n- Watched and enjoyed: ${history.liked.join(", ") || "none yet"}\n- Right-swiped in the past but it flopped / rated low: ${history.disliked.join(", ") || "none"}\nLean toward what actually worked for them before, more than what they said they wanted tonight if the two conflict.`
    : ""
}

Produce the brief.`;

  const parsed = await callGemini(system, userMsg);

  return {
    media_types: includeSeries ? ["movie", "tv"] : ["movie"],
    with_genres: parsed.with_genres ?? [],
    without_genres: parsed.without_genres ?? [],
    with_original_language: isoLanguages,
    "vote_average.gte": strictestRating,
    release_date_gte: gte,
    release_date_lte: lte,
    keywords: parsed.keywords ?? [],
    sort_by: parsed.sort_by ?? "popularity.desc",
    rationale: parsed.rationale ?? "",
  };
}

/**
 * Round 2 (and beyond): no mutual match in round 1. Reads BOTH partners'
 * right-swipe lists from the round just finished and generates a brief that
 * leans into what each of them actually reached for, while staying inside
 * the original hard constraints (rating floor, language, era).
 */
export async function refineSearchBrief(
  previousBrief: SearchBrief,
  rightSwipesA: PooledTitle[],
  rightSwipesB: PooledTitle[],
  leftSwipesA: PooledTitle[],
  leftSwipesB: PooledTitle[]
): Promise<SearchBrief> {
  const system = `You are refining a movie/TV search brief for "Two for Tonight" after a first round of swiping produced no mutual match. You will see what each partner swiped right and left on. Find the pattern in what each of them reached for — genre, tone, pace — and adjust the brief to surface more titles like their right-swipes and fewer like their left-swipes, while staying within the same rating/language/era constraints.

with_genres: TMDB genre ids from this list: ${GENRE_LIST}
without_genres: ids to exclude
keywords: 3-6 short mood/tone keywords
sort_by: popularity.desc | vote_average.desc | primary_release_date.desc
rationale: one sentence on what you noticed and adjusted`;

  const describe = (list: PooledTitle[]) =>
    list.map((t) => `${t.title} (${t.year ?? "?"})`).join(", ") || "none";

  const userMsg = `Previous brief: ${JSON.stringify(previousBrief)}

Partner A right-swiped: ${describe(rightSwipesA)}
Partner A left-swiped: ${describe(leftSwipesA)}
Partner B right-swiped: ${describe(rightSwipesB)}
Partner B left-swiped: ${describe(leftSwipesB)}

Neither partner right-swiped the same title, so no match yet. Adjust the brief to find the overlap between what A and B are each individually drawn to.`;

  const parsed = await callGemini(system, userMsg);

  return {
    ...previousBrief,
    with_genres: parsed.with_genres ?? previousBrief.with_genres,
    without_genres: parsed.without_genres ?? previousBrief.without_genres,
    keywords: parsed.keywords ?? previousBrief.keywords,
    sort_by: parsed.sort_by ?? previousBrief.sort_by,
    rationale: parsed.rationale ?? previousBrief.rationale,
  };
}
