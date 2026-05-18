import "server-only";
import { createSupabaseAdminClient } from "./supabase/server";
import type { OrderWithItems } from "./orders";

/**
 * Server-only order helpers that need the service-role key.
 *
 * Kept in a separate module from `orders.ts` so that file can stay
 * safe to import from client components — the moment we'd bring
 * `createSupabaseAdminClient` into that file, anything client-side
 * importing from it would pull in `next/headers` and break.
 *
 * `import "server-only"` at the top is a Next.js convention: it
 * throws at build time if a client component tries to import this
 * module, so the boundary is enforced.
 */

interface OrderRow {
  id: string;
  number: string;
  user_id: string | null;
  status: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  delivery_method: string;
  delivery_address: string;
  delivery_city: string | null;
  payment_method: string;
  recipient_first_name: string;
  recipient_last_name: string;
  recipient_phone: string;
  recipient_email: string | null;
  comment: string | null;
  internal_note: string | null;
  tracking_number: string | null;
  view_token: string;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: string;
  product_slug: string;
  product_name: string;
  thumb: string | null;
  weight_label: string;
  weight_grams: number;
  roast: string | null;
  grind: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

/** Fetch an order + its items by id, bypassing RLS. Used by the
 *  payment-init route which needs to compute the WayForPay total
 *  from the authoritative DB value rather than trust the client. */
export async function getOrderByIdAdmin(
  id: string,
): Promise<OrderWithItems | null> {
  const supabase = createSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: true });
  if (itemsErr) throw itemsErr;

  const row = order as OrderRow;
  return {
    id: row.id,
    number: row.number,
    userId: row.user_id,
    status: row.status as OrderWithItems["status"],
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    discount: row.discount,
    total: row.total,
    deliveryMethod: row.delivery_method as OrderWithItems["deliveryMethod"],
    deliveryAddress: row.delivery_address,
    deliveryCity: row.delivery_city,
    paymentMethod: row.payment_method as OrderWithItems["paymentMethod"],
    recipientFirstName: row.recipient_first_name,
    recipientLastName: row.recipient_last_name,
    recipientPhone: row.recipient_phone,
    recipientEmail: row.recipient_email,
    comment: row.comment,
    internalNote: row.internal_note,
    trackingNumber: row.tracking_number,
    viewToken: row.view_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (items as OrderItemRow[]).map((i) => ({
      id: i.id,
      productSlug: i.product_slug,
      productName: i.product_name,
      thumb: i.thumb,
      weightLabel: i.weight_label,
      weightGrams: i.weight_grams,
      roast: i.roast,
      grind: i.grind,
      unitPrice: i.unit_price,
      quantity: i.quantity,
      lineTotal: i.line_total,
    })),
  };
}
