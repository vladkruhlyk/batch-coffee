"use client";

import { Search } from "lucide-react";
import { useSearch } from "@/lib/search-store";

/**
 * Header search trigger. Purely a thin wrapper around `useSearch.openSearch`
 * so the header can stay stateless.
 */
export function SearchButton() {
  const openSearch = useSearch((s) => s.openSearch);
  return (
    <button
      type="button"
      aria-label="Пошук"
      onClick={openSearch}
      className="p-2 hover:opacity-60 transition-opacity duration-300"
    >
      <Search className="w-5 h-5" strokeWidth={1.5} />
    </button>
  );
}
