# Sanity Pipeline Digest — git-batch-coffee/web (Next.js 16 + embedded Studio)

## File layout
```
web/sanity.config.ts                      # Studio config (embedded at /studio)
web/src/sanity/env.ts                     # validated env constants
web/src/sanity/schemaTypes/{index,product,banner,category,brewGuide,journalPost,siteSettings,promoCode}.ts
web/src/sanity/structure.ts               # desk structure + singleton
web/src/sanity/queries.ts                 # GROQ fragments
web/src/sanity/lib/client.ts              # client (CDN) + freshClient (live)
web/src/sanity/lib/fetchers.ts            # cache-tagged fetch + adapt
web/src/sanity/lib/adapters.ts            # raw → view models
web/src/app/api/revalidate/route.ts       # signed webhook → revalidateTag
web/scripts/import-client-products.ts     # CSV → Sanity import (dry-run default)
web/src/lib/promo-server.ts, order-pricing.ts  # money-path consumers of freshClient
```

## env.ts — fail-loud env validation
Env vars: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_VERSION` (default `"2024-11-01"`, pinned — "Bump consciously"), `SANITY_API_TOKEN` (server-only `writeToken`), `SANITY_WEBHOOK_SECRET` (used only in revalidate route).
```ts
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}. Did you copy .env.local from .env.local.example?`);
  return value;
}
export const projectId = required("NEXT_PUBLIC_SANITY_PROJECT_ID", process.env.NEXT_PUBLIC_SANITY_PROJECT_ID);
```
Why: missing var fails at startup, not as "a mysterious 401 at request time."

## sanity.config.ts — embedded Studio
```ts
export default defineConfig({
  basePath: "/studio", projectId, dataset, schema,
  plugins: [structureTool({ structure }), visionTool({ defaultApiVersion: apiVersion })],
});
```
Mounted via `app/studio/[[...tool]]/page.tsx`; file is `"use client"`. Vision tool kept in for live GROQ debugging.

## Schema conventions (product.ts)
- All Studio-facing titles/descriptions in Ukrainian (client's language); field `name`s in English camelCase.
- Field **groups**: `main` (default: true), `origin`, `taste`, `variants`, `brewing`, `media`.
- One document type for all categories; coffee-only fields optional — "the rendering side already branches on their presence."
- **Constrained fields** (radio list): `category` values `beans|ground|drip|capsules|gear|grinders|gifts`. **Deliberately free-text** (with example-rich descriptions instead of enums): `badge`, `process`, `roasts`, `grinds` (`options: { layout: "tags" }`) — descriptions say "Додавай свої значення" so the roaster isn't blocked by a fixed list.
- Full field list: `name` (string, required), `slug` (slug, `options: { source: "name", maxLength: 96 }`, required), `category` (radio, required), `shortDescription` (string, `required().max(120)`), `story` (text rows:5), `badge` (string, empty = no badge), `inStock` (boolean, `initialValue: true`), origin block `origin/country/region/process/altitude/varietal/farm/harvest` (all plain strings), `notes` (string[], `rule.max(5)` — "на картці поміщається до трьох"), `meters` (object: `acidity/sweetness/bitterness` numbers `min(1).max(5)`), `roasts`/`grinds` (tag arrays), `weights`, `brewing`, `gallery`, `fallbackGradient`.
- **weights** array (the money field):
```ts
weights: array, validation: rule.required().min(1), of: [{ type:"object", fields: [
  label  string required        // "250 г" / "6 шт"
  grams  number required.min(1) // "Сирі грами — для сортування"
  price  number required.min(0) // ₴
  wholesalePrice number min(0)  // optional; on the 1 kg variant overrides the auto 15% wholesale discount at ≥3 kg
]}]
```
with item `preview: { select: {label, price}, prepare: ({label,price}) => ({title: label, subtitle: price ? `${price} ₴` : undefined}) }`.
- `brewing`: array of objects `{method (required), ratio, grind, waterTemp(number), time, tip(text rows:2)}`, "Перший — найрекомендованіший."
- `gallery`: array of `image` with `options:{hotspot:true}` + `alt` field per image; "Перше зображення — головне." `fallbackGradient`: raw CSS gradient string shown until gallery has images.
- Document `preview: { select: { title:"name", subtitle:"shortDescription", media:"gallery.0" } }`.

## promoCode schema
Doc comment encodes the security model: "The discount is ALWAYS recomputed server-side (api/orders/create)… The client only uses these fields to preview."
- `code` string, custom validation rejects whitespace: `value && /\s/.test(value) ? "Код не може містити пробіли" : true`. Case-insensitive by convention ("knew10 = KNEW10").
- `discountType` radio `percent|fixed`, `initialValue: "percent"`.
- `discountValue` number `required().positive()` + cross-field custom: reads `context.parent.discountType`, rejects percent > 100.
- `active` boolean `initialValue: true` ("вимкни… без видалення"), `startsAt`/`expiresAt` datetime (empty = unbounded), `minSubtotal` number `.positive()`, `note` string (internal).
- Preview: `subtitle: `${active ? "✅ активний" : "⛔ вимкнено"} · ${type==="fixed" ? `−${value} ₴` : `−${value}%`}``.

## structure.ts — desk + singleton
Most-used content at top, `S.divider()` between groups, ordered lists use `.defaultOrdering([{ field: "order", direction: "asc" }])` (journal: `publishedAt desc`). Singleton pattern:
```ts
S.listItem().title("Налаштування сайту").child(
  S.editor().id("siteSettings").schemaType("siteSettings").documentId("siteSettings"),
);
```
— single editor, fixed documentId; exactly one doc in dataset by construction. `schemaTypes/index.ts` is a flat registry: `export const schema: { types: SchemaTypeDefinition[] } = { types: [product, banner, …] }`.

## queries.ts — GROQ conventions
- Plain (untagged) template strings — "easy to copy into the Vision tool."
- Lists: `*[_type == "product"] | order(name asc) { … }`; single: `*[… && slug.current == $slug][0] { … }`.
- Always alias slug: `"slug": slug.current`. Images projected to URLs inline: `"gallery": gallery[]{ "url": asset->url, alt }`, `"image": image{ "url": asset->url }`.
- Arrays of objects explicitly projected: `weights[]{ label, grams, price, wholesalePrice }`, `brewing[]{ method, ratio, grind, waterTemp, time, tip }`.
- References dereffed inline: `"related": related[]->{ _id, title, "slug": slug.current, … }`.
- Case-insensitive promo lookup, normalized on both sides:
```groq
*[_type == "promoCode" && upper(code) == $code][0]{ "code": upper(code), discountType, discountValue, active, startsAt, expiresAt, minSubtotal }
```
Caller passes `$code` already `trim().toUpperCase()` (and length-capped ≤ 50 in promo-server.ts as "the last gate before the value is interpolated as a GROQ $param"). Query returns raw rule fields; validity is checked in code, not GROQ.

## lib/client.ts — TWO clients
```ts
export const client = createClient({ projectId, dataset, apiVersion, useCdn: true,  perspective: "published" });
export const freshClient = createClient({ projectId, dataset, apiVersion, useCdn: false, perspective: "published" });
```
Why two (verbatim lesson): "Sanity's CDN caches responses for minutes regardless of Next.js `revalidate` options — fine for product pages, NOT fine when computing what to charge: a just-raised price could bill at the stale CDN value." Money paths (`order-pricing.ts`, `promo-server.ts`) use `freshClient`; everything render-facing uses `client`.

## fetchers.ts — cache tags + revalidate
```ts
const tags = (tag: string) => ({ next: { tags: [tag], revalidate: 60 } });

export async function fetchProducts() {
  const raw = await client.fetch<SanityProduct[]>(PRODUCTS_QUERY, {}, tags("product"));
  return raw.map(adaptProduct);
}
export async function fetchProductBySlug(slug: string) {
  const raw = await client.fetch<SanityProduct | null>(PRODUCT_BY_SLUG_QUERY, { slug }, tags(`product:${slug}`));
  return raw ? adaptProduct(raw) : null;
}
```
Tag convention: list = type name (`"product"`, `"banner"`…); per-doc = `` `${type}:${slug}` ``. 60s time-based revalidate is the safety net; the webhook gives instant invalidation. Every fetcher returns adapted view models, never raw docs. Money fetches differ: promo uses `{ next: { revalidate: 30, tags: ["promoCode"] } }` on freshClient ("publish-to-live within ~30s, no hammering on hot codes"); order pricing uses `{ next: { revalidate: 0 } }` — comment: "`revalidate: 0` alone only controls Next's fetch cache, NOT Sanity's edge cache."

## adapters.ts — philosophy + guards
Purpose: "the rendering side doesn't have to know Sanity exists… these adapters die [later] — but for now they let us swap data sources without touching dozens of files." Pattern: typed `SanityX` raw interface (optionals everywhere) → `adaptX(s): ViewModel` with `??` defaults so components never null-check.
- Image strategy: components consume CSS `background-image` values, so adapter emits `url(${img.url})` for uploads or the gradient string — "components don't branch":
```ts
function imageOrGradient(image, fallbackGradient): string {
  if (image?.url) return `url(${image.url})`;
  if (fallbackGradient) return fallbackGradient;
  return "radial-gradient(ellipse at 50% 50%, #EFE5D2 0%, #C9A87B 70%, #6B4225 100%)"; // layout never collapses
}
```
- Product: `weights: s.weights ?? []`, `inStock: s.inStock ?? true`, `story: s.story ?? ""`; gallery = `url(...)`-wrapped uploads, else `[fallbackGradient ?? neutral gradient]` (always ≥1 entry). Free-text strings cast to narrower union types (`s.process as ProcessKind | undefined`).
- Banner defaults: `ctaHref ?? "/shop"`, `markTint ?? "#8A4A26"`, `fallbackBg ?? "#F5EAD9"`; banner `image` stays a bare URL (rendered via `next/image`, not CSS).
- siteSettings adapter accepts `null` doc and returns full fallback object (brand title, phone, address baked in) so the site works before the singleton is created.
- Portable Text → typed blocks: "list items are sibling blocks, not nested" — a `pendingList` accumulator coalesces consecutive `listItem` blocks, `flushList()` before every non-list block; unknown styles fall back to `{kind:"p"}` "so we never silently drop content"; blockquote splits on last `" — "` into quote+author.

## /api/revalidate — signed webhook
```ts
import { parseBody } from "next-sanity/webhook";
const { isValidSignature, body } = await parseBody<{ _type?: string; slug?: string }>(req, secret);
if (!isValidSignature) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
...
revalidateTag(body._type, "max");
if (body.slug) revalidateTag(`${body._type}:${body.slug}`, "max");
```
- 500 if `SANITY_WEBHOOK_SECRET` unset; 400 if no `_type`; on signature failure "the cache stays as-is."
- Next 16 note in code: "Next 16 expects an explicit profile arg — `"max"` pings every cached entry tied to the tag."
- Webhook setup documented in the route's comment (copy-paste runbook): URL `https://<domain>/api/revalidate`, trigger Create/Update/Delete, Filter `_type in ["product","banner","category","brewGuide","journalPost","siteSettings","promoCode"]`, **Projection `{ "_type": _type, "slug": slug.current }`** (this is what makes per-slug tags work), Secret = `SANITY_WEBHOOK_SECRET`.

## Import script pattern (scripts/import-client-products.ts)
- Invocation: `npx tsx scripts/import-client-products.ts` = **dry run by default**; `--commit` writes. `loadEnv({ path: ".env.local" })` + own write client (`token: SANITY_API_TOKEN`, `useCdn: false`).
- Hand-rolled RFC-4180-ish CSV parser (quoted fields with commas/newlines, `""` escapes) — client spreadsheets have multiline cells.
- Header-name column lookup (`col[header]`), not positional indices; skips section-header rows (only first cell filled) and blank rows.
- Normalizers tolerate human input: `cleanSlug` strips Cyrillic look-alikes (`с→c, о→o, а→a, е→e, р→p, х→x`), lowercases, collapses dashes; `normRoasts`/`normGrinds`/`normProcess` match on substrings to absorb typos ("ФІльтр / Фільр / фильтр"), unknown values kept as-is; `fixCommonTypos` patches known client misspellings.
- **Data-quality guard (real bug)**: "wholesale must be cheaper than retail. The client had a row where wholesale > retail (data-entry slip) — drop it rather than ship" → if `w250 >= p250`, drop wholesale, log to `skipped`.
- Weight rows carry explicit `_key`s (`"w250"`, `"w1kg"`, `"wbox"`, `"wgift"`); category-specific price mapping (drip box price lives in the 1 kg column; gift denomination parsed from slug digits); zero-price products skipped and reported.
- **Document id lesson (verbatim)**: "Use a public document id shape. Sanity path-like ids with dots are readable with a token but can disappear for the public CDN client" → `_id: \`product-${slug}\``, `slug: { _type: "slug", current: slug }`.
- Commit = one transaction: fetch all existing `_id`s, `tx.delete(...)` each, `tx.createOrReplace(...)` each new doc, single `tx.commit()` — atomic replace, no half-imported state.
- Round-robin gradient presets bucketed by roast (3 `ESPRESSO_GRADIENTS` darker, 3 `FILTER_GRADIENTS` brighter, `NEUTRAL_GRADIENT` for gear/gifts) "so neighbouring cards don't all look identical."
- Ends with a console report: ✔ per imported doc with prices, ✘ per skip with reason, and "DRY RUN — nothing written" reminder.

## Money-path consumers (hard-won guards worth porting)
`src/lib/promo-server.ts` / `src/lib/order-pricing.ts`:
- Both `api/promo/validate` and `api/orders/create` import the same `resolvePromoRule` + `evaluatePromo` "so both gates run the EXACT same rules."
- **NaN date guard**: `new Date("garbage").getTime()` is NaN and both `NaN > now` and `NaN < now` are false — without `Number.isFinite(ts)` the expiry window check silently passes ("an underpay vector"); unparseable date ⇒ refuse the code.
- `Math.ceil(minSubtotal)` in the error message, not round — "never display a threshold lower than the actual check."
- Order pricing re-fetches every line price by slug+label from Sanity and ignores client prices entirely; weight labels are `.trim()`ed on both store and lookup (stray Studio trailing space must not reject an order via Map strict-equality); label buckets are arrays because the schema doesn't enforce label uniqueness — duplicates disambiguated by client `weightGrams`, "never silently last-one-wins"; `weightGrams` "can never set a price."

Key absolute paths: `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web/src/sanity/{schemaTypes/product.ts, schemaTypes/promoCode.ts, structure.ts, queries.ts, env.ts, lib/client.ts, lib/fetchers.ts, lib/adapters.ts}`, `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web/src/app/api/revalidate/route.ts`, `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web/scripts/import-client-products.ts`, `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web/src/lib/{promo-server.ts, order-pricing.ts}`.
