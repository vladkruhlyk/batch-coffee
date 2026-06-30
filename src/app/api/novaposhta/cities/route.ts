import { NextResponse, type NextRequest } from "next/server";
import { searchCities } from "@/lib/novaposhta";

/**
 * GET /api/novaposhta/cities?q=Полт
 * City autocomplete for the checkout NP picker. Server-side so the API
 * key stays secret. On error returns an empty list (200) so the
 * autocomplete UI degrades gracefully instead of throwing.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const cities = await searchCities(q);
    return NextResponse.json({ cities });
  } catch (e) {
    console.error("novaposhta/cities failed:", e);
    return NextResponse.json({ cities: [] });
  }
}
