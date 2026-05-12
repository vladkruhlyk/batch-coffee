import { create } from "zustand";

/**
 * Tiny store for the "ghost flies into cart" effect that fires on add.
 *
 * Lives separately from the main cart store so the cart's data model stays
 * pure (items / open / count) and animations remain UI-only state. The
 * `CartFlyLayer` component subscribes here, spawns a motion ghost from
 * `source` toward the cart icon, then calls `clear()` on completion.
 *
 * `id` increments per trigger — use it as a React key so the layer remounts
 * each time and replays the animation even when source/thumb are identical.
 */
export interface FlyPayload {
  id: number;
  /** Source bounding rect in viewport coords — captured from the click. */
  source: { x: number; y: number; width: number; height: number };
  /** CSS background-image value (gradient or url(...)) used for the ghost. */
  thumb: string;
}

interface CartFlyState {
  pending: FlyPayload | null;
  trigger: (payload: Omit<FlyPayload, "id">) => void;
  clear: () => void;
}

let counter = 0;

export const useCartFly = create<CartFlyState>((set) => ({
  pending: null,
  trigger: (payload) =>
    set({
      pending: { ...payload, id: ++counter },
    }),
  clear: () => set({ pending: null }),
}));
