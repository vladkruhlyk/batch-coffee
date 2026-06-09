import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../env";

/**
 * Read-only Sanity client — shared across server and client.
 *
 * `useCdn: true` routes reads through Sanity's edge CDN: cached, fast,
 * eventual-consistency. Perfect for product pages where staleness of a
 * few minutes is fine. For fresh content (e.g. preview mode) we'll
 * disable CDN in a separate `previewClient`.
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
});

/**
 * CDN-bypassing client for MONEY paths (order pricing, promo charge
 * validation). Sanity's CDN caches responses for minutes regardless of
 * Next.js `revalidate` options — fine for product pages, NOT fine when
 * computing what to charge: a just-raised price could bill at the stale
 * CDN value. `useCdn: false` hits the live API directly.
 */
export const freshClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  perspective: "published",
});
