import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseServer();
  const { tmdbId, mediaType, score, note } = await req.json();

  const { error } = await db.from("ratings").upsert(
    {
      session_id: params.id,
      tmdb_id: tmdbId,
      media_type: mediaType,
      score,
      note: note ?? null,
      rated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,tmdb_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("sessions").update({ status: "completed" }).eq("id", params.id);
  return NextResponse.json({ ok: true });
}
