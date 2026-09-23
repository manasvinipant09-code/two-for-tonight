import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

/** Partner B scans the QR / opens the link and lands here to claim role B. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseServer();
  const { partnerId } = await req.json().catch(() => ({ partnerId: undefined }));

  const { data: session, error } = await db
    .from("sessions")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const { data: existing } = await db
    .from("session_partners")
    .select("role")
    .eq("session_id", params.id);

  const rolesTaken = new Set((existing ?? []).map((r) => r.role));
  if (rolesTaken.has("B")) {
    // B already joined (e.g. link opened twice) — just let them back in.
    return NextResponse.json({ session, role: "B" });
  }
  if (!rolesTaken.has("A")) {
    return NextResponse.json({ error: "session has no host yet" }, { status: 409 });
  }

  let resolvedPartnerId = partnerId;
  if (!resolvedPartnerId) {
    const { data, error: pErr } = await db.from("partners").insert({}).select("id").single();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    resolvedPartnerId = data.id;
  }

  // Reserve the B seat with an empty row; preferences arrive via /preferences.
  const { error: insertErr } = await db.from("session_partners").insert({
    session_id: params.id,
    role: "B",
    partner_id: resolvedPartnerId,
  });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  await db.from("sessions").update({ status: "waiting_for_prefs" }).eq("id", params.id);

  return NextResponse.json({ session, role: "B", partnerId: resolvedPartnerId });
}
