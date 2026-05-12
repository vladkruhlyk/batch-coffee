/**
 * Server-side fetchers — wrap Sanity GROQ queries and map raw documents
 * through adapters so callers get typed view models.
 *
 * Caching: Next.js caches `client.fetch()` results by default. Pages
 * import these fetchers in server components and pair them with
 * `export const revalidate = N` (or rely on tag-based revalidation
 * triggered by the webhook in `app/api/revalidate`).
 */

import { client } from "./client";
import {
  adaptBanner,
  adaptBrewGuide,
  adaptCategory,
  adaptJournalPost,
  adaptProduct,
  adaptSiteSettings,
  type SanityBanner,
  type SanityBrewGuide,
  type SanityCategory,
  type SanityJournalPost,
  type SanityProduct,
  type SanitySiteSettings,
} from "./adapters";
import {
  BANNERS_QUERY,
  BREW_GUIDES_QUERY,
  BREW_GUIDE_BY_SLUG_QUERY,
  CATEGORIES_QUERY,
  JOURNAL_POSTS_QUERY,
  JOURNAL_POST_BY_SLUG_QUERY,
  PRODUCTS_QUERY,
  PRODUCT_BY_SLUG_QUERY,
  SITE_SETTINGS_QUERY,
} from "../queries";

/** Tag the fetch with a Next.js cache tag so the on-demand revalidate
 *  webhook can target exactly this slice of content rather than nuke
 *  everything. */
const tags = (tag: string) => ({ next: { tags: [tag], revalidate: 60 } });

export async function fetchProducts() {
  const raw = await client.fetch<SanityProduct[]>(
    PRODUCTS_QUERY,
    {},
    tags("product"),
  );
  return raw.map(adaptProduct);
}

export async function fetchProductBySlug(slug: string) {
  const raw = await client.fetch<SanityProduct | null>(
    PRODUCT_BY_SLUG_QUERY,
    { slug },
    tags(`product:${slug}`),
  );
  return raw ? adaptProduct(raw) : null;
}

export async function fetchBanners() {
  const raw = await client.fetch<SanityBanner[]>(
    BANNERS_QUERY,
    {},
    tags("banner"),
  );
  return raw.map(adaptBanner);
}

export async function fetchCategories() {
  const raw = await client.fetch<SanityCategory[]>(
    CATEGORIES_QUERY,
    {},
    tags("category"),
  );
  return raw.map(adaptCategory);
}

export async function fetchBrewGuides() {
  const raw = await client.fetch<SanityBrewGuide[]>(
    BREW_GUIDES_QUERY,
    {},
    tags("brewGuide"),
  );
  return raw.map(adaptBrewGuide);
}

export async function fetchBrewGuideBySlug(slug: string) {
  const raw = await client.fetch<SanityBrewGuide | null>(
    BREW_GUIDE_BY_SLUG_QUERY,
    { slug },
    tags(`brewGuide:${slug}`),
  );
  return raw ? adaptBrewGuide(raw) : null;
}

export async function fetchJournalPosts() {
  const raw = await client.fetch<SanityJournalPost[]>(
    JOURNAL_POSTS_QUERY,
    {},
    tags("journalPost"),
  );
  return raw.map(adaptJournalPost);
}

export async function fetchJournalPostBySlug(slug: string) {
  const raw = await client.fetch<SanityJournalPost | null>(
    JOURNAL_POST_BY_SLUG_QUERY,
    { slug },
    tags(`journalPost:${slug}`),
  );
  return raw ? adaptJournalPost(raw) : null;
}

export async function fetchSiteSettings() {
  const raw = await client.fetch<SanitySiteSettings | null>(
    SITE_SETTINGS_QUERY,
    {},
    tags("siteSettings"),
  );
  return adaptSiteSettings(raw);
}
