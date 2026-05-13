/**
 * Shipping constants — single source of truth.
 *
 * Bumping the free-shipping threshold here updates the cart, the checkout
 * summary, the cart drawer nudge, the /delivery info page, and the FAQ
 * answer in one place. (Free helper texts in markdown blocks still need
 * a hand edit, but those are content not logic.)
 */
export const FREE_SHIPPING_THRESHOLD = 3500;

/** Flat carrier rate when the order is below the threshold. */
export const DELIVERY_BASE = 80;
