import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";

/**
 * Sanity webhook → on-demand cache revalidation.
 *
 * Sanity posts here whenever a document is published / unpublished /
 * deleted. We use the document type as the cache tag — that matches the
 * tags the fetchers use, so e.g. publishing a banner invalidates every
 * banner-tagged fetch on Vercel's edge cache.
 *
 * Security: the request is signed with a shared secret (SANITY_WEBHOOK_SECRET
 * env). `parseBody` validates the signature; if it fails we 401 and the
 * cache stays as-is.
 *
 * Setup (in Sanity Manage):
 *   API → Webhooks → Create webhook
 *     Name:     Revalidate Next.js
 *     URL:      https://<your-domain>/api/revalidate
 *     Dataset:  production
 *     Trigger on: Create, Update, Delete
 *     Filter:   _type in ["product","banner","category","brewGuide","journalPost","siteSettings","promoCode"]
 *     Projection: { "_type": _type, "slug": slug.current }
 *     Secret:   (paste the same value as SANITY_WEBHOOK_SECRET)
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.SANITY_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Missing SANITY_WEBHOOK_SECRET" },
        { status: 500 },
      );
    }

    const { isValidSignature, body } = await parseBody<{
      _type?: string;
      slug?: string;
    }>(req, secret);

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    if (!body?._type) {
      return NextResponse.json(
        { error: "No _type in payload" },
        { status: 400 },
      );
    }

    // Always purge the type-wide tag. If the payload carries a slug
    // (mostly does — see Projection in setup), purge the per-doc tag too.
    // Next 16 expects an explicit profile arg — "max" pings every cached
    // entry tied to the tag, which is what we want for content updates.
    revalidateTag(body._type, "max");
    if (body.slug) revalidateTag(`${body._type}:${body.slug}`, "max");

    return NextResponse.json({
      revalidated: true,
      type: body._type,
      slug: body.slug ?? null,
    });
  } catch (err) {
    console.error("Revalidate webhook error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
