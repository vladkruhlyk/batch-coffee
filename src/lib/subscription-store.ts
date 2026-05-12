import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Subscription store — single active subscription per user (mock-mode).
 *
 * The store mirrors the future Supabase `subscriptions` row shape. When we
 * hook up the backend the actions become Supabase mutations and `current`
 * becomes a React-Query fetch; UI components reading `useSubscription()`
 * stay the same.
 *
 * Today: one subscription max, persisted in localStorage. The
 * `/subscription/setup` route writes here; `/account/subscriptions` reads.
 */

export interface Subscription {
  id: string;
  productSlug: string;
  productName: string;
  thumb: string;
  weightLabel: string;
  weightGrams: number;
  roast?: string;
  /** Days between deliveries. */
  intervalDays: number;
  /** Quantity per delivery (number of weighted packs). */
  quantity: number;
  /** Price per single delivery (= unitPrice × quantity with subscription discount). */
  pricePerCycle: number;
  /** ISO date of next billing. */
  nextDate: string;
  status: "active" | "paused" | "cancelled";
  /** ISO date the subscription was first created. */
  createdAt: string;
  cyclesShipped: number;
}

interface SubscriptionState {
  current: Subscription | null;
  hydrated: boolean;

  /** Subscribe — replaces any existing subscription. (Mock: only one allowed.) */
  subscribe: (input: SubscribeInput) => Subscription;
  /** Apply a partial update. */
  update: (patch: Partial<Subscription>) => void;
  /** Pause / resume — flips status, keeps everything else. */
  togglePause: () => void;
  /** Hard cancel — sets status, doesn't delete (so the user sees history). */
  cancel: () => void;
  /** Remove entirely — used when the user resubscribes after a cancel. */
  reset: () => void;
}

export interface SubscribeInput {
  productSlug: string;
  productName: string;
  thumb: string;
  weightLabel: string;
  weightGrams: number;
  roast?: string;
  intervalDays: number;
  quantity: number;
  unitPrice: number;
}

/** Subscription discount applied to every cycle vs one-off purchase price. */
export const SUBSCRIPTION_DISCOUNT_PERCENT = 15;

function applyDiscount(unitPrice: number, quantity: number): number {
  const total = unitPrice * quantity;
  return Math.round(total * (1 - SUBSCRIPTION_DISCOUNT_PERCENT / 100));
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const useSubscription = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      current: null,
      hydrated: false,

      subscribe: (input) => {
        const now = new Date();
        const sub: Subscription = {
          id: `sub-${Date.now()}`,
          productSlug: input.productSlug,
          productName: input.productName,
          thumb: input.thumb,
          weightLabel: input.weightLabel,
          weightGrams: input.weightGrams,
          roast: input.roast,
          intervalDays: input.intervalDays,
          quantity: input.quantity,
          pricePerCycle: applyDiscount(input.unitPrice, input.quantity),
          nextDate: addDays(now.toISOString(), input.intervalDays),
          status: "active",
          createdAt: now.toISOString(),
          cyclesShipped: 0,
        };
        set({ current: sub });
        return sub;
      },

      update: (patch) => {
        const cur = get().current;
        if (!cur) return;
        set({ current: { ...cur, ...patch } });
      },

      togglePause: () => {
        const cur = get().current;
        if (!cur) return;
        set({
          current: {
            ...cur,
            status: cur.status === "paused" ? "active" : "paused",
          },
        });
      },

      cancel: () => {
        const cur = get().current;
        if (!cur) return;
        set({ current: { ...cur, status: "cancelled" } });
      },

      reset: () => set({ current: null }),
    }),
    {
      name: "batch-subscription",
      partialize: (s) => ({ current: s.current }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
