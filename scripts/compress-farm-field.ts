/**
 * Compress the `farm` field on each product.
 *
 *   cd web && npx tsx scripts/compress-farm-field.ts            # dry run
 *   cd web && npx tsx scripts/compress-farm-field.ts --commit   # write
 *
 * The client pasted whole region / farm-history paragraphs (up to ~700
 * chars) into `farm`, which is rendered as a compact one-line fact in
 * the "Походження" panel — a wall of text breaks that grid. This sets a
 * short farm/station/co-op NAME per product instead. The long context
 * mostly overlaps the product `story`, so it isn't lost-lost; if the
 * roaster wants the full farm narrative on the page later we'd add a
 * dedicated section rather than overload the fact row.
 */
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

// slug → concise farm name. Keyed by slug; drip boxes mirror their bean
// counterparts.
const FARM_NAMES: Record<string, string> = {
  "brasil-santos": "Дрібні господарства, Мінас-Жерайс",
  "burundi-nyagisinru": "Станція Nyagishiru CWS (MATRACO)",
  "colombia-campohermoso": "Campo Hermoso — Едвін Норенья",
  "colombia-decaf": "Дрібні господарства FNC, Перейра",
  "colombia-encisocrew": "Enciso Family — La Leona, El Triunfo",
  "colombia-lacascada": "Quebraditas — Едісон Арґоте",
  "colombia-lasmoras": "El Diviso × Las Flores, Уїла",
  "colombia-popayan": "Общинні господарства, Каука",
  "costarica-lacatarata": "Café Rivense del Chirripó",
  "ethiopia-limu2gr": "Дрібні господарства Ліму, Джимма",
  "ethiopia-tracon": "Трейдер Tracon — Guji, Sidamo, Yirgacheffe",
  "honduras-shg": "Дрібні господарства, Копан",
  "kenya-rockbern": "Станція Гакуюїіні — Thirikwa Co-op",
  "tanzania-kilimanjaro": "Північні схили Кіліманджаро",
  // drip boxes
  "dripbox-burundi": "Станція Nyagishiru CWS (MATRACO)",
  "dripbox-cascada": "Quebraditas — Едісон Арґоте",
  "dripbox-decaf": "Дрібні господарства FNC, Перейра",
  "dripbox-indonesia": "Дрібні господарства, Gayo Highlands",
  "dripbox-kenya": "Станція Гакуюїіні — Thirikwa Co-op",
  "dripbox-limu2gr": "Дрібні господарства Ліму, Джимма",
};

(async () => {
  const prods = await client.fetch<{ _id: string; slug: string; farm?: string }[]>(
    `*[_type=="product" && defined(farm) && farm != ""]{ _id, "slug": slug.current, farm }`,
  );

  let tx = client.transaction();
  let n = 0;
  for (const p of prods) {
    const next = FARM_NAMES[p.slug];
    if (!next) {
      console.log(`  ? ${p.slug} — no mapping, left as-is (${p.farm?.length} chars)`);
      continue;
    }
    console.log(`  ✔ ${p.slug}: ${p.farm?.length} chars → "${next}"`);
    tx = tx.patch(p._id, (patch) => patch.set({ farm: next }));
    n++;
  }

  if (!COMMIT) {
    console.log(`\nDRY RUN — ${n} would be updated. Re-run with --commit.`);
    return;
  }
  await tx.commit();
  console.log(`\nDone. Compressed ${n} farm fields.`);
})().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
