/**
 * GROQ queries — Sanity's query language. Each export is a fragment used
 * by the corresponding fetcher in `lib/sanity-fetchers.ts`.
 *
 * Keep these as plain template strings (not tagged) — easy to copy into
 * the Vision tool in Studio for live testing.
 */

export const PRODUCTS_QUERY = `
  *[_type == "product"] | order(name asc) {
    _id,
    name,
    "slug": slug.current,
    category,
    shortDescription,
    story,
    badge,
    inStock,
    origin, country, region, process, altitude, varietal, farm, harvest,
    notes,
    meters,
    roasts,
    grinds,
    weights[]{ label, grams, price, wholesalePrice },
    brewing[]{ method, ratio, grind, waterTemp, time, tip },
    "gallery": gallery[]{ "url": asset->url, alt },
    fallbackGradient
  }
`;

export const PRODUCT_BY_SLUG_QUERY = `
  *[_type == "product" && slug.current == $slug][0] {
    _id,
    name,
    "slug": slug.current,
    category,
    shortDescription,
    story,
    badge,
    inStock,
    origin, country, region, process, altitude, varietal, farm, harvest,
    notes,
    meters,
    roasts,
    grinds,
    weights[]{ label, grams, price, wholesalePrice },
    brewing[]{ method, ratio, grind, waterTemp, time, tip },
    "gallery": gallery[]{ "url": asset->url, alt },
    fallbackGradient
  }
`;

/** Single promo code, matched case-insensitively. Returns the raw rule
 *  fields; validity (active / dates / min) is checked in promo-server. */
export const PROMO_CODE_BY_CODE_QUERY = `
  *[_type == "promoCode" && upper(code) == $code][0]{
    "code": upper(code),
    discountType,
    discountValue,
    active,
    startsAt,
    expiresAt,
    minSubtotal
  }
`;

export const BANNERS_QUERY = `
  *[_type == "banner" && visible == true] | order(order asc) {
    _id,
    "slug": slug.current,
    kicker, titleLine1, titleLine2, copy,
    ctaLabel, ctaHref, secondaryLabel, secondaryHref,
    badge, markTint, fallbackBg,
    "image": image{ "url": asset->url, alt }
  }
`;

export const CATEGORIES_QUERY = `
  *[_type == "category" && visible == true] | order(order asc) {
    _id,
    title, href, gradient,
    "image": image{ "url": asset->url }
  }
`;

export const BREW_GUIDES_QUERY = `
  *[_type == "brewGuide"] | order(order asc) {
    _id,
    name,
    "slug": slug.current,
    tagline, intro,
    ratio, grind, waterTemp, totalTime,
    gradient,
    "image": image{ "url": asset->url },
    steps[]{ time, title, body },
    tips
  }
`;

export const BREW_GUIDE_BY_SLUG_QUERY = `
  *[_type == "brewGuide" && slug.current == $slug][0] {
    _id,
    name,
    "slug": slug.current,
    tagline, intro,
    ratio, grind, waterTemp, totalTime,
    gradient,
    "image": image{ "url": asset->url },
    steps[]{ time, title, body },
    tips
  }
`;

export const JOURNAL_POSTS_QUERY = `
  *[_type == "journalPost"] | order(publishedAt desc) {
    _id,
    title,
    "slug": slug.current,
    category, excerpt,
    publishedAt, readTime, author,
    coverGradient,
    "coverImage": coverImage{ "url": asset->url, alt }
  }
`;

export const JOURNAL_POST_BY_SLUG_QUERY = `
  *[_type == "journalPost" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    category, excerpt,
    publishedAt, readTime, author,
    coverGradient,
    "coverImage": coverImage{ "url": asset->url, alt },
    body,
    "related": related[]->{
      _id,
      title,
      "slug": slug.current,
      category, excerpt,
      publishedAt, readTime,
      coverGradient,
      "coverImage": coverImage{ "url": asset->url }
    }
  }
`;

export const SITE_SETTINGS_QUERY = `
  *[_type == "siteSettings"][0] {
    title, description,
    contactPhone, contactEmail, address, hours,
    instagram, telegram, facebook,
    promoBarText,
    "logoBlack": logoBlack{ "url": asset->url },
    "logoWhite": logoWhite{ "url": asset->url },
    "favicon": favicon{ "url": asset->url },
    "ogImage": ogImage{ "url": asset->url },
    "visitPhoto": visitPhoto{ "url": asset->url }
  }
`;
