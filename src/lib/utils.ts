import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose Tailwind class names with conflict resolution.
 * `cn('px-4 py-2', condition && 'bg-red-500', 'py-4')` → 'px-4 bg-red-500 py-4'
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format UAH price. Deterministic (no Intl locale drift between server/client).
 * 1234 → "1 234 ₴"
 */
export function formatPrice(value: number): string {
  const rounded = Math.round(value);
  // Group thousands with thin non-breaking space (U+202F).
  const grouped = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  return `${grouped}\u00A0₴`;
}
