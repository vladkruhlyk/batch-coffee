import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * robots.txt — served by Next at `/robots.txt`.
 *
 * Strategy:
 *   - Allow everything by default
 *   - Disallow Studio (CMS admin), account dashboard, login, checkout,
 *     order success page, and API endpoints — none of these should turn
 *     up in Google
 *   - Point crawlers at the sitemap
 */
export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/studio",
          "/studio/",
          "/account",
          "/account/",
          "/login",
          "/checkout",
          "/order/",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
