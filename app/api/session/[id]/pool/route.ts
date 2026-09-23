import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { generateSearchBrief, refineSearchBrief } from "@/lib/claude";
import { fetchTitlesForBrief } from "@/lib/tmdb";
import type { PreferenceProfile, PooledTitle } from "@/lib/types";

const POOL_SIZE = 30;

/**
 * Looks at what this specific pair (by partner_id) has watched and rated
 * highly together before, versus titles they right-swiped but rated low
 * (i.e. thought they'd like, didn't). Used to nudge round-1 briefs toward
 * what actually works for them over time.
 */
async function getSharedHistory(
  db: ReturnType<typeof supabaseServer>,
  partnerIdA: string | null,
  partnerIdB: string | null,
  currentSessionId: string
): Promise<{ liked: string[]; disliked: string[] } | undefined> {
  if (!partnerIdA || !partnerIdB) return undefined;

  const { data: histA } = await db
    .from("partner_history")
    .select("tmdb_id, liked, session_id")
    .eq("partner_id", partnerIdA)
    .neq("session_id", currentSessionId);
  const { data: histB } = await db
    .from("partner_history")
    .select("tmdb_id, liked, session_id")
    .eq("partner_id", partnerIdB)
    .neq("session_id", currentSessionId);
  if (!histA?.length || !histB?.length) return undefined;

  const bByTitle = new Map(histB.map((h) => [h.tmdb_id, h]));
  const sharedLiked = histA.filter((h) => h.liked && bByTitle.get(h.tmdb_id)?.liked).map((h) => h.tmdb_id);
  const sharedIds = [...new Set(sharedLiked)];
  if (sharedIds.length === 0) return undefined;

  const { data: ratedLow } = await db
    .from("ratings")
    .select("tmdb_id")
    .in("tmdb_id", sharedIds)
    .lte("score", 2);
  const lowIds = new Set((ratedLow ?? []).map((r) => r.tmdb_id));

  const { data: titleRows } = await db
    .from("round_pools")
    .select("tmdb_id, title")
    .in("tmdb_id", sharedIds);
  const nameOf = new Map((titleRows ?? []).map((t) => [t.tmdb_id, t.title]));

  return {
    liked: sharedIds.filter((id) => !lowIds.has(id)).map((id) => nameOf.get(id) ?? String(id)),
    disliked: sharedIds.filter((id) => lowIds.has(id)).map((id) => nameOf.get(id) ?? String(id)),
  };
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseServer();

  const { data: session, error: sessErr } = await db
    .from("sessions")
    .select("*")
    .eq("id", params.id)
    .single();
  if (sessErr || !session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const round = session.round;

  // Titles already shown in any earlier round must never repeat.
  const { data: seenRows } = await db
    .from("round_pools")
    .select("tmdb_id")
    .eq("session_id", params.id)
    .lt("round", round);
  const excludeIds = new Set((seenRows ?? []).map((r) => r.tmdb_id));

  let brief;

  if (round === 1) {
    const { data: partnerRows } = await db
      .from("session_partners")
      .select("*")
      .eq("session_id", params.id);
    const a = partnerRows?.find((p) => p.role === "A");
    const b = partnerRows?.find((p) => p.role === "B");
    if (!a || !b) return NextResponse.json({ error: "both partners must have submitted" }, { status: 409 });

    const toProfile = (row: any): PreferenceProfile => ({
      mood: row.mood ?? [],
      moodFreeText: row.mood_free_text,
      languages: row.languages ?? [],
      contentType: row.content_type,
      minRating: row.min_rating,
      eras: row.eras ?? [],
    });

    const history = await getSharedHistory(db, a.partner_id, b.partner_id, params.id);
    brief = await generateSearchBrief(toProfile(a), toProfile(b), history);
  } else {
    const { data: prevBriefRow } = await db
      .from("round_briefs")
      .select("brief")
      .eq("session_id", params.id)
      .eq("round", round - 1)
      .single();

    const { data: prevSwipes } = await db
      .from("swipes")
      .select("*")
      .eq("session_id", params.id)
      .eq("round", round - 1);

    const { data: prevPool } = await db
      .from("round_pools")
      .select("*")
      .eq("session_id", params.id)
      .eq("round", round - 1);

    const byId = new Map((prevPool ?? []).map((p) => [p.tmdb_id, p as PooledTitle]));
    const titlesFor = (role: string, direction: string) =>
      (prevSwipes ?? [])
        .filter((s) => s.role === role && s.direction === direction)
        .map((s) => byId.get(s.tmdb_id))
        .filter(Boolean) as PooledTitle[];

    brief = await refineSearchBrief(
      prevBriefRow?.brief,
      titlesFor("A", "right"),
      titlesFor("B", "right"),
      titlesFor("A", "left"),
      titlesFor("B", "left")
    );
  }

  await db.from("round_briefs").insert({
    session_id: params.id,
    round,
    brief,
    rationale: brief.rationale,
  });

  const titles = await fetchTitlesForBrief(brief, POOL_SIZE, excludeIds);

  if (titles.length === 0) {
    // Extremely narrow filters (e.g. 9+ rating + rare language combo) can
    // legitimately come up empty. Relax the rating floor by one point and retry once.
    const relaxed = { ...brief, "vote_average.gte": Math.max(5, brief["vote_average.gte"] - 1) };
    const retry = await fetchTitlesForBrief(relaxed, POOL_SIZE, excludeIds);
    titles.push(...retry);
  }

  if (titles.length > 0) {
    await db.from("round_pools").insert(
      titles.map((t) => ({
        session_id: params.id,
        round,
        tmdb_id: t.tmdb_id,
        imdb_id: t.imdb_id,
        media_type: t.media_type,
        title: t.title,
        year: t.year,
        poster_path: t.poster_path,
        imdb_rating: t.imdb_rating,
        runtime_minutes: t.runtime_minutes,
        synopsis: t.synopsis,
      }))
    );
  }

  await db.from("sessions").update({ status: "swiping" }).eq("id", params.id);

  return NextResponse.json({ ok: true, count: titles.length });
}
