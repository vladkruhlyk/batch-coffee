import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SectionKicker } from "@/components/layout/section-kicker";
import { fetchBrewGuides } from "@/sanity/lib/fetchers";

export const metadata: Metadata = {
  title: "Brew Guide — BATCH Coffee",
  description:
    "Покрокові гайди по заварюванню: V60, Аеропрес, Chemex, френч-прес, еспресо, Moka.",
};

export const revalidate = 60;

/**
 * Brew Guide index — grid of brewing methods with quick params at a glance.
 *
 * Each tile shows the method's gradient placeholder, name, tagline, and a
 * compact spec row (ratio · grind · t°). Tap → detail page with full steps.
 * Mirrors the visual rhythm of /shop adapted for editorial content rather
 * than commerce.
 */
export default async function BrewGuidePage() {
  const BREW_GUIDES = await fetchBrewGuides();
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
          {/* Hero */}
          <header className="grid lg:grid-cols-12 gap-8 mb-16 lg:mb-24">
            <div className="lg:col-span-8">
              <SectionKicker label="Brew Guide" />
              <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,4.25rem)] leading-[1.02] tracking-[-0.04em] mt-10">
                Як заварити так, щоб чашка
                <span className="block text-[var(--color-text-secondary)] font-medium">
                  говорила сама за себе.
                </span>
              </h1>
            </div>
            <div className="lg:col-span-4 lg:col-start-9 lg:pt-6">
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Покрокові гайди для шести найпопулярніших методів. З таймерами,
                рецептами і поясненнями — щоб кожна чашка вдалась навіть зранку
                в понеділок.
              </p>
            </div>
          </header>

          {/* Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7">
            {BREW_GUIDES.map((guide) => (
              <Link
                key={guide.slug}
                href={`/brew-guide/${guide.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] transition-colors hover:border-[var(--color-border-strong)]"
              >
                {/* Top image area */}
                <div
                  className="relative aspect-[4/3] overflow-hidden bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: guide.gradient }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-[0.1] mix-blend-overlay"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                    }}
                  />
                  <span className="absolute top-4 left-4 inline-flex items-center rounded-full bg-[var(--color-bg-primary)]/95 px-3.5 py-1.5 text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-primary)] backdrop-blur-sm">
                    {guide.totalTime}
                  </span>
                </div>

                {/* Body */}
                <div className="flex flex-col flex-1 p-6 lg:p-7">
                  <h3 className="font-display text-xl lg:text-2xl font-semibold tracking-[-0.02em]">
                    {guide.name}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {guide.tagline}
                  </p>

                  <dl className="mt-5 pt-5 border-t border-[var(--color-border-default)] grid grid-cols-3 gap-3 text-xs">
                    <SpecCell label="Пропорція" value={guide.ratio} />
                    <SpecCell label="Помел" value={guide.grind} />
                    <SpecCell label="t°" value={guide.waterTemp} />
                  </dl>

                  <span className="mt-auto pt-6 inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-primary)] group-hover:opacity-60 transition-opacity">
                    Дивитись гайд <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 font-display font-medium tabular-nums truncate">
        {value}
      </dd>
    </div>
  );
}
