import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProductDetail } from "@/components/shop/product-detail";
import { getStartingPrice } from "@/data/products";
import { fetchProductBySlug, fetchProducts } from "@/sanity/lib/fetchers";
import { SITE_URL } from "@/lib/site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ISR fallback — webhook handles instant updates per-slug.
export const revalidate = 60;

export async function generateStaticParams() {
  const products = await fetchProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return {
      title: "Кава не знайдена — BATCH Coffee",
    };
  }

  return {
    title: `${product.name} — BATCH Coffee`,
    description: `${product.shortDescription}${product.notes?.length ? ` ${product.notes.join(", ")}.` : ""} Від ${getStartingPrice(product)} ₴.`,
    openGraph: {
      title: `${product.name} · BATCH Coffee`,
      description: product.shortDescription,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // JSON-LD structured data — lets Google show our products in Shopping
  // results, rich cards, and price snippets. Generated server-side so
  // crawlers pick it up without needing to execute JS.
  const startingPrice = getStartingPrice(product);
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    sku: product.slug,
    brand: { "@type": "Brand", name: "BATCH Coffee Roastery" },
    category: product.category,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/shop/${product.slug}`,
      priceCurrency: "UAH",
      price: startingPrice,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- structured data is
          // a serialised object; we control the input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
        />
        <ProductDetail product={product} />
      </main>
      <Footer />
    </>
  );
}
