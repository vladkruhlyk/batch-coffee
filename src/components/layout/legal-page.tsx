import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export interface LegalSection {
  /** Anchor id — used by the in-page sidebar nav. */
  id: string;
  title: string;
  /** Paragraphs / sub-headings. Markdown isn't supported — use plain text and
   *  bullet arrays via the optional `items` field for lists. */
  blocks: Array<
    | { kind: "p"; text: string }
    | { kind: "h3"; text: string }
    | { kind: "list"; items: string[] }
  >;
}

interface LegalPageProps {
  kicker: string;
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}

/**
 * Shared layout for the static legal pages (privacy / terms).
 *
 * Two-column on desktop: in-page sidebar with section anchors, prose on
 * the right. Long-form readable type, generous line-height, the same
 * editorial typography rules we use across the rest of the site.
 */
export function LegalPage({
  kicker,
  title,
  updatedAt,
  intro,
  sections,
}: LegalPageProps) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> На головну
          </Link>

          <header className="mb-12 lg:mb-16 max-w-3xl">
            <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
              {kicker}
            </span>
            <h1 className="mt-4 font-display font-semibold text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]">
              {title}
            </h1>
            <p className="mt-7 text-base lg:text-lg leading-relaxed text-[var(--color-text-secondary)] max-w-2xl">
              {intro}
            </p>
            <p className="mt-6 text-[11px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
              Останнє оновлення · {updatedAt}
            </p>
          </header>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Sticky TOC */}
            <aside className="hidden lg:block lg:col-span-3">
              <nav className="sticky top-28">
                <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] mb-4">
                  Розділи
                </p>
                <ol className="flex flex-col gap-1">
                  {sections.map((s, i) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="flex items-baseline gap-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <span className="font-display text-[var(--color-text-muted)] tabular-nums shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="leading-snug">{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            {/* Prose */}
            <article className="lg:col-span-9 max-w-3xl">
              {sections.map((section, i) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="mb-14 last:mb-0 scroll-mt-32"
                >
                  <div className="flex items-baseline gap-4 mb-6">
                    <span className="font-display text-sm text-[var(--color-text-muted)] tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-[-0.025em]">
                      {section.title}
                    </h2>
                  </div>
                  <div className="flex flex-col gap-5">
                    {section.blocks.map((b, j) => {
                      if (b.kind === "p") {
                        return (
                          <p
                            key={j}
                            className="text-base lg:text-[17px] leading-[1.75] text-[var(--color-text-secondary)]"
                          >
                            {b.text}
                          </p>
                        );
                      }
                      if (b.kind === "h3") {
                        return (
                          <h3
                            key={j}
                            className="font-display text-lg lg:text-xl font-semibold mt-4"
                          >
                            {b.text}
                          </h3>
                        );
                      }
                      return (
                        <ul
                          key={j}
                          className="flex flex-col gap-2 pl-5 list-disc text-[var(--color-text-secondary)] text-base lg:text-[17px] leading-[1.75] marker:text-[var(--color-text-muted)]"
                        >
                          {b.items.map((it, k) => (
                            <li key={k}>{it}</li>
                          ))}
                        </ul>
                      );
                    })}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
