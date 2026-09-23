import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { findMutualMatch, bothPartnersFinished, combinedScore, SwipeRow } from "@/lib/matching";
import type { Role } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseServer();
  const { role, tmdbId, mediaType, direction, round } = (await req.json()) as {
    role: Role;
    tmdbId: number;
    mediaType: "movie" | "tv";
    direction: "left" | "right";
    round: number;
  };

  const { error: insertErr } = await db.from("swipes").upsert(
    {
      session_id: params.id,
      round,
      role,
      tmdb_id: tmdbId,
      media_type: mediaType,
      direction,
    },
    { onConflict: "session_id,round,role,tmdb_id" }
  );
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Log to durable per-partner history for future personalisation.
  const { data: partnerRow } = await db
    .from("session_partners")
    .select("partner_id")
    .eq("session_id", params.id)
    .eq("role", role)
    .single();
  if (partnerRow?.partner_id) {
    await db.from("partner_history").upsert(
      {
        partner_id: partnerRow.partner_id,
        tmdb_id: tmdbId,
        media_type: mediaType,
        liked: direction === "right",
        session_id: params.id,
      },
      { onConflict: "partner_id,session_id,tmdb_id" }
    );
  }

  const { data: roundSwipes } = await db
    .from("swipes")
    .select("role, tmdb_id, direction, round")
    .eq("session_id", params.id)
    .eq("round", round);

  const swipes = (roundSwipes ?? []) as SwipeRow[];
  const matchId = direction === "right" ? findMutualMatch(swipes) : null;

  if (matchId !== null) {
    await db
      .from("sessions")
      .update({
        status: "matched",
        matched_tmdb_id: matchId,
        matched_media_type: mediaType,
        matched_at: new Date().toISOString(),
      })
      .eq("id", params.id);
    return NextResponse.json({ matched: true, tmdbId: matchId });
  }

  const { data: pool } = await db
    .from("round_pools")
    .select("tmdb_id")
    .eq("session_id", params.id)
    .eq("round", round);
  const poolSize = pool?.length ?? 30;

  if (bothPartnersFinished(swipes, poolSize, round)) {
    if (round >= 2) {
      // Two full rounds, no mutual right-swipe — surface the top 5 by
      // combined score for the partners to decide together.
      const scores = combinedScore(swipes);
      await db.from("sessions").update({ status: "final_call", round }).eq("id", params.id);
      return NextResponse.json({
        matched: false,
        roundComplete: true,
        finalCall: true,
        topScores: Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
      });
    }
    // Advance to round 2: bump round, trigger refined pool build.
    await db
      .from("sessions")
      .update({ status: "building_pool", round: round + 1 })
      .eq("id", params.id);
    const origin = req.nextUrl.origin;
    fetch(`${origin}/api/session/${params.id}/pool`, { method: "POST" }).catch(() => {});
    return NextResponse.json({ matched: false, roundComplete: true, finalCall: false });
  }

  return NextResponse.json({ matched: false, roundComplete: false });
}
