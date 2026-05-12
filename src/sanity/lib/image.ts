import createImageUrlBuilder from "@sanity/image-url";
import { dataset, projectId } from "../env";

/** Sanity image reference — kept loose because the package's types module
 *  isn't exposed directly. The builder accepts both object refs and asset
 *  documents, so we don't enforce a stricter shape here. */
type SanityImageSource = Parameters<
  ReturnType<typeof createImageUrlBuilder>["image"]
>[0];

/**
 * Image URL builder — turns a Sanity image reference into a CDN URL with
 * on-the-fly transforms. Usage:
 *
 *   urlFor(banner.image).width(1600).auto("format").url()
 *
 * Combined with next/image, this gives us responsive, optimised delivery
 * without any extra ops — Sanity hosts the asset, applies the transforms,
 * Vercel caches the result at the edge.
 */
const builder = createImageUrlBuilder({ projectId, dataset });

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
