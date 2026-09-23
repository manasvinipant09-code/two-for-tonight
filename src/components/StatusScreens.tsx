"use client";

import type { PooledTitle } from "@/lib/types";

export function WaitingRoom({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-10 h-10 rounded-full border-2 border-marquee/30 border-t-marquee animate-spin mb-6" />
      <p className="font-display text-2xl mb-2">{message}</p>
      <p className="text-mist text-sm">Hang tight — this usually takes a few seconds.</p>
    </div>
  );
}

export function FinalCall({
  candidates,
  onPick,
}: {
  candidates: (PooledTitle & { score: number })[];
  onPick: (title: PooledTitle) => void;
}) {
  return (
    <div className="min-h-screen px-6 py-10 max-w-lg mx-auto">
      <p className="text-mist text-sm mb-1">Two rounds, no perfect overlap</p>
      <h1 className="font-display text-3xl mb-2">You two are close though.</h1>
      <p className="text-paper/70 text-sm mb-8">
        These got the most love between you both. Pick one together.
      </p>

      <div className="flex flex-col gap-3">
        {candidates.map((c) => {
          const poster = c.poster_path
            ? `https://image.tmdb.org/t/p/w185${c.poster_path}`
            : null;
          return (
            <button
              key={c.tmdb_id}
              onClick={() => onPick(c)}
              className="flex gap-4 items-center bg-dusk border border-paper/10 rounded-2xl p-3 text-left hover:border-marquee/50 transition-colors"
            >
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={c.title} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-16 h-24 bg-dusk2 rounded-lg flex-shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="font-display text-lg leading-tight truncate">{c.title}</h3>
                <p className="text-xs text-mist mt-1">
                  {c.year} · ★ {c.imdb_rating ?? "—"} · {c.score}/2 liked it
                </p>
                <p className="text-sm text-paper/70 line-clamp-2 mt-1">{c.synopsis}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
