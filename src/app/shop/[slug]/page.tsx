import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProductDetail } from "@/components/shop/product-detail";
import { getStartingPrice } from "@/data/products";
import { fetchProductBySlug, fetchProducts } from "@/sanity/lib/fetchers";

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

  return (
    <>
      <Header />
      <main className="flex-1">
        <ProductDetail product={product} />
      </main>
      <Footer />
    </>
  );
}
