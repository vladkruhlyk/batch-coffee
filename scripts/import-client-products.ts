/**
 * Import the client-filled product CSV into Sanity.
 *
 *   cd web && npx tsx scripts/import-client-products.ts            # dry run
 *   cd web && npx tsx scripts/import-client-products.ts --commit   # write
 *
 * Steps:
 *   1. Parse scripts/client-products.csv (handles multiline quoted cells).
 *   2. Skip section-header rows (only the first cell filled) + blank rows.
 *   3. Map each product row into a Sanity `product` document, cleaning:
 *      - slug (strip Cyrillic look-alikes / newlines, lowercase)
 *      - category labels → internal codes
 *      - roast / process / grind text normalisation
 *      - retail + wholesale prices into weight variants
 *      - tasting notes split, meters parsed
 *      - a per-product fallback gradient so cards aren't blank
 *   4. With --commit: delete ALL existing products, then create the new
 *      set in one transaction.
 *
 * Products without any price (merch with empty price columns) are
 * skipped and listed at the end — they need prices before import.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const COMMIT = process.argv.includes("--commit");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-11-01",
  token: process.env.SANITY_API_TOKEN!,
  useCdn: false,
});

// ---------------------------------------------------------------------------
// CSV parser — RFC-4180-ish: handles quoted fields with commas + newlines.
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore — handled by \n
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Record<string, string> = {
  "кава в зернах": "beans",
  "мелена кава": "ground",
  "дріп-бокс 7 шт": "drip",
  "дріп-пакети": "drip",
  капсули: "capsules",
  сертифікати: "gifts",
  "подарункові сети": "gifts",
  мерч: "gear",
  аксесуари: "gear",
  млинки: "grinders",
};

function cleanSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "") // newlines / spaces inside the slug
    // Cyrillic look-alikes → Latin
    .replace(/с/g, "c")
    .replace(/о/g, "o")
    .replace(/а/g, "a")
    .replace(/е/g, "e")
    .replace(/р/g, "p")
    .replace(/х/g, "x")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normRoasts(raw: string): string[] {
  const t = raw.trim().toLowerCase();
  if (!t) return [];
  // tolerate typos: ФІльтр / Фільр / фильтр
  if (t.includes("філ") || t.includes("філь") || t.startsWith("фил")) {
    return ["Фільтр"];
  }
  if (t.includes("еспрес") || t.includes("espresso")) return ["Еспресо"];
  if (t.includes("універс")) return ["Універсальна"];
  return [];
}

function normGrinds(raw: string): string[] {
  if (!raw || raw.trim() === "-") return [];
  return raw
    .split("|")
    .map((g) => g.trim())
    .filter((g) => g && g !== "-")
    .map((g) => {
      const l = g.toLowerCase();
      if (l.startsWith("не молоти")) return "Не молоти";
      if (l.startsWith("еспрес")) return "Еспресо";
      if (l.startsWith("гейзер")) return "Гейзерна";
      if (l.startsWith("джезв")) return "Джезва";
      if (l.startsWith("френч")) return "Френч-прес";
      if (l.startsWith("v60")) return "V60";
      if (l.startsWith("кемекс") || l.startsWith("chemex")) return "Кемекс";
      if (l.startsWith("аеропрес")) return "Аеропрес";
      if (l.startsWith("батч")) return "Батч Брю";
      if (l.startsWith("чашка")) return "Чашка (дрібно)";
      return g; // keep unknown as-is
    })
    .filter((v, i, arr) => arr.indexOf(v) === i); // dedupe
}

function normProcess(raw: string): string {
  const collapsed = fixCommonTypos(raw)
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
  const t = collapsed.toLowerCase();
  if (!t || t === "-") return "";
  if (t.includes("шугаркейн") || t.includes("sugarcane")) return "Sugarcane";
  if (t.includes("мосто") || t.includes("ко-фермента")) {
    return "Ко-ферментація";
  }
  if (t.includes("термал") || t.includes("thermal")) {
    return t.includes("натураль")
      ? "Натуральна + термал шок"
      : "Мита + термал шок";
  }
  if (t.includes("вайні")) return "Вайні";
  if (t.includes("хані")) return "Хані";
  if (t.includes("анаероб")) return "Натуральна анаеробна";
  if (t.includes("натураль")) return "Натуральна";
  if (t.includes("мита")) return "Мита";
  return collapsed;
}

function num(raw: string): number | null {
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function notesArr(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function fixCommonTypos(raw: string): string {
  return raw.replace(/Колумбв?я/g, "Колумбія");
}

// Gradient presets keyed loosely by roast profile so espresso reads
// darker, filter brighter. Picked round-robin within each bucket so
// neighbouring cards don't all look identical.
const ESPRESSO_GRADIENTS = [
  "radial-gradient(ellipse at 35% 35%, #A87B58 0%, #5A3A24 65%, #241410 100%)",
  "radial-gradient(ellipse at 40% 40%, #9A6B45 0%, #4E2E1B 60%, #1E110A 100%)",
  "radial-gradient(ellipse at 45% 35%, #B07C52 0%, #5E3A22 60%, #2A160C 100%)",
];
const FILTER_GRADIENTS = [
  "radial-gradient(ellipse at 35% 35%, #E8B888 0%, #B46A3D 55%, #6B3A1E 100%)",
  "radial-gradient(ellipse at 40% 40%, #E3C39A 0%, #C07F4B 55%, #7A4626 100%)",
  "radial-gradient(ellipse at 45% 35%, #E7CDA0 0%, #C98A55 55%, #82502C 100%)",
];
const NEUTRAL_GRADIENT =
  "radial-gradient(ellipse at 50% 50%, #EFE5D2 0%, #C9A87B 70%, #6B4225 100%)";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ColIdx {
  [k: string]: number;
}

(async () => {
  const csv = readFileSync("scripts/client-products.csv", "utf8");
  const rows = parseCsv(csv);
  const header = rows[0].map((h) => h.trim());
  const col: ColIdx = {};
  header.forEach((h, i) => (col[h] = i));

  const get = (r: string[], name: string) => (r[col[name]] ?? "").trim();

  const docs: Record<string, unknown>[] = [];
  const skipped: { name: string; reason: string }[] = [];
  let espIdx = 0;
  let filIdx = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const slugRaw = (r[0] ?? "").trim();
    let name = get(r, "Назва");
    const catRaw = get(r, "Категорія");

    // Fix obvious typos the client left in.
    name = fixCommonTypos(name);

    // Section header: first cell filled but no category/name structure.
    if (slugRaw && !name && !catRaw) continue;
    if (!slugRaw && !name) continue;
    if (!name) continue;

    const category = CATEGORY_MAP[catRaw.toLowerCase()];
    if (!category) {
      skipped.push({ name, reason: `unknown category "${catRaw}"` });
      continue;
    }

    const slug = cleanSlug(slugRaw || name);

    // ---- weights / prices ----
    const weights: {
      _key: string;
      label: string;
      grams: number;
      price: number;
      wholesalePrice?: number;
    }[] = [];

    if (category === "beans" || category === "ground") {
      const p250 = num(get(r, "Ціна 250 г (₴)"));
      const p1kg = num(get(r, "Ціна 1 кг (₴)"));
      let w250 = num(get(r, "Ціна Опт 250 г (₴)"));
      let w1kg = num(get(r, "Ціна Опт 1 кг (₴)"));
      // Guard: wholesale must be cheaper than retail. The client had a
      // row where wholesale > retail (data-entry slip) — drop it rather
      // than ship an "wholesale" price that's higher.
      if (w250 && p250 && w250 >= p250) {
        skipped.push({ name, reason: `опт 250г (${w250}) ≥ роздріб (${p250}) — пропущено опт` });
        w250 = null;
      }
      if (w1kg && p1kg && w1kg >= p1kg) {
        skipped.push({ name, reason: `опт 1кг (${w1kg}) ≥ роздріб (${p1kg}) — пропущено опт` });
        w1kg = null;
      }
      if (p250)
        weights.push({
          _key: "w250",
          label: "250 г",
          grams: 250,
          price: p250,
          ...(w250 ? { wholesalePrice: w250 } : {}),
        });
      if (p1kg)
        weights.push({
          _key: "w1kg",
          label: "1 кг",
          grams: 1000,
          price: p1kg,
          ...(w1kg ? { wholesalePrice: w1kg } : {}),
        });
    } else if (category === "drip") {
      // Drip box: the "Ціна 1 кг" column holds the single box price.
      const boxPrice = num(get(r, "Ціна 1 кг (₴)"));
      if (boxPrice)
        weights.push({
          _key: "wbox",
          label: "7 шт",
          grams: 84,
          price: boxPrice,
        });
    } else if (category === "gifts") {
      // Gift card — derive denomination from the slug/name digits.
      const denom = num(slug.replace(/\D/g, "")) ?? num(name);
      if (denom)
        weights.push({
          _key: "wgift",
          label: `${denom} ₴`,
          grams: 1,
          price: denom,
        });
    }
    // gear / merch: no price columns → skipped below.

    if (weights.length === 0) {
      skipped.push({ name, reason: "no price" });
      continue;
    }

    const roasts = normRoasts(get(r, "Профіль обсмажки"));
    const isFilter = roasts.includes("Фільтр");
    const gradient =
      category === "gifts" || category === "gear"
        ? NEUTRAL_GRADIENT
        : isFilter
          ? FILTER_GRADIENTS[filIdx++ % FILTER_GRADIENTS.length]
          : ESPRESSO_GRADIENTS[espIdx++ % ESPRESSO_GRADIENTS.length];

    const isCoffee = category === "beans" || category === "ground" || category === "drip";

    const doc: Record<string, unknown> = {
      _type: "product",
      // Use a public document id shape. Sanity path-like ids with dots
      // are readable with a token but can disappear for the public CDN
      // client the storefront uses.
      _id: `product-${slug}`,
      name,
      slug: { _type: "slug", current: slug },
      category,
      shortDescription: fixCommonTypos(get(r, "Короткий опис")) || name,
      story: fixCommonTypos(get(r, "Опис на сторінці")),
      inStock: get(r, "В наявності").toLowerCase() !== "ні",
      weights,
      fallbackGradient: gradient,
    };

    const badge = get(r, "Бейдж");
    if (badge) doc.badge = badge;

    if (isCoffee) {
      const origin = fixCommonTypos(get(r, "Походження"));
      const country = fixCommonTypos(get(r, "Країна"));
      const region = fixCommonTypos(get(r, "Регіон"));
      const process = normProcess(get(r, "Обробка"));
      const varietal = fixCommonTypos(get(r, "Різновид") || get(r, "Сорт"));
      const farm = fixCommonTypos(get(r, "Ферма"));
      const notes = notesArr(get(r, "Смакові ноти"));
      const acidity = num(get(r, "Кислотність (1-5)"));
      const sweetness = num(get(r, "Солодкість (1-5)"));
      const bitterness = num(get(r, "Гіркота (1-5)"));
      const grinds = normGrinds(get(r, "Опції помелу"));

      if (origin) doc.origin = origin;
      if (country) doc.country = country;
      if (region) doc.region = region;
      if (process) doc.process = process;
      if (varietal) doc.varietal = varietal;
      if (farm) doc.farm = farm;
      if (notes.length) doc.notes = notes;
      if (roasts.length) doc.roasts = roasts;
      if (grinds.length) doc.grinds = grinds;
      if (acidity || sweetness || bitterness) {
        doc.meters = {
          acidity: acidity ?? 3,
          sweetness: sweetness ?? 3,
          bitterness: bitterness ?? 3,
        };
      }
    }

    docs.push(doc);
  }

  // ---- report ----
  console.log(`Parsed ${docs.length} importable products:`);
  for (const d of docs) {
    const w = (d.weights as { label: string; price: number }[])
      .map((x) => `${x.label}=${x.price}`)
      .join(", ");
    console.log(`  ✔ ${d.category}  ${(d.slug as { current: string }).current}  —  ${d.name}  [${w}]`);
  }
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const s of skipped) console.log(`  ✘ ${s.name} — ${s.reason}`);
  }

  if (!COMMIT) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }

  // ---- delete existing + create new ----
  console.log("\nDeleting existing products…");
  const existing = await client.fetch<{ _id: string }[]>(
    `*[_type == "product"]{ _id }`,
  );
  let tx = client.transaction();
  for (const e of existing) tx = tx.delete(e._id);
  for (const d of docs)
    tx = tx.createOrReplace(
      d as { _id: string; _type: string } & Record<string, unknown>,
    );
  await tx.commit();
  console.log(
    `Done. Removed ${existing.length}, created ${docs.length} products.`,
  );
})().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
