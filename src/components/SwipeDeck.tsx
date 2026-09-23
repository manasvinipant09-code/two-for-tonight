"use client";

import { useMemo, useRef, useState } from "react";
import TinderCard from "react-tinder-card";
import type { PooledTitle } from "@/lib/types";

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function Card({ title }: { title: PooledTitle }) {
  const poster = title.poster_path
    ? `https://image.tmdb.org/t/p/w500${title.poster_path}`
    : null;

  return (
    <div className="absolute inset-0 rounded-3xl overflow-hidden bg-dusk shadow-card select-none">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={title.title} className="w-full h-full object-cover pointer-events-none" draggable={false} />
      ) : (
        <div className="w-full h-full bg-dusk2" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/85 to-transparent px-5 pt-24 pb-6">
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          <h3 className="font-display text-2xl leading-tight">{title.title}</h3>
          {title.year && <span className="text-mist text-sm">{title.year}</span>}
        </div>
        <div className="flex items-center gap-3 text-sm text-paper/80 mb-2">
          {title.imdb_rating && (
            <span className="flex items-center gap-1">
              <span className="text-marquee">★</span> {title.imdb_rating}
            </span>
          )}
          {title.runtime_minutes && <span>{title.runtime_minutes} min</span>}
          <span className="uppercase text-[11px] tracking-wide text-mist">
            {title.media_type === "tv" ? "Series" : "Movie"}
          </span>
        </div>
        {title.synopsis && (
          <p className="text-sm text-paper/75 leading-snug line-clamp-3">{title.synopsis}</p>
        )}
      </div>
    </div>
  );
}

export default function SwipeDeck({
  titles,
  onSwipe,
  onDeckFinished,
}: {
  titles: PooledTitle[];
  onSwipe: (title: PooledTitle, direction: "left" | "right") => void;
  onDeckFinished: () => void;
}) {
  // Randomise order once per mount (i.e. once per partner, per round).
  const order = useMemo(() => shuffled(titles), [titles]);
  const [index, setIndex] = useState(order.length - 1);
  const swiped = useRef(0);

  function handleSwipe(dir: string, title: PooledTitle) {
    const direction = dir === "right" ? "right" : "left";
    onSwipe(title, direction as "left" | "right");
    swiped.current += 1;
    setIndex((i) => i - 1);
    if (swiped.current >= order.length) onDeckFinished();
  }

  function buttonSwipe(direction: "left" | "right") {
    if (index < 0) return;
    const title = order[index];
    handleSwipe(direction, title);
  }

  const remaining = index + 1;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-sm text-mist mb-4">{remaining} left to review</div>

      <div className="relative w-full max-w-sm" style={{ aspectRatio: "3 / 4.6" }}>
        {order.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-mist text-sm">
            No titles matched both of your filters tightly enough — try loosening the rating or era next time.
          </div>
        )}
        {order.map((title, i) =>
          i > index ? null : (
            <TinderCard
              key={title.tmdb_id}
              onSwipe={(dir) => handleSwipe(dir, title)}
              preventSwipe={["up", "down"]}
              swipeRequirementType="position"
              swipeThreshold={100}
              className="absolute inset-0"
            >
              <Card title={title} />
            </TinderCard>
          )
        )}
      </div>

      <div className="flex items-center gap-6 mt-6">
        <button
          aria-label="Pass"
          onClick={() => buttonSwipe("left")}
          disabled={index < 0}
          className="w-14 h-14 rounded-full border border-paper/20 flex items-center justify-center text-2xl text-paper/70 disabled:opacity-30 active:scale-95 transition-transform"
        >
          ✕
        </button>
        <button
          aria-label="Like"
          onClick={() => buttonSwipe("right")}
          disabled={index < 0}
          className="w-16 h-16 rounded-full bg-marquee flex items-center justify-center text-2xl text-ink disabled:opacity-30 active:scale-95 transition-transform"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
