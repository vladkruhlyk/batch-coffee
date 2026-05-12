import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import type { JournalBlock, JournalPost } from "@/data/journal";
import {
  fetchJournalPostBySlug,
  fetchJournalPosts,
} from "@/sanity/lib/fetchers";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchJournalPostBySlug(slug);
  if (!post) return { title: "Journal — BATCH Coffee" };
  return {
    title: `${post.title} — Journal — BATCH Coffee`,
    description: post.excerpt,
  };
}

export async function generateStaticParams() {
  const posts = await fetchJournalPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

/**
 * Journal article — long-form editorial with prose blocks, headings,
 * quotes, lists and image placeholders.
 *
 * Body is a typed `JournalBlock[]` so we can render each block kind in a
 * way that respects the brand typography. Source is Sanity now; the
 * adapter maps Portable Text back into our block shape.
 */
export default async function JournalPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await fetchJournalPostBySlug(slug);
  if (!post) notFound();

  // Resolve `related` slugs to full post objects — the adapter returns
  // just slugs, so we look up siblings in the full posts list.
  const allPosts = await fetchJournalPosts();
  const related: JournalPost[] = (post.related ?? [])
    .map((s) => allPosts.find((p) => p.slug === s))
    .filter((p): p is JournalPost => p !== undefined);

  return (
    <>
      <Header />
      <main className="flex-1">
        <article>
          {/* Hero — full-bleed gradient cover with title + meta */}
          <header
            className="relative overflow-hidden pt-32 lg:pt-44 pb-16 lg:pb-24"
            style={{ backgroundImage: post.gradient }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
            <Container size="default" className="relative text-white">
              <Link
                href="/journal"
                className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-white/70 hover:text-white transition-colors mb-8"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Журнал
              </Link>
              <span className="text-[11px] tracking-[0.3em] uppercase text-white/70">
                {post.category}
              </span>
              <h1 className="mt-5 font-display font-semibold text-[clamp(2rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.04em] max-w-3xl">
                {post.title}
              </h1>
              <p className="mt-5 text-white/80 leading-relaxed max-w-2xl text-lg">
                {post.excerpt}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] tracking-[0.22em] uppercase text-white/65">
                <span>{post.author}</span>
                <span aria-hidden>·</span>
                <span>{post.date}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-3 w-3" /> {post.readTime}
                </span>
              </div>
            </Container>
          </header>

          {/* Body */}
          <Container size="default" className="py-16 lg:py-24">
            <div className="max-w-2xl mx-auto flex flex-col gap-7 lg:gap-8">
              {post.body.map((block, i) => (
                <BlockRenderer key={i} block={block} />
              ))}
            </div>
          </Container>

          {/* Related */}
          {related.length > 0 && (
            <section className="bg-[var(--color-bg-secondary)] py-16 lg:py-24">
              <Container size="wide">
                <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-10">
                  Читати далі
                </h2>
                <div className="grid sm:grid-cols-2 gap-5 lg:gap-8">
                  {related.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/journal/${p.slug}`}
                      className="group flex flex-col overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] transition-colors"
                    >
                      <div
                        className="relative aspect-[16/9] overflow-hidden"
                        style={{ backgroundImage: p.gradient }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                        <span className="absolute top-5 left-5 text-[11px] tracking-[0.3em] uppercase text-white/85">
                          {p.category}
                        </span>
                      </div>
                      <div className="p-6 lg:p-7">
                        <h3 className="font-display text-xl lg:text-2xl font-semibold tracking-[-0.02em] group-hover:opacity-70 transition-opacity">
                          {p.title}
                        </h3>
                        <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                          {p.excerpt}
                        </p>
                        <div className="mt-5 inline-flex items-center gap-3 text-[11px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
                          <span>{p.date}</span>
                          <span aria-hidden>·</span>
                          <span>{p.readTime}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Container>
            </section>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}

/**
 * Render one body block. Each kind gets its own typography treatment so
 * the article feels editorial rather than a flat wall of text.
 */
function BlockRenderer({ block }: { block: JournalBlock }) {
  switch (block.kind) {
    case "p":
      return (
        <p className="text-base lg:text-lg leading-[1.75] text-[var(--color-text-secondary)]">
          {block.text}
        </p>
      );
    case "h2":
      return (
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-[-0.025em] mt-6">
          {block.text}
        </h2>
      );
    case "quote":
      return (
        <figure className="border-l-2 border-[var(--color-text-primary)] pl-6 lg:pl-8 my-6">
          <blockquote className="font-display text-xl lg:text-2xl leading-snug text-[var(--color-text-primary)] tracking-[-0.015em]">
            «{block.text}»
          </blockquote>
          {block.author && (
            <figcaption className="mt-4 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
              — {block.author}
            </figcaption>
          )}
        </figure>
      );
    case "list":
      return (
        <ul className="flex flex-col gap-3 ml-2">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-4 text-base lg:text-lg leading-relaxed text-[var(--color-text-secondary)]"
            >
              <span
                className="font-display text-[var(--color-text-muted)] tabular-nums shrink-0"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "image":
      return (
        <figure className="my-2">
          <div
            className="relative overflow-hidden rounded-[var(--radius-xl)] aspect-[16/10]"
            style={{ backgroundImage: block.gradient }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.1] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />
          </div>
          {block.caption && (
            <figcaption className="mt-3 text-xs text-[var(--color-text-muted)] text-center">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
  }
}
