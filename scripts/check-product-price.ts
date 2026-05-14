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
  const slug = process.argv[2] ?? "ethiopia-sidamo";
  const product = await client.fetch(
    `*[_type == "product" && slug.current == $slug][0]{
      name, "slug": slug.current, weights
    }`,
    { slug },
  );
  console.log(`Sanity product '${slug}':`);
  console.dir(product, { depth: null });
})();
