import { NextRequest, NextResponse } from "next/server";
import { getIndianOttOffers } from "@/lib/ott";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; imdbId: string } }
) {
  if (!params.imdbId || params.imdbId === "null") {
    return NextResponse.json({ offers: [] });
  }
  const offers = await getIndianOttOffers(params.imdbId);
  return NextResponse.json({ offers });
}
