import { NextResponse, type NextRequest } from "next/server";
import { evaluatePromo, resolvePromoRule } from "@/lib/promo-server";

/**
 * POST /api/promo/validate  { code: string, subtotal: number }
 *
 * Called when the customer clicks "Apply" in the cart. Resolves the code
 * from Sanity and checks validity (active / date window / min subtotal)
 * for the given subtotal. Returns a display snapshot the cart stores —
 * but the REAL charge is re-validated independently in api/orders/create,
 * so this endpoint is advisory-only and safe to expose.
 *
 * Always 200 for a well-formed request; `ok` distinguishes accept/reject
 * so the client can show the reason inline.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    subtotal?: unknown;
  } | null;

  if (
    !body ||
    typeof body.code !== "string" ||
    typeof body.subtotal !== "number" ||
    !Number.isFinite(body.subtotal)
  ) {
    return NextResponse.json(
      { ok: false, reason: "invalid request" },
      { status: 400 },
    );
  }

  const subtotal = Math.max(0, body.subtotal);
  const rule = await resolvePromoRule(body.code);
  const result = evaluatePromo(rule, subtotal, new Date());

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }
  return NextResponse.json({
    ok: true,
    snapshot: result.snapshot,
    discount: result.discount,
  });
}
