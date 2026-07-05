/**
 * Adapters — map raw Sanity documents into the shapes our existing
 * components already expect (`Product` from `data/products.ts`,
 * `BrewGuide` from `data/brew-guides.ts`, etc.).
 *
 * Doing the transform here means the rendering side doesn't have to know
 * Sanity exists. When we later refactor components to be Sanity-native,
 * these adapters die — but for now they let us swap data sources without
 * touching dozens of files.
 *
 * Image strategy: components use the value as a CSS `background-image`,
 * which accepts both `radial-gradient(...)` strings and `url(...)`
 * strings. The adapters output `url(...)` for uploaded images so the
 * components don't branch.
 */

import type { BrewGuide } from "@/data/brew-guides";
import type { JournalBlock, JournalPost } from "@/data/journal";
import type {
  CategoryKey,
  GrindOption,
  Product,
  ProcessKind,
  RoastProfile,
} from "@/data/products";

interface SanityImage {
  url?: string;
  alt?: string;
}

/**
 * Best-effort image-or-gradient resolver.
 *   - If we have an uploaded Sanity image: emit `url(...)` so the CSS
 *     `background-image` declaration renders the photo.
 *   - Otherwise fall back to the editor-supplied gradient string.
 *   - Last resort: a neutral cream gradient so the layout never collapses.
 */
function imageOrGradient(
  image: SanityImage | undefined,
  fallbackGradient: string | undefined,
): string {
  if (image?.url) {
    return `url(${image.url})`;
  }
  if (fallbackGradient) return fallbackGradient;
  return "radial-gradient(ellipse at 50% 50%, #EFE5D2 0%, #C9A87B 70%, #6B4225 100%)";
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export interface SanityProduct {
  _id: string;
  name: string;
  slug: string;
  category: string;
  shortDescription: string;
  story?: string;
  badge?: string;
  inStock?: boolean;
  origin?: string;
  country?: string;
  region?: string;
  process?: string;
  altitude?: string;
  varietal?: string;
  farm?: string;
  harvest?: string;
  notes?: string[];
  meters?: { acidity: number; sweetness: number; bitterness: number };
  roasts?: string[];
  grinds?: string[];
  weights?: Array<{
    label: string;
    grams: number;
    price: number;
    wholesalePrice?: number;
  }>;
  brewing?: Array<{
    method: string;
    ratio?: string;
    grind?: string;
    waterTemp?: number;
    time?: string;
    tip?: string;
  }>;
  gallery?: SanityImage[];
  fallbackGradient?: string;
}

export function adaptProduct(s: SanityProduct): Product {
  // Resolve the rendering gallery — uploaded images first, gradient
  // fallback last. Components treat the result as a CSS background-image
  // value so the same array works for both.
  const galleryFromImages = (s.gallery ?? [])
    .map((g) => (g.url ? `url(${g.url})` : null))
    .filter((v): v is string => v !== null);
  const gallery: string[] =
    galleryFromImages.length > 0
      ? galleryFromImages
      : [
          s.fallbackGradient ??
            "radial-gradient(ellipse at 50% 50%, #EFE5D2 0%, #C9A87B 70%, #6B4225 100%)",
        ];

  return {
    slug: s.slug,
    name: s.name,
    category: s.category as CategoryKey,
    shortDescription: s.shortDescription,
    story: s.story ?? "",
    weights: s.weights ?? [],
    gallery,
    inStock: s.inStock ?? true,
    badge: s.badge as Product["badge"],
    origin: s.origin,
    country: s.country,
    region: s.region,
    process: s.process as ProcessKind | undefined,
    altitude: s.altitude,
    varietal: s.varietal,
    farm: s.farm,
    harvest: s.harvest,
    roasts: s.roasts as RoastProfile[] | undefined,
    notes: s.notes,
    meters: s.meters,
    grinds: s.grinds as GrindOption[] | undefined,
    brewing: s.brewing as Product["brewing"],
  };
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

export interface SanityBanner {
  _id: string;
  slug: string;
  kicker?: string;
  titleLine1: string;
  titleLine2?: string;
  copy?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  badge?: string;
  image?: SanityImage;
  markTint?: string;
  fallbackBg?: string;
}

/** Adapted banner — same shape the existing `HomeBanners` component uses,
 *  with `image` resolved to a URL string ready for `next/image`. */
export interface BannerView {
  slug: string;
  kicker: string;
  titleLine1: string;
  titleLine2: string;
  copy: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  badge?: string;
  image?: string; // URL only — components render via <Image>
  markTint: string;
  fallbackBg: string;
}

export function adaptBanner(s: SanityBanner): BannerView {
  return {
    slug: s.slug,
    kicker: s.kicker ?? "",
    titleLine1: s.titleLine1,
    titleLine2: s.titleLine2 ?? "",
    copy: s.copy ?? "",
    ctaLabel: s.ctaLabel ?? "",
    ctaHref: s.ctaHref ?? "/shop",
    secondaryLabel: s.secondaryLabel,
    secondaryHref: s.secondaryHref,
    badge: s.badge,
    image: s.image?.url,
    markTint: s.markTint ?? "#8A4A26",
    fallbackBg: s.fallbackBg ?? "#F5EAD9",
  };
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export interface SanityCategory {
  _id: string;
  title: string;
  href: string;
  gradient?: string;
  image?: SanityImage;
}

export interface CategoryView {
  slug: string;
  title: string;
  href: string;
  /** CSS background-image value — either a gradient or url(...) wrap. */
  gradient: string;
}

export function adaptCategory(s: SanityCategory): CategoryView {
  return {
    slug: s.href.replace(/[^a-z]/gi, "-").toLowerCase(),
    title: s.title,
    href: s.href,
    gradient: imageOrGradient(s.image, s.gradient),
  };
}

// ---------------------------------------------------------------------------
// Brew guide
// ---------------------------------------------------------------------------

export interface SanityBrewGuide {
  _id: string;
  name: string;
  slug: string;
  tagline: string;
  intro?: string;
  ratio?: string;
  grind?: string;
  waterTemp?: string;
  totalTime?: string;
  gradient?: string;
  image?: SanityImage;
  steps?: Array<{ time?: string; title: string; body: string }>;
  tips?: string[];
}

export function adaptBrewGuide(s: SanityBrewGuide): BrewGuide {
  return {
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    ratio: s.ratio ?? "",
    grind: s.grind ?? "",
    waterTemp: s.waterTemp ?? "",
    totalTime: s.totalTime ?? "",
    gradient: imageOrGradient(s.image, s.gradient),
    intro: s.intro ?? "",
    steps: s.steps ?? [],
    tips: s.tips ?? [],
  };
}

// ---------------------------------------------------------------------------
// Journal post
// ---------------------------------------------------------------------------

interface PortableTextBlock {
  _type: "block" | "image";
  _key?: string;
  style?: string;
  listItem?: string;
  children?: Array<{ _type: "span"; text: string; marks?: string[] }>;
  caption?: string;
  asset?: { url?: string };
}

export interface SanityJournalPost {
  _id: string;
  title: string;
  slug: string;
  category?: string;
  excerpt: string;
  publishedAt: string;
  readTime?: string;
  author?: string;
  coverImage?: SanityImage;
  coverGradient?: string;
  body?: PortableTextBlock[];
  related?: Array<{
    _id: string;
    title: string;
    slug: string;
    category?: string;
    excerpt?: string;
    publishedAt?: string;
    readTime?: string;
    coverImage?: SanityImage;
    coverGradient?: string;
  }>;
}

/**
 * Convert Portable Text (Sanity's rich-text blocks) back into the typed
 * `JournalBlock[]` our renderer consumes. The mapping is straightforward
 * for blocks with `style: "normal" | "h2" | "blockquote"` and for numbered
 * lists; images become our `image` block; everything else falls back to
 * a plain paragraph so we never silently drop content.
 */
function portableTextToBlocks(body: PortableTextBlock[]): JournalBlock[] {
  const out: JournalBlock[] = [];
  // Pending list aggregator — Portable Text list items are sibling blocks,
  // not nested. Coalesce consecutive numbered/bullet items into one list.
  let pendingList: string[] | null = null;
  const flushList = () => {
    if (pendingList && pendingList.length > 0) {
      out.push({ kind: "list", items: pendingList });
    }
    pendingList = null;
  };

  for (const block of body) {
    if (block._type === "image") {
      flushList();
      out.push({
        kind: "image",
        gradient:
          "radial-gradient(ellipse at 50% 45%, #C9935E 0%, #6B3A1E 55%, #2A1610 100%)",
        caption: block.caption,
      });
      continue;
    }
    if (block._type !== "block") continue;

    const text = (block.children ?? [])
      .map((c) => c.text ?? "")
      .join("");

    if (block.listItem) {
      pendingList ??= [];
      pendingList.push(text);
      continue;
    }
    flushList();

    if (block.style === "h2") {
      out.push({ kind: "h2", text });
    } else if (block.style === "blockquote") {
      // We don't carry an author across PT-blockquote, so just drop the
      // suffix shape the migrator wrote: "{quote} — {author}". If the
      // editor types a new quote without that pattern it stays as-is.
      const dashSplit = text.lastIndexOf(" — ");
      if (dashSplit > 0) {
        out.push({
          kind: "quote",
          text: text.slice(0, dashSplit),
          author: text.slice(dashSplit + 3),
        });
      } else {
        out.push({ kind: "quote", text });
      }
    } else {
      out.push({ kind: "p", text });
    }
  }
  flushList();
  return out;
}

export function adaptJournalPost(s: SanityJournalPost): JournalPost {
  return {
    slug: s.slug,
    title: s.title,
    category: s.category ?? "",
    excerpt: s.excerpt,
    publishedAt: s.publishedAt,
    date: new Date(s.publishedAt).toLocaleDateString("uk-UA", {
      year: "numeric",
      month: "long",
    }),
    readTime: s.readTime ?? "",
    author: s.author ?? "",
    gradient: imageOrGradient(s.coverImage, s.coverGradient),
    body: portableTextToBlocks(s.body ?? []),
    related: s.related?.map((r) => r.slug),
  };
}

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

export interface SanitySiteSettings {
  title?: string;
  description?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  hours?: string;
  instagram?: string;
  telegram?: string;
  facebook?: string;
  promoBarText?: string;
  logoBlack?: SanityImage;
  logoWhite?: SanityImage;
}

export interface SiteSettingsView {
  title: string;
  description: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  hours: string;
  instagram?: string;
  telegram?: string;
  facebook?: string;
  promoBarText?: string;
  logoBlackUrl?: string;
  logoWhiteUrl?: string;
}

export function adaptSiteSettings(
  s: SanitySiteSettings | null,
): SiteSettingsView {
  return {
    title: s?.title ?? "BATCH Coffee Roastery",
    description:
      s?.description ??
      "Свіжообсмажена спешиалті кава. Підписка, доставка по Україні.",
    contactPhone: s?.contactPhone ?? "+380 50 070 0041",
    contactEmail: s?.contactEmail ?? "hello@batch.coffee",
    address: s?.address ?? "Полтава, вул. Соборності, 27",
    hours: s?.hours ?? "Пн–Нд · 08:00–20:00",
    instagram: s?.instagram,
    telegram: s?.telegram,
    facebook: s?.facebook,
    promoBarText: s?.promoBarText,
    logoBlackUrl: s?.logoBlack?.url,
    logoWhiteUrl: s?.logoWhite?.url,
  };
}
