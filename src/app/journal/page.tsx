import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Container } from "@/components/layout/container";
import { SectionKicker } from "@/components/layout/section-kicker";
import { fetchJournalPosts } from "@/sanity/lib/fetchers";

export const metadata: Metadata = {
  title: "Journal — BATCH Coffee",
  description: "Історії ферм, гайди по заварюванню, основи спешіалті кави.",
};

export const revalidate = 60;

/** Repeating tile sizes for the offset grid. Three values — one per
 *  column — repeat through the post list to keep the editorial feel
 *  from the previous static implementation, regardless of post count. */
const OFFSETS = ["lg:mt-0", "lg:mt-48", "lg:mt-24"] as const;
const ASPECTS = ["aspect-[3/4]", "aspect-[4/5]", "aspect-[3/4]"] as const;

export default async function JournalPage() {
  const posts = await fetchJournalPosts();

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative py-[var(--section-gap)] bg-[var(--color-bg-primary)] overflow-hidden pt-32 lg:pt-44">
          <Container size="wide">
            {/* Hero */}
            <div className="grid lg:grid-cols-12 gap-8 mb-20 lg:mb-28">
              <div className="lg:col-span-8">
                <SectionKicker label="Журнал" />
                <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,4.5rem)] leading-[1] tracking-[-0.045em] mt-10 max-w-4xl">
                  Те, що варто читати
                  <span className="block font-medium text-[var(--color-text-secondary)] mt-1">
                    з чашкою в руці.
                  </span>
                </h1>
              </div>
            </div>

            {posts.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Offset grid — first 3 keep the original visual rhythm.
                    Everything from #4 onwards falls into a regular 3-col
                    grid below so the page scales as the journal grows. */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-14">
                  {posts.slice(0, 3).map((post, i) => (
                    <div key={post.slug} className={OFFSETS[i]}>
                      <JournalCard
                        slug={post.slug}
                        title={post.title}
                        excerpt={post.excerpt}
                        category={post.category}
                        date={post.date}
                        readTime={post.readTime}
                        gradient={post.gradient}
                        aspect={ASPECTS[i]}
                        index={i}
                      />
                    </div>
                  ))}
                </div>

                {posts.length > 3 && (
                  <div className="mt-24 lg:mt-32 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
                    {posts.slice(3).map((post, i) => (
                      <JournalCard
                        key={post.slug}
                        slug={post.slug}
                        title={post.title}
                        excerpt={post.excerpt}
                        category={post.category}
                        date={post.date}
                        readTime={post.readTime}
                        gradient={post.gradient}
                        aspect="aspect-[4/5]"
                        index={i + 3}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Bottom running signature */}
            <div className="mt-24 lg:mt-32 pt-8 border-t border-[var(--color-border-default)] flex flex-col md:flex-row md:items-baseline justify-between gap-3 text-[10px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
              <span>Journal · BATCH</span>
              <span className="font-display text-xs">BATCH Coffee Roastery</span>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

function JournalCard({
  slug,
  title,
  excerpt,
  category,
  date,
  readTime,
  gradient,
  aspect,
  index,
}: {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  gradient: string;
  aspect: string;
  index: number;
}) {
  return (
    <Link href={`/journal/${slug}`} className="group block">
      <div
        className={`relative ${aspect} overflow-hidden bg-[var(--color-bg-secondary)] mb-7 rounded-[var(--radius-xl)]`}
      >
        <div
          aria-hidden
          className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]"
          style={{ backgroundImage: gradient }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        {/* Category top */}
        <div className="absolute top-5 left-5 right-5 flex items-center justify-between text-white/90">
          <span className="text-[10px] tracking-[0.3em] uppercase border border-white/30 px-3 py-1.5 backdrop-blur-sm rounded-full">
            {category}
          </span>
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/50 font-display">
            N°{String(index + 1).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] mb-4">
        <span>{date}</span>
        <span
          className="block w-6 h-px bg-[var(--color-border-strong)]"
          aria-hidden
        />
        <span>{readTime}</span>
      </div>

      <h3 className="font-display font-semibold text-2xl lg:text-[32px] leading-[1.05] tracking-[-0.02em] mb-4 group-hover:opacity-60 transition-opacity duration-300">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {excerpt}
      </p>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-2xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-20 px-6 text-center">
      <p className="font-display text-2xl font-semibold">
        Журнал поки порожній.
      </p>
      <p className="mt-3 text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
        Перші статті готуються — пиши на email щоб дізнатись першим про
        новини або підпишись на розсилку внизу.
      </p>
    </div>
  );
}
