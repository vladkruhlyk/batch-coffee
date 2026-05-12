import { create } from "zustand";

/**
 * Ultra-thin Zustand store for the global search overlay. Lets any component
 * (header button, Cmd+K keybinding, empty-cart CTA, etc.) open the overlay
 * without prop drilling.
 */
interface SearchState {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

export const useSearch = create<SearchState>((set) => ({
  open: false,
  openSearch: () => set({ open: true }),
  closeSearch: () => set({ open: false }),
  toggleSearch: () => set((s) => ({ open: !s.open })),
}));
