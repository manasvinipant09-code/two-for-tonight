"use client";

import { useState } from "react";
import type { ContentType, Era, Language, MinRating, Mood, PreferenceProfile } from "@/lib/types";

const MOODS: { value: Mood; label: string }[] = [
  { value: "light_fun", label: "Light & fun" },
  { value: "intense_gripping", label: "Intense & gripping" },
  { value: "scary", label: "Scary" },
  { value: "romantic", label: "Romantic" },
  { value: "other", label: "Other" },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "hindi", label: "Hindi" },
  { value: "english", label: "English" },
  { value: "tamil", label: "Tamil" },
  { value: "telugu", label: "Telugu" },
  { value: "kannada", label: "Kannada" },
  { value: "any", label: "Any" },
];

const ERAS: { value: Era; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "classic", label: "Classic (pre-2000)" },
  { value: "2000_2020", label: "2000–2020" },
  { value: "recent", label: "Recent (2021–2026)" },
];

const RATINGS: MinRating[] = [6, 7, 8, 9];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
        active
          ? "bg-marquee text-ink border-marquee"
          : "bg-transparent text-paper/80 border-paper/20 hover:border-paper/40"
      }`}
    >
      {children}
    </button>
  );
}

export default function PreferenceForm({
  who,
  onSubmit,
  submitting,
}: {
  who: string;
  onSubmit: (prefs: PreferenceProfile) => void;
  submitting?: boolean;
}) {
  const [mood, setMood] = useState<Mood[]>([]);
  const [moodFreeText, setMoodFreeText] = useState("");
  const [languages, setLanguages] = useState<Language[]>([]);
  const [contentType, setContentType] = useState<ContentType>("movies_only");
  const [minRating, setMinRating] = useState<MinRating>(7);
  const [eras, setEras] = useState<Era[]>([]);

  function toggleMood(v: Mood) {
    setMood((prev) => (prev.includes(v) ? prev.filter((m) => m !== v) : [...prev, v]));
  }

  function toggleLanguage(v: Language) {
    if (v === "any") {
      setLanguages(["any"]);
      return;
    }
    setLanguages((prev) => {
      const withoutAny = prev.filter((l) => l !== "any");
      return withoutAny.includes(v) ? withoutAny.filter((l) => l !== v) : [...withoutAny, v];
    });
  }

  function toggleEra(v: Era) {
    if (v === "any") {
      setEras(["any"]);
      return;
    }
    setEras((prev) => {
      const withoutAny = prev.filter((e) => e !== "any");
      return withoutAny.includes(v) ? withoutAny.filter((e) => e !== v) : [...withoutAny, v];
    });
  }

  const canSubmit = mood.length > 0 && languages.length > 0 && eras.length > 0;

  return (
    <div className="max-w-lg mx-auto w-full px-6 py-10">
      <p className="text-mist text-sm mb-1 font-medium">{who}</p>
      <h1 className="font-display text-3xl mb-8">What are you in the mood for?</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-paper/90 mb-3">Mood</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {MOODS.map((m) => (
            <Chip key={m.value} active={mood.includes(m.value)} onClick={() => toggleMood(m.value)}>
              {m.label}
            </Chip>
          ))}
        </div>
        <textarea
          value={moodFreeText}
          onChange={(e) => setMoodFreeText(e.target.value)}
          placeholder="Describe what you're in the mood for tonight (optional)"
          rows={2}
          className="w-full bg-dusk border border-paper/10 rounded-xl px-4 py-3 text-sm placeholder:text-mist focus:outline-none focus:border-marquee/60 resize-none"
        />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-paper/90 mb-3">Language</h2>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l.value} active={languages.includes(l.value)} onClick={() => toggleLanguage(l.value)}>
              {l.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-paper/90 mb-3">Content type</h2>
        <div className="flex gap-2">
          <Chip active={contentType === "movies_only"} onClick={() => setContentType("movies_only")}>
            Movies only
          </Chip>
          <Chip active={contentType === "include_series"} onClick={() => setContentType("include_series")}>
            Include series
          </Chip>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-paper/90 mb-3">Minimum IMDb rating</h2>
        <div className="flex gap-2 items-center flex-wrap">
          {RATINGS.map((r) => (
            <div key={r} className="flex flex-col items-center gap-1">
              <Chip active={minRating === r} onClick={() => setMinRating(r)}>
                {r}+
              </Chip>
              {r === 9 && <span className="text-[11px] text-mist">very few titles</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-paper/90 mb-3">Era</h2>
        <div className="flex flex-wrap gap-2">
          {ERAS.map((e) => (
            <Chip key={e.value} active={eras.includes(e.value)} onClick={() => toggleEra(e.value)}>
              {e.label}
            </Chip>
          ))}
        </div>
      </section>

      <button
        disabled={!canSubmit || submitting}
        onClick={() =>
          onSubmit({
            mood,
            moodFreeText: moodFreeText.trim() || null,
            languages,
            contentType,
            minRating,
            eras,
          })
        }
        className="w-full bg-marquee text-ink font-semibold rounded-xl py-4 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {submitting ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
