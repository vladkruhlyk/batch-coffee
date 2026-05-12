import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Coffee, Droplets, Thermometer, Timer } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { fetchBrewGuideBySlug, fetchBrewGuides } from "@/sanity/lib/fetchers";

interface PageProps {
  params: Promise<{ method: string }>;
}

export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { method } = await params;
  const guide = await fetchBrewGuideBySlug(method);
  if (!guide) return { title: "Brew Guide — BATCH Coffee" };
  return {
    title: `${guide.name} — Brew Guide — BATCH Coffee`,
    description: guide.tagline,
  };
}

/** Pre-render all currently published brewing methods at build time. New
 *  guides added later are still reachable via on-demand revalidation +
 *  dynamicParams fallback. */
export async function generateStaticParams() {
  const guides = await fetchBrewGuides();
  return guides.map((g) => ({ method: g.slug }));
}

/**
 * Brew method detail page — hero with spec grid, full step-by-step list,
 * and a tips block at the bottom.
 *
 * Step numbering uses the editorial N°01 kicker we already use on the
 * homepage / checkout, so the visual ritual is consistent. Time markers
 * appear inline rather than as a separate column — easier to scan when
 * you're holding a kettle in the other hand.
 */
export default async function BrewMethodPage({ params }: PageProps) {
  const { method } = await params;
  const guide = await fetchBrewGuideBySlug(method);
  if (!guide) notFound();
  // Sibling guides for the "Інші методи" strip — exclude current.
  const BREW_GUIDES = await fetchBrewGuides();

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container size="default" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
          {/* Back link */}
          <Link
            href="/brew-guide"
            className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Усі гайди
          </Link>

          {/* Hero card with gradient + name */}
          <div
            className="relative overflow-hidden rounded-[var(--radius-2xl)] aspect-[16/9] lg:aspect-[21/9] mb-10 lg:mb-14"
            style={{ backgroundImage: guide.gradient }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-end p-8 lg:p-14 text-white">
              <div>
                <span className="text-[11px] tracking-[0.3em] uppercase text-white/70">
                  Brew Guide
                </span>
                <h1 className="mt-3 font-display font-semibold text-[clamp(2rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.04em]">
                  {guide.name}
                </h1>
                <p className="mt-3 max-w-xl text-white/85 leading-relaxed">
                  {guide.tagline}
                </p>
              </div>
            </div>
          </div>

          {/* Spec grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 mb-14 lg:mb-20">
            <Spec
              icon={<Coffee className="h-4 w-4" />}
              label="Пропорція"
              value={guide.ratio}
            />
            <Spec
              icon={<Droplets className="h-4 w-4" />}
              label="Помел"
              value={guide.grind}
            />
            <Spec
              icon={<Thermometer className="h-4 w-4" />}
              label="Температура"
              value={guide.waterTemp}
            />
            <Spec
              icon={<Timer className="h-4 w-4" />}
              label="Час"
              value={guide.totalTime}
            />
          </section>

          {/* Intro */}
          <p className="text-lg lg:text-xl leading-relaxed text-[var(--color-text-secondary)] max-w-2xl mb-14 lg:mb-20">
            {guide.intro}
          </p>

          {/* Steps */}
          <section className="mb-14 lg:mb-20">
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-8">
              Покроковий рецепт
            </h2>
            <ol className="flex flex-col gap-5">
              {guide.steps.map((step, i) => (
                <li
                  key={i}
                  className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-8 flex flex-col sm:flex-row gap-5 lg:gap-8"
                >
                  <div className="sm:w-32 shrink-0">
                    <span className="font-display text-xs text-[var(--color-text-muted)] tabular-nums block">
                      N°{String(i + 1).padStart(2, "0")}
                    </span>
                    {step.time && (
                      <span className="mt-2 inline-flex items-center text-[10px] tracking-[0.22em] uppercase rounded-full px-2.5 py-1 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] tabular-nums">
                        {step.time}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-xl lg:text-2xl font-semibold tracking-[-0.02em]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-[var(--color-text-secondary)] leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Tips */}
          <section className="rounded-[var(--radius-2xl)] bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)] p-7 lg:p-10">
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/55 mb-7">
              Поради
            </h2>
            <ul className="flex flex-col gap-4">
              {guide.tips.map((tip, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    className="font-display text-sm text-white/45 tabular-nums shrink-0 mt-1"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-base lg:text-lg text-white/85 leading-relaxed">
                    {tip}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Related — other methods */}
          <section className="mt-16 lg:mt-24">
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-8">
              Інші методи
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {BREW_GUIDES.filter((g) => g.slug !== guide.slug)
                .slice(0, 3)
                .map((g) => (
                  <Link
                    key={g.slug}
                    href={`/brew-guide/${g.slug}`}
                    className="group flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-4 hover:border-[var(--color-text-primary)] transition-colors"
                  >
                    <span
                      aria-hidden
                      className="block h-12 w-12 shrink-0 rounded-[var(--radius-md)]"
                      style={{ backgroundImage: g.gradient }}
                    />
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold leading-tight truncate group-hover:opacity-70 transition-opacity">
                        {g.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)] tabular-nums truncate">
                        {g.ratio} · {g.totalTime}
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function Spec({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5">
      <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
        <span className="text-[var(--color-text-primary)]">{icon}</span>
        {label}
      </span>
      <p className="mt-3 font-display text-lg lg:text-xl font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
