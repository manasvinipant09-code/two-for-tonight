import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseServer();

  const { data: session, error } = await db
    .from("sessions")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: partners } = await db
    .from("session_partners")
    .select("role, submitted_at")
    .eq("session_id", params.id);

  const { data: currentPool } = await db
    .from("round_pools")
    .select("*")
    .eq("session_id", params.id)
    .eq("round", session.round)
    .order("created_at", { ascending: true });

  // Also returned so the client can resolve a matched title's poster/synopsis
  // regardless of which round it was originally surfaced in.
  const { data: allPool } = await db
    .from("round_pools")
    .select("*")
    .eq("session_id", params.id);

  return NextResponse.json({
    session,
    partners: partners ?? [],
    pool: currentPool ?? [],
    allPool: allPool ?? [],
  });
}
