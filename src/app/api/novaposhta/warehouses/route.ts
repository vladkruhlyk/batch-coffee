import { NextResponse, type NextRequest } from "next/server";
import { getWarehouses } from "@/lib/novaposhta";

/**
 * GET /api/novaposhta/warehouses?cityRef=...&type=branch|postomat&q=12
 * Branches / postomats for a city. Server-side proxy (key stays secret);
 * empty list on error so the UI degrades gracefully.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cityRef = sp.get("cityRef") ?? "";
  const type = sp.get("type") === "postomat" ? "postomat" : "branch";
  const q = sp.get("q") ?? "";
  try {
    const warehouses = await getWarehouses(cityRef, type, q);
    return NextResponse.json({ warehouses });
  } catch (e) {
    console.error("novaposhta/warehouses failed:", e);
    return NextResponse.json({ warehouses: [] });
  }
}
