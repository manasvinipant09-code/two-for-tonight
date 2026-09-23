import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseServer();
  const { tmdbId, mediaType } = await req.json();

  const { error } = await db
    .from("sessions")
    .update({
      status: "matched",
      final_pick_tmdb_id: tmdbId,
      matched_tmdb_id: tmdbId,
      matched_media_type: mediaType,
      matched_at: new Date().toISOString(),
    })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
