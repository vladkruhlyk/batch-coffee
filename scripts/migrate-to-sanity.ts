/**
 * One-off migration script: reads our existing `data/*.ts` mocks and pushes
 * the records into Sanity as `_type` documents.
 *
 * Run with: `npx tsx scripts/migrate-to-sanity.ts`
 *
 * Idempotent — each document is created with a deterministic `_id` derived
 * from its slug, so re-running overwrites (via `createOrReplace`) rather
 * than duplicating. Safe to run multiple times while iterating on schemas.
 *
 * After migration:
 *   - Open /studio in the running app
 *   - You should see 13 products, 3 banners, 8 categories, 6 brew guides,
 *     3 journal posts already populated.
 *   - Edit anything → site picks it up on next ISR revalidation.
 */

/* eslint-disable no-console */
import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { PRODUCTS } from "../src/data/products";
import { BREW_GUIDES } from "../src/data/brew-guides";
import { JOURNAL_POSTS } from "../src/data/journal";

// .env.local isn't auto-loaded for plain scripts. Pull it in explicitly.
loadEnv({ path: ".env.local" });

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2024-11-01",
  token: process.env.SANITY_API_TOKEN!,
  useCdn: false,
});

// ---------------------------------------------------------------------------
// Helpers — turn our internal IDs into Sanity-safe ones. Sanity document
// IDs can contain letters, digits, dots, and dashes. Our slugs already
// match that shape, but we prefix by type to avoid collisions if a banner
// and a product ever share a slug.
// ---------------------------------------------------------------------------

const idFor = (type: string, slug: string) =>
  `${type}-${slug}`.replace(/[^a-zA-Z0-9._-]/g, "-");

// ---------------------------------------------------------------------------
// Inline static content — banners and categories live in components today,
// so re-state them here for the migration. After this runs they live in
// Sanity; the inline copies in components will be removed in a follow-up.
// ---------------------------------------------------------------------------

const BANNERS = [
  {
    slug: "ethiopia-bensa",
    order: 10,
    kicker: "Новий лот · Весна 2026",
    titleLine1: "Ефіопія Бенса.",
    titleLine2: "Полуниця, чай, мед.",
    copy: "Натуральна обробка з ферми в Сідамо. Обсмажка під фільтр — свіжа щотижня.",
    ctaLabel: "Купити лот",
    ctaHref: "/shop/ethiopia-sidamo",
    secondaryLabel: "Усі свіжі партії",
    secondaryHref: "/shop",
    badge: "Новий лот · 420 ₴",
    markTint: "#8A4A26",
    fallbackBg: "#F5EAD9",
  },
  {
    slug: "subscription",
    order: 20,
    kicker: "Підписка · −15% на першу",
    titleLine1: "Свіжа кава",
    titleLine2: "сама знайде тебе.",
    copy: "Обираєш сорти, метод і ритм. Решта — на нас. Пауза будь-коли, перша коробка зі знижкою.",
    ctaLabel: "Оформити підписку",
    ctaHref: "/subscription",
    secondaryLabel: "Як це працює",
    secondaryHref: "/subscription",
    badge: "Від 390 ₴ / міс.",
    markTint: "#2B1F15",
    fallbackBg: "#F7F5F1",
  },
  {
    slug: "spring-set",
    order: 30,
    kicker: "Весняний сет · 3 сорти",
    titleLine1: "Коробка з трьох",
    titleLine2: "для уважних ранків.",
    copy: "Ефіопія, Колумбія, Бразилія — по 250 г у одній упаковці. Подарунок у цупкому папері.",
    ctaLabel: "Купити сет",
    ctaHref: "/shop/spring-set",
    secondaryLabel: "Усі сети",
    secondaryHref: "/shop?category=gifts",
    badge: "Limited · 1 050 ₴",
    markTint: "#FFFFFF",
    fallbackBg: "#1A1612",
  },
];

const CATEGORIES = [
  {
    slug: "beans",
    title: "Кава в зернах",
    href: "/shop?category=beans",
    order: 10,
    gradient:
      "radial-gradient(ellipse at 35% 40%, #F2E2CE 0%, #D9B689 55%, #9E7148 100%)",
  },
  {
    slug: "ground",
    title: "Мелена кава",
    href: "/shop?category=ground",
    order: 20,
    gradient:
      "radial-gradient(ellipse at 50% 50%, #EAD9C3 0%, #C19A70 60%, #7D5034 100%)",
  },
  {
    slug: "drip",
    title: "Дріп-пакети",
    href: "/shop?category=drip",
    order: 30,
    gradient:
      "radial-gradient(ellipse at 60% 40%, #F7EEE1 0%, #E3CEA8 55%, #B48F5E 100%)",
  },
  {
    slug: "capsules",
    title: "Капсули",
    href: "/shop?category=capsules",
    order: 40,
    gradient:
      "radial-gradient(ellipse at 45% 45%, #EBE2D0 0%, #BDAA85 55%, #7E6B49 100%)",
  },
  {
    slug: "subscription",
    title: "Підписка",
    href: "/subscription",
    order: 50,
    gradient:
      "radial-gradient(ellipse at 40% 50%, #4A3828 0%, #2A1D12 65%, #140B06 100%)",
  },
  {
    slug: "gear",
    title: "Аксесуари",
    href: "/shop?category=gear",
    order: 60,
    gradient:
      "radial-gradient(ellipse at 50% 45%, #DCE0D4 0%, #A5AE9A 55%, #626A5A 100%)",
  },
  {
    slug: "grinders",
    title: "Млинки",
    href: "/shop?category=grinders",
    order: 70,
    gradient:
      "radial-gradient(ellipse at 45% 50%, #D8D3CA 0%, #8B867D 55%, #3E3A34 100%)",
  },
  {
    slug: "gifts",
    title: "Подарункові сети",
    href: "/shop?category=gifts",
    order: 80,
    gradient:
      "radial-gradient(ellipse at 55% 40%, #F3D9C5 0%, #C78871 55%, #7A4432 100%)",
  },
];

// ---------------------------------------------------------------------------
// Builders — turn each piece of source content into a Sanity document.
// ---------------------------------------------------------------------------

function buildProduct(p: (typeof PRODUCTS)[number]) {
  return {
    _id: idFor("product", p.slug),
    _type: "product",
    name: p.name,
    slug: { _type: "slug", current: p.slug },
    category: p.category,
    shortDescription: p.shortDescription,
    story: p.story,
    badge: p.badge,
    inStock: p.inStock,

    origin: p.origin,
    country: p.country,
    region: p.region,
    process: p.process,
    altitude: p.altitude,
    varietal: p.varietal,
    farm: p.farm,
    harvest: p.harvest,

    notes: p.notes,
    meters: p.meters,
    roasts: p.roasts,
    grinds: p.grinds,

    weights: p.weights.map((w, i) => ({
      _key: `w${i}`,
      _type: "object",
      label: w.label,
      grams: w.grams,
      price: w.price,
    })),

    brewing: p.brewing?.map((b, i) => ({
      _key: `b${i}`,
      _type: "object",
      method: b.method,
      ratio: b.ratio,
      grind: b.grind,
      waterTemp: b.waterTemp,
      time: b.time,
      tip: b.tip,
    })),

    // For now, store the gallery as gradient strings on `fallbackGradient`
    // (just the primary) — when real photos arrive editors upload via
    // Studio and we drop the gradient. Keep all gradients somewhere for
    // reference: we stash the primary, the rest get lost (not a big deal,
    // they were placeholders anyway).
    fallbackGradient: p.gallery[0],
  };
}

function buildBanner(b: (typeof BANNERS)[number]) {
  return {
    _id: idFor("banner", b.slug),
    _type: "banner",
    slug: { _type: "slug", current: b.slug },
    order: b.order,
    visible: true,
    kicker: b.kicker,
    titleLine1: b.titleLine1,
    titleLine2: b.titleLine2,
    copy: b.copy,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
    secondaryLabel: b.secondaryLabel,
    secondaryHref: b.secondaryHref,
    badge: b.badge,
    markTint: b.markTint,
    fallbackBg: b.fallbackBg,
  };
}

function buildCategory(c: (typeof CATEGORIES)[number]) {
  return {
    _id: idFor("category", c.slug),
    _type: "category",
    title: c.title,
    href: c.href,
    order: c.order,
    visible: true,
    gradient: c.gradient,
  };
}

function buildBrewGuide(g: (typeof BREW_GUIDES)[number], i: number) {
  return {
    _id: idFor("brewGuide", g.slug),
    _type: "brewGuide",
    name: g.name,
    slug: { _type: "slug", current: g.slug },
    tagline: g.tagline,
    intro: g.intro,
    ratio: g.ratio,
    grind: g.grind,
    waterTemp: g.waterTemp,
    totalTime: g.totalTime,
    gradient: g.gradient,
    order: (i + 1) * 10,
    steps: g.steps.map((s, j) => ({
      _key: `s${j}`,
      _type: "object",
      time: s.time,
      title: s.title,
      body: s.body,
    })),
    tips: g.tips,
  };
}

/**
 * Journal body in our mocks is a typed block array — heading / quote /
 * list / image. Convert to Portable Text so Sanity can render and edit it.
 */
function blocksToPortableText(blocks: (typeof JOURNAL_POSTS)[number]["body"]) {
  return blocks.map((b, i) => {
    const _key = `b${i}`;
    if (b.kind === "p") {
      return {
        _key,
        _type: "block",
        style: "normal",
        children: [{ _key: `${_key}s`, _type: "span", text: b.text }],
      };
    }
    if (b.kind === "h2") {
      return {
        _key,
        _type: "block",
        style: "h2",
        children: [{ _key: `${_key}s`, _type: "span", text: b.text }],
      };
    }
    if (b.kind === "quote") {
      const text = b.author ? `${b.text} — ${b.author}` : b.text;
      return {
        _key,
        _type: "block",
        style: "blockquote",
        children: [{ _key: `${_key}s`, _type: "span", text }],
      };
    }
    if (b.kind === "list") {
      // Portable Text lists are siblings, not nested. Emit one block per item.
      // Returning an array here would break the .map type; flatten outside.
      return b.items.map((item, j) => ({
        _key: `${_key}l${j}`,
        _type: "block",
        style: "normal",
        listItem: "number" as const,
        level: 1,
        children: [
          { _key: `${_key}l${j}s`, _type: "span", text: item },
        ],
      }));
    }
    // image
    return {
      _key,
      _type: "image",
      caption: b.caption,
      // No asset — gradient-only placeholder. Editor will upload a real
      // photo in Studio; this entry is just a typed slot.
    };
  });
}

function buildJournalPost(p: (typeof JOURNAL_POSTS)[number]) {
  const flatBody = blocksToPortableText(p.body).flat();
  return {
    _id: idFor("journalPost", p.slug),
    _type: "journalPost",
    title: p.title,
    slug: { _type: "slug", current: p.slug },
    category: p.category,
    excerpt: p.excerpt,
    publishedAt: new Date(p.publishedAt).toISOString(),
    readTime: p.readTime,
    author: p.author,
    coverGradient: p.gradient,
    body: flatBody,
    // related references are populated in a second pass after all posts
    // exist (otherwise we'd reference a doc that hasn't been created yet).
  };
}

// ---------------------------------------------------------------------------
// Run migration
// ---------------------------------------------------------------------------

async function run() {
  const tx = client.transaction();

  // Singleton: site settings
  tx.createOrReplace({
    _id: "siteSettings",
    _type: "siteSettings",
    title: "BATCH Coffee Roastery",
    description:
      "Свіжообсмажена спешиалті кава з Полтави. Підписка, доставка по всій Україні.",
    contactPhone: "+380 50 123 45 67",
    contactEmail: "hello@batch.coffee",
    address: "Велика Васильківська, 24, Київ",
    hours: "Пн–Нд · 08:00–22:00",
    instagram: "https://instagram.com/batch.coffee",
    telegram: "https://t.me/batchcoffee",
  });

  for (const b of BANNERS) tx.createOrReplace(buildBanner(b));
  for (const c of CATEGORIES) tx.createOrReplace(buildCategory(c));
  for (const p of PRODUCTS) tx.createOrReplace(buildProduct(p));
  BREW_GUIDES.forEach((g, i) =>
    tx.createOrReplace(buildBrewGuide(g, i)),
  );
  for (const p of JOURNAL_POSTS) tx.createOrReplace(buildJournalPost(p));

  const result = await tx.commit();
  console.log(
    `\n✅ Migration done. ${result.results.length} documents created/updated.\n`,
  );

  // Second pass: populate journal `related` references — needs all docs in.
  const refTx = client.transaction();
  for (const p of JOURNAL_POSTS) {
    if (!p.related?.length) continue;
    refTx.patch(idFor("journalPost", p.slug), {
      set: {
        related: p.related.map((slug, i) => ({
          _key: `r${i}`,
          _type: "reference",
          _ref: idFor("journalPost", slug),
        })),
      },
    });
  }
  await refTx.commit();
  console.log("✅ Journal cross-references linked.\n");
}

run().catch((err) => {
  console.error("Migration failed:");
  console.error(err);
  process.exit(1);
});
