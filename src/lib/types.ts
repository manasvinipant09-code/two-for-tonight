export type Role = "A" | "B";

export type Mood = "light_fun" | "intense_gripping" | "scary" | "romantic" | "other";

export type Language = "hindi" | "english" | "tamil" | "telugu" | "kannada" | "any";

export type ContentType = "movies_only" | "include_series";

export type MinRating = 6 | 7 | 8 | 9;

export type Era = "any" | "classic" | "2000_2020" | "recent";

export type SessionStatus =
  | "waiting_for_b"
  | "waiting_for_prefs"
  | "building_pool"
  | "swiping"
  | "matched"
  | "final_call"
  | "completed";

export interface PreferenceProfile {
  mood: Mood[];
  moodFreeText: string | null;
  languages: Language[];
  contentType: ContentType;
  minRating: MinRating;
  eras: Era[];
}

export interface SessionRecord {
  id: string;
  status: SessionStatus;
  round: number;
  matched_tmdb_id: number | null;
  matched_media_type: "movie" | "tv" | null;
  matched_at: string | null;
  final_pick_tmdb_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PooledTitle {
  tmdb_id: number;
  imdb_id: string | null;
  media_type: "movie" | "tv";
  title: string;
  year: number | null;
  poster_path: string | null;
  imdb_rating: number | null;
  runtime_minutes: number | null;
  synopsis: string | null;
}

export interface SearchBrief {
  // TMDB /discover query params, translated from both partners' preferences.
  media_types: ("movie" | "tv")[];
  with_genres: number[];
  without_genres: number[];
  with_original_language: string[]; // ISO 639-1 codes, empty = any
  "vote_average.gte": number;
  release_date_gte: string | null; // YYYY-MM-DD
  release_date_lte: string | null;
  keywords: string[]; // free-text mood keywords to bias TMDB keyword/text search
  sort_by: string;
  rationale: string; // short human-readable explanation, shown nowhere critical but logged
}

export interface OttOffer {
  platform: string;
  link: string;
  type: "sub" | "rent" | "buy" | "free";
}
