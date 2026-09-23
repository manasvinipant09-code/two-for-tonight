import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import type { PreferenceProfile, Role } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseServer();
  const { role, preferences } = (await req.json()) as {
    role: Role;
    preferences: PreferenceProfile;
  };

  if (!role || !preferences) {
    return NextResponse.json({ error: "role and preferences required" }, { status: 400 });
  }

  const { error } = await db
    .from("session_partners")
    .update({
      mood: preferences.mood,
      mood_free_text: preferences.moodFreeText,
      languages: preferences.languages,
      content_type: preferences.contentType,
      min_rating: preferences.minRating,
      eras: preferences.eras,
      submitted_at: new Date().toISOString(),
    })
    .eq("session_id", params.id)
    .eq("role", role);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: partners } = await db
    .from("session_partners")
    .select("role, submitted_at")
    .eq("session_id", params.id);

  const bothSubmitted =
    partners?.length === 2 && partners.every((p) => p.submitted_at !== null);

  if (bothSubmitted) {
    await db.from("sessions").update({ status: "building_pool" }).eq("id", params.id);
    // Fire the pool-building call without blocking this response — the client
    // is subscribed to session status via realtime and will see "swiping"
    // as soon as it's ready.
    const origin = req.nextUrl.origin;
    fetch(`${origin}/api/session/${params.id}/pool`, { method: "POST" }).catch(() => {});
  }

  return NextResponse.json({ ok: true, bothSubmitted });
}
