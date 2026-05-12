/**
 * Mock account data — used while the real Supabase backend is not yet wired
 * up. Functions are exported (rather than constants) so the shape stays
 * compatible with the future `getOrders(userId)` etc. server actions — the
 * call sites won't change when we swap implementations.
 *
 * Everything below intentionally references real product slugs from
 * `data/products.ts` so the cart preview thumbs / order items render the
 * same gradients as live SKUs.
 */

export type OrderStatus =
  | "pending" // оплата очікується
  | "paid" // оплачене, ще не пакують
  | "packing" // пакується
  | "shipped" // відправлено
  | "delivered" // отримано
  | "cancelled";

export interface MockOrderItem {
  slug: string;
  name: string;
  /** Gallery gradient — same as on the card / drawer / fly layer. */
  thumb: string;
  weightLabel: string;
  roast?: string;
  quantity: number;
  unitPrice: number;
}

export interface MockOrder {
  id: string;
  number: string;
  createdAt: string; // ISO
  status: OrderStatus;
  total: number;
  items: MockOrderItem[];
  deliveryMethod: "Нова Пошта" | "Самовивіз" | "Укрпошта";
  deliveryAddress: string;
  trackingNumber?: string;
}

export interface MockAddress {
  id: string;
  label: "Дім" | "Робота" | "Інше";
  recipient: string;
  phone: string;
  city: string;
  /** Nova Poshta branch / postomat / street address. */
  destination: string;
  isDefault?: boolean;
}

export interface MockSubscription {
  id: string;
  productSlug: string;
  productName: string;
  thumb: string;
  weightLabel: string;
  roast?: string;
  /** Days between deliveries. */
  intervalDays: number;
  /** Next billing / shipment date (ISO). */
  nextDate: string;
  status: "active" | "paused" | "cancelled";
  pricePerCycle: number;
  /** Total months the subscription has been active — drives loyalty visuals. */
  cyclesShipped: number;
}

// ---------------------------------------------------------------------------
// Demo data — three sample orders covering active / shipped / delivered to
// exercise all status pills in the orders list UI.
// ---------------------------------------------------------------------------

const ORDERS: MockOrder[] = [
  {
    id: "ord-2026-0142",
    number: "BAT-0142",
    createdAt: "2026-05-08T09:23:00.000Z",
    status: "packing",
    total: 1180,
    items: [
      {
        slug: "ethiopia-sidamo",
        name: "Ефіопія Сідамо",
        thumb:
          "radial-gradient(ellipse at 35% 35%, #E8B888 0%, #B46A3D 55%, #6B3A1E 100%)",
        weightLabel: "250 г",
        roast: "Фільтр",
        quantity: 2,
        unitPrice: 420,
      },
      {
        slug: "drip-house-blend",
        name: "Дріп · House Blend",
        thumb:
          "radial-gradient(ellipse at 50% 45%, #A87B58 0%, #5A3A24 65%, #241410 100%)",
        weightLabel: "6 шт",
        quantity: 1,
        unitPrice: 240,
      },
    ],
    deliveryMethod: "Нова Пошта",
    deliveryAddress: "Київ, відділення №47, вул. Хрещатик 22",
  },
  {
    id: "ord-2026-0131",
    number: "BAT-0131",
    createdAt: "2026-04-26T15:11:00.000Z",
    status: "shipped",
    total: 790,
    items: [
      {
        slug: "colombia-huila",
        name: "Колумбія Уїла",
        thumb:
          "radial-gradient(ellipse at 55% 50%, #C9935E 0%, #7A4A2A 60%, #3D2416 100%)",
        weightLabel: "500 г",
        roast: "Еспресо",
        quantity: 1,
        unitPrice: 730,
      },
    ],
    deliveryMethod: "Нова Пошта",
    deliveryAddress: "Львів, поштомат №312",
    trackingNumber: "20451235789014",
  },
  {
    id: "ord-2026-0118",
    number: "BAT-0118",
    createdAt: "2026-04-12T11:02:00.000Z",
    status: "delivered",
    total: 1490,
    items: [
      {
        slug: "ethiopia-sidamo",
        name: "Ефіопія Сідамо",
        thumb:
          "radial-gradient(ellipse at 35% 35%, #E8B888 0%, #B46A3D 55%, #6B3A1E 100%)",
        weightLabel: "1 кг",
        roast: "Фільтр",
        quantity: 1,
        unitPrice: 1490,
      },
    ],
    deliveryMethod: "Нова Пошта",
    deliveryAddress: "Київ, відділення №47, вул. Хрещатик 22",
    trackingNumber: "20451235712347",
  },
];

const ADDRESSES: MockAddress[] = [
  {
    id: "addr-1",
    label: "Дім",
    recipient: "Влад Кругляк",
    phone: "+380 50 123 45 67",
    city: "Київ",
    destination: "вул. Хрещатик 22, відділення №47",
    isDefault: true,
  },
  {
    id: "addr-2",
    label: "Робота",
    recipient: "Влад Кругляк",
    phone: "+380 50 123 45 67",
    city: "Київ",
    destination: "Поштомат №118, ТРЦ Gulliver",
  },
];

const SUBSCRIPTION: MockSubscription = {
  id: "sub-1",
  productSlug: "colombia-huila",
  productName: "Колумбія Уїла",
  thumb:
    "radial-gradient(ellipse at 55% 50%, #C9935E 0%, #7A4A2A 60%, #3D2416 100%)",
  weightLabel: "500 г",
  roast: "Еспресо",
  intervalDays: 14,
  nextDate: "2026-05-22T09:00:00.000Z",
  status: "active",
  pricePerCycle: 730,
  cyclesShipped: 4,
};

// ---------------------------------------------------------------------------
// Public API — keep the function names matching what server actions will be
// once we wire Supabase. `userId` is accepted but ignored in mock-mode.
// ---------------------------------------------------------------------------

export function getMockOrders(): MockOrder[] {
  // Return a clone so callers mutating their state can't mess with the
  // module-scope array.
  return ORDERS.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) }));
}

export function getMockOrder(id: string): MockOrder | null {
  const order = ORDERS.find((o) => o.id === id);
  return order
    ? { ...order, items: order.items.map((i) => ({ ...i })) }
    : null;
}

export function getMockAddresses(): MockAddress[] {
  return ADDRESSES.map((a) => ({ ...a }));
}

export function getMockSubscription(): MockSubscription | null {
  return { ...SUBSCRIPTION };
}

/** Localised label for an order status. UI maps colour separately. */
export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "Очікує оплати";
    case "paid":
      return "Оплачено";
    case "packing":
      return "Пакується";
    case "shipped":
      return "В дорозі";
    case "delivered":
      return "Отримано";
    case "cancelled":
      return "Скасовано";
  }
}

/** Group colour for the status pill — pure Tailwind class strings so the UI
 *  can `className={statusTone(status)}` directly. */
export function statusTone(status: OrderStatus): string {
  switch (status) {
    case "delivered":
      return "bg-emerald-100 text-emerald-800";
    case "shipped":
    case "packing":
      return "bg-amber-100 text-amber-900";
    case "paid":
      return "bg-sky-100 text-sky-800";
    case "pending":
      return "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]";
    case "cancelled":
      return "bg-rose-100 text-rose-800";
  }
}
