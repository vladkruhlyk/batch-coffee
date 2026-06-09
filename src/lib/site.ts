/**
 * Canonical public site URL — single source of truth for SEO (metadata,
 * JSON-LD, robots, sitemap) AND the WayForPay return/service URLs.
 *
 * Previously robots/sitemap/JSON-LD hardcoded the Vercel preview domain
 * while layout.tsx used `batch.coffee`, producing conflicting canonical
 * URLs. Now everything derives from NEXT_PUBLIC_SITE_URL. Set it in Vercel
 * to the real domain (https://batch.coffee) when DNS is live; until then
 * it falls back to the current deploy URL.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://batch-coffee.vercel.app"
).replace(/\/+$/, "");
