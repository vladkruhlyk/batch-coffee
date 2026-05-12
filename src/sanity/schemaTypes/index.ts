import type { SchemaTypeDefinition } from "sanity";
import { product } from "./product";
import { banner } from "./banner";
import { category } from "./category";
import { brewGuide } from "./brewGuide";
import { journalPost } from "./journalPost";
import { siteSettings } from "./siteSettings";

/**
 * Registry of all schema types exposed to Sanity Studio. Add new schemas
 * here to surface them in the desk.
 */
export const schema: { types: SchemaTypeDefinition[] } = {
  types: [product, banner, category, brewGuide, journalPost, siteSettings],
};
