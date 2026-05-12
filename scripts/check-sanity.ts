import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-11-01",
  useCdn: false,
});

(async () => {
  const counts = await client.fetch<Record<string, number>>(`{
    "products": count(*[_type == "product"]),
    "banners": count(*[_type == "banner"]),
    "categories": count(*[_type == "category"]),
    "brewGuides": count(*[_type == "brewGuide"]),
    "journalPosts": count(*[_type == "journalPost"]),
    "siteSettings": count(*[_type == "siteSettings"])
  }`);
  console.log("Sanity dataset state:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
