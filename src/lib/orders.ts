import { createSupabaseBrowserClient } from "./supabase/client";

/**
 * Orders module — typed access to the `orders` + `order_items` tables.
 *
 * RLS gates every query:
 *   - Customers see their own orders only.
 *   - Admins (profiles.is_admin = true) see every row, can also update
 *     status + tracking number.
 *
 * The DB speaks snake_case; we translate at the boundary so the UI
 * never sees row column names. Money fields are stored as integer
 * cents — same convention as the rest of the app.
 */

export type OrderStatus =
  | "pending"
  | "paid"
  | "packing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type DeliveryMethod =
  | "novaposhta-branch"
  | "novaposhta-postomat"
  | "pickup";

export type PaymentMethod = "card" | "cod";

export interface OrderItem {
  id: string;
  productSlug: string;
  productName: string;
  thumb: string | null;
  weightLabel: string;
  weightGrams: number;
  roast: string | null;
  grind: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  number: string;
  userId: string | null;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string;
  deliveryCity: string | null;
  paymentMethod: PaymentMethod;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  recipientEmail: string | null;
  comment: string | null;
  /** Staff-only note — never shown to the customer. */
  internalNote: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusEvent {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string | null;
  note: string | null;
  createdAt: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

// ---------------------------------------------------------------------------
// Row adapters
// ---------------------------------------------------------------------------

interface OrderRow {
  id: string;
  number: string;
  user_id: string | null;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  delivery_method: DeliveryMethod;
  delivery_address: string;
  delivery_city: string | null;
  payment_method: PaymentMethod;
  recipient_first_name: string;
  recipient_last_name: string;
  recipient_phone: string;
  recipient_email: string | null;
  comment: string | null;
  internal_note: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderStatusEventRow {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
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

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    number: row.number,
    userId: row.user_id,
    status: row.status,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    discount: row.discount,
    total: row.total,
    deliveryMethod: row.delivery_method,
    deliveryAddress: row.delivery_address,
    deliveryCity: row.delivery_city,
    paymentMethod: row.payment_method,
    recipientFirstName: row.recipient_first_name,
    recipientLastName: row.recipient_last_name,
    recipientPhone: row.recipient_phone,
    recipientEmail: row.recipient_email,
    comment: row.comment,
    internalNote: row.internal_note,
    trackingNumber: row.tracking_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToStatusEvent(row: OrderStatusEventRow): OrderStatusEvent {
  return {
    id: row.id,
    orderId: row.order_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedBy: row.changed_by,
    note: row.note,
    createdAt: row.created_at,
  };
}

function rowToItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    productSlug: row.product_slug,
    productName: row.product_name,
    thumb: row.thumb,
    weightLabel: row.weight_label,
    weightGrams: row.weight_grams,
    roast: row.roast,
    grind: row.grind,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    lineTotal: row.line_total,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type OrderSortField = "created_at" | "total";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateOrderInput {
  /** UUID of the customer placing the order. Null for guest checkout. */
  userId: string | null;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  recipientEmail: string | null;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string;
  deliveryCity: string | null;
  paymentMethod: PaymentMethod;
  comment: string | null;
  deliveryFee: number;
  discount?: number;
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
}

/** Create a new order plus its line items. Returns the freshly-minted
 *  BAT-NNNN number so callers can redirect to /order/[number].
 *
 *  Done as two sequential inserts rather than a Postgres RPC for
 *  simplicity — if the items insert fails after the header lands, we
 *  surface the error to the caller; the orphan header is rare enough
 *  to clean up by hand from /admin if it ever happens. When we adopt
 *  paid-checkout we'll move this server-side anyway. */
export async function createOrder(
  input: CreateOrderInput,
): Promise<{ id: string; number: string }> {
  const subtotal = input.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );
  const discount = input.discount ?? 0;
  const total = subtotal + input.deliveryFee - discount;

  const supabase = createSupabaseBrowserClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: input.userId,
      subtotal,
      delivery_fee: input.deliveryFee,
      discount,
      total,
      delivery_method: input.deliveryMethod,
      delivery_address: input.deliveryAddress,
      delivery_city: input.deliveryCity,
      payment_method: input.paymentMethod,
      recipient_first_name: input.recipientFirstName,
      recipient_last_name: input.recipientLastName,
      recipient_phone: input.recipientPhone,
      recipient_email: input.recipientEmail,
      comment: input.comment,
    })
    .select("id, number")
    .single();
  if (orderErr || !order) {
    throw orderErr ?? new Error("Failed to create order");
  }

  const itemsPayload = input.items.map((i) => ({
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
  if (itemsErr) throw itemsErr;

  return { id: order.id, number: order.number as string };
}

/** Look up an order by its public BAT-NNNN number (returns null if RLS
 *  hides it — wrong user, doesn't exist, etc). */
export async function getOrderByNumber(
  number: string,
): Promise<OrderWithItems | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("number", number)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", (data as OrderRow).id)
    .order("created_at", { ascending: true });
  if (itemsErr) throw itemsErr;
  return {
    ...rowToOrder(data as OrderRow),
    items: (items as OrderItemRow[]).map(rowToItem),
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** List orders — newest first by default. Optional status filter,
 *  number search, custom sort. When called by a regular user RLS
 *  narrows the result to their own orders; admins see everything. */
export async function listOrders(opts?: {
  status?: OrderStatus | null;
  search?: string;
  sortBy?: OrderSortField;
  sortDir?: "asc" | "desc";
  /** Limit + offset for cheap pagination on the dashboard. */
  limit?: number;
}): Promise<Order[]> {
  const supabase = createSupabaseBrowserClient();
  const sortField = opts?.sortBy ?? "created_at";
  const ascending = opts?.sortDir === "asc";
  let q = supabase
    .from("orders")
    .select("*")
    .order(sortField, { ascending });
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.search) {
    // Case-insensitive substring match on the human-readable number.
    q = q.ilike("number", `%${opts.search}%`);
  }
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data as OrderRow[]).map(rowToOrder);
}

/** List orders owned by a specific user — admin-only path used by the
 *  customer detail page. Regular users hit the unfiltered `listOrders`
 *  and RLS does the narrowing for them. */
export async function listOrdersForUser(userId: string): Promise<Order[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as OrderRow[]).map(rowToOrder);
}

/** Fetch one order with its line items. Returns null if not found OR
 *  RLS hides it (admin lookup misuse, deleted row, etc). */
export async function getOrderWithItems(
  id: string,
): Promise<OrderWithItems | null> {
  const supabase = createSupabaseBrowserClient();
  const [orderRes, itemsRes] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (orderRes.error) throw orderRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (!orderRes.data) return null;
  return {
    ...rowToOrder(orderRes.data as OrderRow),
    items: (itemsRes.data as OrderItemRow[]).map(rowToItem),
  };
}

/** Admin-only — change the order status. RLS rejects this for regular
 *  customers, so no extra guard is needed here. */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

/** Admin-only — set the Nova Poshta tracking number (or clear it). */
export async function updateOrderTracking(
  id: string,
  trackingNumber: string | null,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("orders")
    .update({ tracking_number: trackingNumber || null })
    .eq("id", id);
  if (error) throw error;
}

/** Admin-only — internal staff note. Empty string clears the field. */
export async function updateOrderInternalNote(
  id: string,
  note: string | null,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("orders")
    .update({ internal_note: note?.trim() || null })
    .eq("id", id);
  if (error) throw error;
}

/** Chronological status history for one order. Older events first
 *  so the UI can render top-to-bottom timelines without reversing. */
export async function listOrderStatusEvents(
  orderId: string,
): Promise<OrderStatusEvent[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("order_status_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as OrderStatusEventRow[]).map(rowToStatusEvent);
}

// ---------------------------------------------------------------------------
// UI helpers — shared between the customer and admin orders views.
// ---------------------------------------------------------------------------

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "Очікує оплату";
    case "paid":
      return "Оплачено";
    case "packing":
      return "Пакується";
    case "shipped":
      return "Відправлено";
    case "delivered":
      return "Доставлено";
    case "cancelled":
      return "Скасовано";
  }
}

/** Tailwind class triples used for the status pill — bg, text, dot.
 *  Kept close to the rest of the brand palette while still being
 *  distinguishable at a glance. */
export function statusTone(status: OrderStatus): {
  bg: string;
  text: string;
} {
  switch (status) {
    case "pending":
      return { bg: "bg-amber-100", text: "text-amber-800" };
    case "paid":
      return { bg: "bg-sky-100", text: "text-sky-800" };
    case "packing":
      return { bg: "bg-violet-100", text: "text-violet-800" };
    case "shipped":
      return { bg: "bg-indigo-100", text: "text-indigo-800" };
    case "delivered":
      return { bg: "bg-emerald-100", text: "text-emerald-800" };
    case "cancelled":
      return { bg: "bg-rose-100", text: "text-rose-800" };
  }
}

export function deliveryMethodLabel(method: DeliveryMethod): string {
  switch (method) {
    case "novaposhta-branch":
      return "Нова Пошта — відділення";
    case "novaposhta-postomat":
      return "Нова Пошта — поштомат";
    case "pickup":
      return "Самовивіз";
  }
}

export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case "card":
      return "Картка";
    case "cod":
      return "При отриманні";
  }
}

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
];
