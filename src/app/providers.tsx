"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactLenis, useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartFlyLayer } from "@/components/cart/cart-fly-layer";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { LoaderOverlay } from "@/components/layout/loader-overlay";
import {
  SearchHotkeys,
  SearchOverlay,
} from "@/components/search/search-overlay";

/**
 * Global client-side providers.
 * - Lenis: smooth scroll (Canyon-level plavnost)
 * - TanStack Query: server state management
 *
 * Keep this file minimal — add heavy providers here only when necessary.
 */
export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Studio routes get a stripped-down provider tree:
  //   - no Lenis (it fights Studio's internal scroll containers)
  //   - no global overlays (cart drawer, search, loader)
  //   - no scroll-reset (Studio handles its own navigation)
  // Everything else still goes through QueryClientProvider so any
  // React-Query usage from Studio plugins (rare but possible) works.
  const isStudio = pathname?.startsWith("/studio");
  if (isStudio) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      }}
    >
      <QueryClientProvider client={queryClient}>
        <LoaderOverlay />
        <ScrollResetOnRouteChange />
        {children}
        {/* Global overlays — mounted once, opened via their respective stores. */}
        <CartDrawer />
        <CartFlyLayer />
        <SearchOverlay />
        <SearchHotkeys />
        <CookieBanner />
      </QueryClientProvider>
    </ReactLenis>
  );
}

/**
 * Resets scroll to the top of the page on every route change.
 *
 * Why this is needed: with Lenis attached to `root`, the smooth scroller
 * keeps its own internal scroll state and overrides the browser's default
 * "scroll to top on navigation" behaviour. Without this, navigating from
 * a long page (e.g. the homepage) into a shorter one (e.g. a category)
 * lands the user wherever they left off — often deep inside the footer
 * because the new page doesn't have content at that scroll position.
 *
 * We listen to `usePathname` only — same-pathname URL changes (e.g. shop
 * filters changing the query string locally) shouldn't yank the user back
 * to the top mid-interaction. The first mount also triggers this effect,
 * which is fine: hard refreshes / fresh loads benefit from starting at 0
 * and we skip the no-op when scroll is already at the top.
 */
function ScrollResetOnRouteChange() {
  const pathname = usePathname();
  const lenis = useLenis();
  // Skip the first effect on the very initial mount so deep-linked anchors
  // (#section) and SSR scroll-restoration aren't fought by us. Subsequent
  // route changes still reset.
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (lenis) {
      // `immediate: true` skips the smooth animation — the user just
      // navigated, they expect a clean page, not a 1s glide.
      lenis.scrollTo(0, { immediate: true });
    } else if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [pathname, lenis]);

  return null;
}
