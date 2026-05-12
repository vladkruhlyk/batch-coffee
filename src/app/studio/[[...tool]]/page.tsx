/**
 * Sanity Studio host route — mounts the Studio UI at `/studio/*`.
 *
 * The catch-all (`[[...tool]]`) lets Studio's internal routing (deep links
 * to documents, tools, etc.) live under this single Next route without us
 * declaring each path manually.
 *
 * Studio is a heavy client-side component — we disable forced dynamic
 * rendering caveats with the export below, and the page itself opts out
 * of any server-side fetching.
 */

import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";

export const dynamic = "force-static";

export const metadata = {
  title: "BATCH Studio",
  // Studio handles its own meta — keep the route un-noindex'd from
  // search engines via the layout, not here.
};

export default function StudioPage() {
  return <NextStudio config={config} />;
}
