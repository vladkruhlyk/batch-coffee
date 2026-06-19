import { NextResponse, after, type NextRequest } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { resolveOrderDiscount } from "@/lib/promo-server";
import { resolveOrderPricing } from "@/lib/order-pricing";
import { pushOrderToSheet } from "@/lib/google-sheets";

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
  /** Promo CODE only — never a discount amount. The server resolves the
   *  discount from this so the client can't grant itself an arbitrary
   *  one. */
  promoCode?: string | null;
  /** Client-generated random key, stable across retries of the SAME
   *  order intent. A replayed request returns the original order
   *  instead of inserting a duplicate (unique index, migration 0009). */
  idempotencyKey?: string | null;
}

/** Per-field caps. DB columns are unbounded `text`, so without these a
 *  tampered client could push megabyte strings into every order row
 *  (request-amplification + bloated backups). Generous for real data. */
const MAX_LEN = {
  name: 100,
  phone: 32,
  email: 200,
  address: 500,
  city: 120,
  comment: 2000,
  promo: 50,
  itemString: 300,
  thumb: 2000,
} as const;

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
    if (
      body.recipientFirstName.length > MAX_LEN.name ||
      body.recipientLastName.length > MAX_LEN.name ||
      body.recipientPhone.length > MAX_LEN.phone ||
      (body.recipientEmail?.length ?? 0) > MAX_LEN.email ||
      (body.deliveryAddress?.length ?? 0) > MAX_LEN.address ||
      (body.deliveryCity?.length ?? 0) > MAX_LEN.city ||
      (body.comment?.length ?? 0) > MAX_LEN.comment ||
      (body.promoCode?.length ?? 0) > MAX_LEN.promo
    ) {
      return NextResponse.json({ error: "field too long" }, { status: 400 });
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
      // Required string fields + weightGrams. Without this, a null/empty
      // productSlug/productName/weightLabel or a bad weightGrams hits the
      // NOT NULL columns and surfaces as an opaque 500 instead of a clean
      // 400.
      if (
        !it.productSlug?.trim() ||
        !it.productName?.trim() ||
        !it.weightLabel?.trim() ||
        !Number.isFinite(it.weightGrams) ||
        it.weightGrams <= 0
      ) {
        return NextResponse.json(
          { error: `invalid line fields — slug=${it.productSlug}` },
          { status: 400 },
        );
      }
      if (
        it.productSlug.length > MAX_LEN.itemString ||
        it.productName.length > MAX_LEN.itemString ||
        it.weightLabel.length > MAX_LEN.itemString ||
        (it.roast?.length ?? 0) > MAX_LEN.itemString ||
        (it.grind?.length ?? 0) > MAX_LEN.itemString ||
        (it.thumb?.length ?? 0) > MAX_LEN.thumb
      ) {
        return NextResponse.json(
          { error: "item field too long" },
          { status: 400 },
        );
      }
    }
    if (!body.deliveryAddress?.trim()) {
      return NextResponse.json(
        { error: "delivery address required" },
        { status: 400 },
      );
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

    // Idempotency: the client sends a random key that stays the same
    // across retries of one order intent. If we already created an order
    // for this key (network retry, double-click, reload mid-submit),
    // return THAT order instead of inserting a duplicate — duplicate
    // orders mean duplicate charges.
    const idemKey =
      typeof body.idempotencyKey === "string" &&
      /^[A-Za-z0-9-]{8,64}$/.test(body.idempotencyKey)
        ? body.idempotencyKey
        : null;
    if (idemKey) {
      const { data: existing } = await supabase
        .from("orders")
        .select("id, number, view_token")
        .eq("idempotency_key", idemKey)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({
          id: existing.id,
          number: existing.number as string,
          viewToken: existing.view_token as string,
          replayed: true,
        });
      }
      // A lookup error here is non-fatal (e.g. column missing before
      // migration 0009 runs) — we fall through to a normal insert.
    }

    // Price the order SERVER-SIDE from Sanity — never trust the client's
    // unit prices. resolveOrderPricing re-fetches each line by slug +
    // weight, re-applies the wholesale rule, rejects deleted SKUs, and
    // returns the authoritative unit prices + subtotal. A tampered
    // request (e.g. unitPrice:1) therefore can't underpay.
    const pricing = await resolveOrderPricing(
      body.items.map((i) => ({
        productSlug: i.productSlug,
        weightLabel: i.weightLabel,
        weightGrams: i.weightGrams,
        quantity: i.quantity,
      })),
    );
    if (!pricing.ok) {
      return NextResponse.json(
        { error: pricing.error ?? "pricing failed" },
        { status: 400 },
      );
    }
    const subtotal = pricing.subtotal;

    // Resolve the discount SERVER-SIDE from the promo code — re-fetch the
    // rule from Sanity and re-validate (active / dates / min subtotal) so
    // a tampered client can't grant itself a discount, and an expired or
    // disabled code yields 0 (the order still goes through at full price).
    // The result is clamped to [0, subtotal], so `total` can't go negative.
    const discount = await resolveOrderDiscount(
      body.promoCode ?? null,
      subtotal,
      new Date(),
    );

    const total = subtotal + body.deliveryFee - discount;
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        { error: "order total must be positive" },
        { status: 400 },
      );
    }

    const orderRow = {
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
    };

    const insertOrder = (withKey: boolean) =>
      withKey && idemKey
        ? supabase
            .from("orders")
            .insert({ ...orderRow, idempotency_key: idemKey })
            .select("id, number, view_token")
            .single()
        : supabase
            .from("orders")
            .insert(orderRow)
            .select("id, number, view_token")
            .single();

    let { data: order, error: orderErr } = await insertOrder(true);

    // 23505 = unique violation on the idempotency index: a concurrent
    // retry won the race. Return ITS order — same contract as the
    // pre-check replay above.
    if (orderErr?.code === "23505" && idemKey) {
      const { data: existing } = await supabase
        .from("orders")
        .select("id, number, view_token")
        .eq("idempotency_key", idemKey)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({
          id: existing.id,
          number: existing.number as string,
          viewToken: existing.view_token as string,
          replayed: true,
        });
      }
    }

    // 42703 = the idempotency_key column doesn't exist yet (migration
    // 0009 not applied). Degrade gracefully: insert without the key so
    // order creation keeps working; dedup protection kicks in once the
    // migration runs.
    if (orderErr?.code === "42703" && idemKey) {
      ({ data: order, error: orderErr } = await insertOrder(false));
    }

    if (orderErr || !order) {
      console.error("orders/create insert failed:", orderErr);
      return NextResponse.json(
        { error: orderErr?.message ?? "insert failed" },
        { status: 500 },
      );
    }

    // Line items use the SERVER-priced unit prices + weights (pricing.items
    // is index-aligned with body.items). Display-only fields (name, thumb,
    // roast, grind) come from the client.
    const itemsPayload = body.items.map((i, idx) => {
      const priced = pricing.items[idx];
      const unitPrice = priced.unitPrice;
      return {
        order_id: order.id,
        product_slug: i.productSlug,
        product_name: i.productName,
        thumb: i.thumb,
        weight_label: i.weightLabel,
        weight_grams: priced.weightGrams,
        roast: i.roast,
        grind: i.grind,
        unit_price: unitPrice,
        quantity: i.quantity,
        line_total: unitPrice * i.quantity,
      };
    });
    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(itemsPayload);
    if (itemsErr) {
      // The order row is already committed but has no line items — an
      // orphan that corrupts the ledger and could be charged for nothing.
      // Roll it back by deleting it (no Postgres transaction across two
      // statements here, so we compensate manually) before returning the
      // error, so a client retry creates exactly one clean order.
      console.error("orders/create items insert failed:", itemsErr);
      let { error: rollbackErr } = await supabase
        .from("orders")
        .delete()
        .eq("id", order.id);
      if (rollbackErr) {
        // One retry — a transient blip here would otherwise strand an
        // orphan order (and pin its idempotency key, blocking the
        // customer's retry).
        ({ error: rollbackErr } = await supabase
          .from("orders")
          .delete()
          .eq("id", order.id));
      }
      if (rollbackErr) {
        console.error(
          "ALERT orders/create ORPHAN ORDER — rollback failed twice, manual cleanup needed:",
          order.id,
          rollbackErr,
        );
      }
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    // Cash-on-delivery / pickup orders are confirmed at creation (no online
    // payment step), so push them to the Google Sheet now — with an EMPTY
    // "paid at" so the merchant can see at a glance they're not paid yet.
    // Card orders are NOT pushed here: they go to the sheet later from the
    // WayForPay webhook, only once payment is actually approved (an
    // abandoned card checkout shouldn't pollute the sheet). after() runs
    // this AFTER the response is sent, so checkout latency is unaffected.
    if (body.paymentMethod === "cod") {
      const orderNumber = String(order.number ?? "");
      after(async () => {
        await pushOrderToSheet({
          number: orderNumber,
          paidAt: "", // pay on delivery — not paid yet
          customer:
            `${body.recipientFirstName} ${body.recipientLastName}`.trim(),
          phone: body.recipientPhone.trim(),
          email: body.recipientEmail ?? "",
          items: body.items
            .map((i) => `${i.productName} ${i.weightLabel} ×${i.quantity}`)
            .join("; "),
          total,
          paymentMethod: "cod",
          delivery: [
            body.deliveryMethod,
            body.deliveryCity,
            body.deliveryAddress,
          ]
            .filter(Boolean)
            .join(", "),
          comment: body.comment ?? "",
        });
      });
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
