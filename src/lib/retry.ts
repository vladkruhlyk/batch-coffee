/**
 * Retry an async operation a few times with linear backoff.
 *
 * For transient network blips ("TypeError: fetch failed", 5xx) on
 * critical paths — order pricing and promo resolution now hit a live
 * (uncached) Sanity API on every checkout, so a single hiccup there must
 * not fail the customer's order. Three quick attempts absorb almost all
 * transient failures; a persistent outage still surfaces (caller decides
 * how to handle).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 250,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}
