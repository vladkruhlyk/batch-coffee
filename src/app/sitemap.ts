import type { MetadataRoute } from "next";
import {
  fetchBrewGuides,
  fetchJournalPosts,
  fetchProducts,
} from "@/sanity/lib/fetchers";
import { SITE_URL } from "@/lib/site";

/**
 * sitemap.xml — auto-generated. Next.js serves this from `/sitemap.xml`.
 *
 * Static routes are hand-rolled (they live in the file tree). Dynamic
 * routes (products, brew guides, journal posts) are fetched from Sanity
 * so new content surfaces in search without redeployments.
 *
 * Priorities are coarse heuristics — Google barely uses them, but they
 * still telegraph what we consider important to crawlers.
 */
const BASE_URL = SITE_URL;

const STATIC_ROUTES: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1.0, freq: "weekly" },
  { path: "/shop", priority: 0.9, freq: "daily" },
  { path: "/subscription", priority: 0.8, freq: "weekly" },
  { path: "/subscription/setup", priority: 0.6, freq: "monthly" },
  { path: "/brew-guide", priority: 0.7, freq: "monthly" },
  { path: "/journal", priority: 0.6, freq: "weekly" },
  { path: "/about", priority: 0.5, freq: "monthly" },
  { path: "/visit", priority: 0.5, freq: "monthly" },
  { path: "/contacts", priority: 0.5, freq: "monthly" },
  { path: "/delivery", priority: 0.4, freq: "monthly" },
  { path: "/faq", priority: 0.4, freq: "monthly" },
  { path: "/compare", priority: 0.3, freq: "monthly" },
  { path: "/login", priority: 0.2, freq: "yearly" },
  { path: "/privacy", priority: 0.1, freq: "yearly" },
  { path: "/terms", priority: 0.1, freq: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Parallel — these don't depend on each other.
  const [products, brewGuides, journalPosts] = await Promise.all([
    fetchProducts(),
    fetchBrewGuides(),
    fetchJournalPosts(),
  ]);

  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/shop/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const brewEntries: MetadataRoute.Sitemap = brewGuides.map((g) => ({
    url: `${BASE_URL}/brew-guide/${g.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const journalEntries: MetadataRoute.Sitemap = journalPosts.map((p) => ({
    url: `${BASE_URL}/journal/${p.slug}`,
    lastModified: p.publishedAt ? new Date(p.publishedAt) : now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...productEntries,
    ...brewEntries,
    ...journalEntries,
  ];
}
