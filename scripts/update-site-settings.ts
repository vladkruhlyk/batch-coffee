/**
 * One-shot patch for the singleton Sanity `siteSettings` document.
 *
 * Edits the address, hours, phone, and Instagram URL to match the real
 * business info. Idempotent: re-runs overwrite the same fields. The
 * Studio UI is fine for one-off edits, but a script keeps the change
 * in git so we know when the canonical contact info moved.
 *
 *   cd web && npx tsx scripts/update-site-settings.ts
 */
import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-11-01",
  token: process.env.SANITY_API_TOKEN!,
  useCdn: false,
});

const patch = {
  address: "Полтава, вул. Соборності, 27",
  hours: "Пн–Нд · 08:00–20:00",
  contactPhone: "+380 99 07 00 041",
  instagram: "https://www.instagram.com/batch.coffee.roasters/",
};

(async () => {
  // The singleton siteSettings document lives at a stable id we
  // bootstrapped during migration. Find it (only one should exist)
  // and patch fields in place.
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "siteSettings"][0]{ _id }`,
  );

  if (existing) {
    await client.patch(existing._id).set(patch).commit();
    console.log(`Patched siteSettings (${existing._id}):`);
  } else {
    const created = await client.create({
      _type: "siteSettings",
      ...patch,
    });
    console.log(`Created siteSettings (${created._id}):`);
  }
  console.dir(patch, { depth: null });
})();
