export interface SwipeRow {
  role: "A" | "B";
  tmdb_id: number;
  direction: "left" | "right";
  round: number;
}

/** Returns the tmdb_id both partners right-swiped in this round, if any. */
export function findMutualMatch(swipes: SwipeRow[]): number | null {
  const rightA = new Set(swipes.filter((s) => s.role === "A" && s.direction === "right").map((s) => s.tmdb_id));
  const rightB = swipes.filter((s) => s.role === "B" && s.direction === "right").map((s) => s.tmdb_id);
  for (const id of rightB) {
    if (rightA.has(id)) return id;
  }
  return null;
}

/** Combined score across both partners for the final top-5 tiebreak screen. */
export function combinedScore(swipes: SwipeRow[]): Map<number, number> {
  const score = new Map<number, number>();
  for (const s of swipes) {
    if (s.direction !== "right") continue;
    score.set(s.tmdb_id, (score.get(s.tmdb_id) ?? 0) + 1);
  }
  return score;
}

export function bothPartnersFinished(
  swipes: SwipeRow[],
  poolSize: number,
  round: number
): boolean {
  const countFor = (role: "A" | "B") =>
    swipes.filter((s) => s.role === role && s.round === round).length;
  return countFor("A") >= poolSize && countFor("B") >= poolSize;
}
