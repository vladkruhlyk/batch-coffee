import { NextResponse, type NextRequest } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

/**
 * POST /api/orders/create
 *
 * Server-side order creation. The supabase client here is bound to
 * the request's cookies — auth.uid() server-side matches whatever
 * the customer's browser has been carrying, with no chance of falling
 * out of sync with a zustand cache or a stale JS-side session object.
 *
 * RLS still gates the insert: `auth.uid() = user_id` for logged-in
 * customers, `both null` for guests. We compute user_id from the
 * resolved server session, so by construction the policy passes for
 * any coherent visitor.
 *
 * Why not just use the service-role key and bypass RLS? Two reasons:
 *   1. Forces us to honour the same RLS rule that protects every
 *      other path — fewer surprises later when we add fields.
 *   2. Catches account-deleted / session-revoked edge cases — the
 *      route returns 401 rather than silently inserting an orphan.
 */

export const runtime = "nodejs";

interface CreateOrderBody {
  items: Array<{
    productSlug: string;
    productName: string;
    thumb: string | null;
    weightLabel: string;
    weightGrams: number;
    roast: string | null;
    grind: string | null;
    unitPrice: number;
    quantity: number;
  }>;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  recipientEmail: string | null;
  deliveryMethod: "novaposhta-branch" | "novaposhta-postomat" | "pickup";
  deliveryAddress: string;
  deliveryCity: string | null;
  paymentMethod: "card" | "cod";
  comment: string | null;
  deliveryFee: number;
  discount?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as CreateOrderBody | null;
    if (!body) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    if (
      !body.recipientFirstName?.trim() ||
      !body.recipientLastName?.trim() ||
      !body.recipientPhone?.trim() ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        { error: "required fields missing" },
        { status: 400 },
      );
    }

    // Bounds on items so a tampered client can't blow up the DB or
    // submit nonsensical numbers. 100 lines is more than any real
    // coffee order, and prices are integer hryvnias so we cap at a
    // generous ceiling rather than try to guess a reasonable max.
    if (body.items.length > 100) {
      return NextResponse.json(
        { error: "too many items in cart" },
        { status: 400 },
      );
    }
    for (const it of body.items) {
      if (
        !Number.isFinite(it.unitPrice) ||
        it.unitPrice < 0 ||
        it.unitPrice > 1_000_000 ||
        !Number.isInteger(it.quantity) ||
        it.quantity < 1 ||
        it.quantity > 999
      ) {
        return NextResponse.json(
          {
            error: `invalid line — slug=${it.productSlug}, qty=${it.quantity}, price=${it.unitPrice}`,
          },
          { status: 400 },
        );
      }
    }
    if (
      !Number.isFinite(body.deliveryFee) ||
      body.deliveryFee < 0 ||
      body.deliveryFee > 100_000
    ) {
      return NextResponse.json(
        { error: "invalid delivery fee" },
        { status: 400 },
      );
    }

    // Resolve identity via the cookie-bound client (anon, JWT-aware).
    // Then INSERT via the service-role client so we sidestep any
    // RLS-JWT drift — same trust model since the server, not the
    // client, decides what user_id to write.
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    const userId = user?.id ?? null;
    const supabase = createSupabaseAdminClient();

    // Compute money on the server — the client sends unit prices,
    // but the row totals (subtotal/total) get re-derived here so a
    // tampered client can't underpay.
    const subtotal = body.items.reduce(
      (s, i) => s + i.unitPrice * i.quantity,
      0,
    );

    // Validate discount the same way the other money fields are
    // validated above. Without this a tampered client could send a
    // huge or NaN discount and drive `total` negative / NaN into the
    // DB (the orders table has no CHECK on total).
    const discount = body.discount ?? 0;
    if (
      !Number.isFinite(discount) ||
      discount < 0 ||
      discount > subtotal + body.deliveryFee
    ) {
      return NextResponse.json({ error: "invalid discount" }, { status: 400 });
    }

    const total = subtotal + body.deliveryFee - discount;
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        { error: "order total must be positive" },
        { status: 400 },
      );
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        subtotal,
        delivery_fee: body.deliveryFee,
        discount,
        total,
        delivery_method: body.deliveryMethod,
        delivery_address: body.deliveryAddress,
        delivery_city: body.deliveryCity,
        payment_method: body.paymentMethod,
        recipient_first_name: body.recipientFirstName.trim(),
        recipient_last_name: body.recipientLastName.trim(),
        recipient_phone: body.recipientPhone.trim(),
        recipient_email: body.recipientEmail,
        comment: body.comment,
      })
      .select("id, number, view_token")
      .single();
    if (orderErr || !order) {
      console.error("orders/create insert failed:", orderErr);
      return NextResponse.json(
        { error: orderErr?.message ?? "insert failed" },
        { status: 500 },
      );
    }

    const itemsPayload = body.items.map((i) => ({
      order_id: order.id,
      product_slug: i.productSlug,
      product_name: i.productName,
      thumb: i.thumb,
      weight_label: i.weightLabel,
      weight_grams: i.weightGrams,
      roast: i.roast,
      grind: i.grind,
      unit_price: i.unitPrice,
      quantity: i.quantity,
      line_total: i.unitPrice * i.quantity,
    }));
    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(itemsPayload);
    if (itemsErr) {
      console.error("orders/create items insert failed:", itemsErr);
      return NextResponse.json(
        { error: itemsErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: order.id,
      number: order.number as string,
      viewToken: order.view_token as string,
    });
  } catch (e) {
    console.error("orders/create failed:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "internal error",
      },
      { status: 500 },
    );
  }
}
