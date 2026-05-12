import Link from "next/link";
import { Header } from "./header";
import { Footer } from "./footer";
import { Container } from "./container";
import { Reveal } from "@/components/animations/reveal";

interface PageStubProps {
  /** Short overline above the heading */
  kicker?: string;
  /** Main page heading */
  title: string;
  /** Description paragraph under the heading */
  description?: string;
  /** Optional note about the section status */
  status?: string;
}

/**
 * Placeholder page shell — used for route stubs before real content is wired.
 * Replace usages as real pages come online.
 */
export function PageStub({
  kicker = "BATCH",
  title,
  description,
  status = "Сторінка в розробці. Повернись трохи пізніше.",
}: PageStubProps) {
  return (
    <>
      <Header />
      <main className="flex-1 pt-40 lg:pt-48 pb-[var(--section-gap)] min-h-[70vh]">
        <Container>
          <Reveal>
            <span className="text-xs tracking-[0.25em] uppercase text-[var(--color-text-muted)]">
              {kicker}
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,4.5rem)] leading-[1] tracking-[-0.045em] mt-6 max-w-4xl">
              {title}
            </h1>
          </Reveal>
          {description && (
            <Reveal delay={0.2}>
              <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed mt-8 max-w-2xl">
                {description}
              </p>
            </Reveal>
          )}
          <Reveal delay={0.3}>
            <div className="mt-16 pt-10 border-t border-[var(--color-border-default)] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <span className="text-xs tracking-[0.2em] uppercase text-[var(--color-text-muted)]">
                {status}
              </span>
              <Link
                href="/"
                className="text-sm border-b border-[var(--color-text-primary)] pb-1 hover:opacity-60 transition-opacity duration-300 self-start"
              >
                ← На головну
              </Link>
            </div>
          </Reveal>
        </Container>
      </main>
      <Footer />
    </>
  );
}
