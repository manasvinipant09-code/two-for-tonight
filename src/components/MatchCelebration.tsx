"use client";

import { useEffect, useState } from "react";
import type { OttOffer, PooledTitle } from "@/lib/types";

export default function MatchCelebration({
  title,
  sessionId,
  onRate,
}: {
  title: PooledTitle;
  sessionId: string;
  onRate: (score: number) => void;
}) {
  const [offers, setOffers] = useState<OttOffer[] | null>(null);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    if (!title.imdb_id) {
      setOffers([]);
      return;
    }
    fetch(`/api/session/${sessionId}/ott/${title.imdb_id}`)
      .then((r) => r.json())
      .then((d) => setOffers(d.offers ?? []))
      .catch(() => setOffers([]));
  }, [sessionId, title]);

  const poster = title.poster_path
    ? `https://image.tmdb.org/t/p/w500${title.poster_path}`
    : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-velvet/20 via-ink to-ink">
      <div className="animate-match-in text-center mb-6">
        <p className="uppercase tracking-[0.3em] text-xs text-marquee mb-2">It's a match</p>
        <h1 className="font-display text-4xl">{title.title}</h1>
      </div>

      <div className="animate-match-in w-full max-w-xs rounded-2xl overflow-hidden shadow-card mb-6">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={title.title} className="w-full" />
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-paper/80 mb-8">
        {title.year && <span>{title.year}</span>}
        {title.imdb_rating && <span>★ {title.imdb_rating}</span>}
        {title.runtime_minutes && <span>{title.runtime_minutes} min</span>}
      </div>

      <div className="w-full max-w-sm">
        <h2 className="text-sm font-semibold text-paper/90 mb-3 text-center">
          Watch it now on
        </h2>
        {offers === null && (
          <p className="text-center text-mist text-sm">Checking Indian streaming platforms…</p>
        )}
        {offers?.length === 0 && (
          <p className="text-center text-mist text-sm">
            Not currently on a major Indian streaming platform — worth a quick search on JustWatch.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {offers?.map((o, i) => (
            <a
              key={i}
              href={o.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-dusk border border-paper/10 rounded-xl px-4 py-3 hover:border-marquee/50 transition-colors"
            >
              <span className="font-medium">{o.platform}</span>
              <span className="text-xs uppercase tracking-wide text-mist">
                {o.type === "sub" ? "Included" : o.type}
              </span>
            </a>
          ))}
        </div>
      </div>

      {!rated && (
        <div className="mt-10 w-full max-w-sm text-center">
          <p className="text-sm text-mist mb-3">Watched it already? Rate it for next time.</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => {
                  onRate(n);
                  setRated(true);
                }}
                className="w-10 h-10 rounded-full border border-paper/20 hover:border-marquee text-paper/80 hover:text-marquee transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      {rated && <p className="mt-10 text-sm text-marquee">Saved — thanks!</p>}
    </div>
  );
}
