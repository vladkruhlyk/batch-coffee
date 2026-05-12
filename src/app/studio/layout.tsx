import type { ReactNode } from "react";

/**
 * Studio layout — bypasses the site's Header / Footer / Providers and
 * gives Sanity Studio full control over the viewport. Studio renders
 * its own header + sidebar + global navigation, so any of ours would
 * fight it.
 *
 * We also block robots here so the admin panel never lands in search
 * results.
 */
export const metadata = {
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
