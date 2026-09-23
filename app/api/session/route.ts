import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import type { PreferenceProfile } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { preferences, partnerId } = body as {
    preferences: PreferenceProfile;
    partnerId?: string;
  };

  if (!preferences) {
    return NextResponse.json({ error: "preferences required" }, { status: 400 });
  }

  const db = supabaseServer();

  // Ensure a stable partner identity exists for history/personalisation.
  let resolvedPartnerId = partnerId;
  if (!resolvedPartnerId) {
    const { data, error } = await db.from("partners").insert({}).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    resolvedPartnerId = data.id;
  }

  const { data: session, error: sessionErr } = await db
    .from("sessions")
    .insert({ status: "waiting_for_b" })
    .select("*")
    .single();
  if (sessionErr) return NextResponse.json({ error: sessionErr.message }, { status: 500 });

  const { error: prefErr } = await db.from("session_partners").insert({
    session_id: session.id,
    role: "A",
    partner_id: resolvedPartnerId,
    mood: preferences.mood,
    mood_free_text: preferences.moodFreeText,
    languages: preferences.languages,
    content_type: preferences.contentType,
    min_rating: preferences.minRating,
    eras: preferences.eras,
    submitted_at: new Date().toISOString(),
  });
  if (prefErr) return NextResponse.json({ error: prefErr.message }, { status: 500 });

  return NextResponse.json({ session, partnerId: resolvedPartnerId });
}
