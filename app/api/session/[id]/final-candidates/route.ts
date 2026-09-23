import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { combinedScore } from "@/lib/matching";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseServer();

  const { data: swipes } = await db
    .from("swipes")
    .select("role, tmdb_id, direction, round")
    .eq("session_id", params.id);

  const { data: pool } = await db
    .from("round_pools")
    .select("*")
    .eq("session_id", params.id);

  const scores = combinedScore(swipes ?? []);
  const byId = new Map((pool ?? []).map((p) => [p.tmdb_id, p]));

  const top5 = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tmdbId, score]) => ({ ...byId.get(tmdbId), score }))
    .filter((c) => c.tmdb_id);

  return NextResponse.json({ candidates: top5 });
}
