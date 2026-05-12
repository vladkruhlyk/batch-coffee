import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ShopCatalog } from "@/components/shop/catalog";
import { CATEGORIES, type CategoryKey } from "@/data/products";
import { fetchProducts } from "@/sanity/lib/fetchers";

export const metadata: Metadata = {
  title: "Каталог — BATCH Coffee",
  description: "Уся наша свіжообсмажена кава — еспресо, фільтр, капсули.",
};

// ISR fallback — webhook handles instant updates; this is the safety net.
export const revalidate = 60;

/** Whitelist of valid category slugs — used to reject unknown `?category=`
 *  values (e.g. "grinders" from the homepage tiles that don't have a real
 *  category yet). Keeps the deep-link defensive. */
const VALID_CATEGORIES = new Set<CategoryKey>(CATEGORIES.map((c) => c.key));

function parseCategoryParam(raw: string | string[] | undefined): CategoryKey[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : raw.split(",");
  return values.filter((v): v is CategoryKey =>
    VALID_CATEGORIES.has(v as CategoryKey),
  );
}

interface PageProps {
  searchParams: Promise<{ category?: string | string[] }>;
}

export default async function ShopPage({ searchParams }: PageProps) {
  const { category } = await searchParams;
  const products = await fetchProducts();
  const initialCategories = parseCategoryParam(category);

  // Key the catalog by the URL category list. When the user navigates
  // /shop → /shop?category=drip (e.g. picking a category from the search
  // overlay), Next App Router does a soft re-render: ShopCatalog gets the
  // new prop, but its `useState` lazy init only runs on mount, so without a
  // key the seeded `filters.categories` would never refresh. The key forces
  // a clean remount that picks up the new URL state.
  const catalogKey = initialCategories.length
    ? initialCategories.slice().sort().join(",")
    : "all";

  return (
    <>
      <Header />
      <main className="flex-1">
        <ShopCatalog
          key={catalogKey}
          products={products}
          initialCategories={initialCategories}
        />
      </main>
      <Footer />
    </>
  );
}
