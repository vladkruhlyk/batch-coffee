import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeBanners } from "@/components/home/banners";
import { HomeCategories } from "@/components/home/categories";
import { HomeBestsellers } from "@/components/home/bestsellers";
import { HomeNewsletter } from "@/components/home/newsletter";
import {
  fetchBanners,
  fetchCategories,
  fetchProducts,
} from "@/sanity/lib/fetchers";

/**
 * Homepage — onelove-style commerce focus.
 *
 * Now a server component: fetches banners, categories, and the full
 * product list from Sanity at request time (with 60s ISR + on-demand
 * revalidation), then hands the data to client components for rendering.
 * Editorial sections (journal / about / subscription / visit) live on
 * dedicated routes and are reached via header / footer / burger.
 */

// ISR fallback — even if the webhook fails, content goes stale at most
// once a minute.
export const revalidate = 60;

export default async function HomePage() {
  const [banners, categories, products] = await Promise.all([
    fetchBanners(),
    fetchCategories(),
    fetchProducts(),
  ]);

  // Bestsellers — keep the existing "Bestseller" badge filter, but pulled
  // from Sanity now. If the editor flags more or fewer items, the strip
  // adapts automatically without a redeploy.
  const bestsellers = products.filter((p) => p.badge === "Bestseller").slice(0, 6);

  return (
    <>
      <Header />
      <main className="flex-1">
        <HomeBanners banners={banners} />

        <HomeCategories categories={categories} />

        <HomeBestsellers products={bestsellers} />

        <HomeNewsletter />
      </main>
      <Footer />
    </>
  );
}
