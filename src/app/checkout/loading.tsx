import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";

/**
 * Checkout loading state — shown by App Router as a Suspense fallback
 * while the heavy /checkout client bundle is loading. Without this the
 * navigation from /cart felt blank for a moment ("туго переходить").
 *
 * The skeleton mirrors the actual checkout layout (left form column,
 * right summary rail) so the page swap reads as a continuous render
 * rather than a flash of completely different content.
 */
export default function CheckoutLoading() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
          <div className="h-3 w-24 rounded-full bg-[var(--color-bg-secondary)] mb-10 animate-pulse" />
          <div className="h-14 w-2/3 max-w-xl rounded-full bg-[var(--color-bg-secondary)] mb-4 animate-pulse" />
          <div className="h-4 w-1/2 max-w-lg rounded-full bg-[var(--color-bg-secondary)] mb-16 animate-pulse" />

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left — form skeleton */}
            <div className="lg:col-span-8 flex flex-col gap-10">
              {[1, 2, 3, 4].map((i) => (
                <section key={i}>
                  <div className="h-4 w-32 rounded-full bg-[var(--color-bg-secondary)] mb-5 animate-pulse" />
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="h-10 rounded bg-[var(--color-bg-secondary)] animate-pulse" />
                    <div className="h-10 rounded bg-[var(--color-bg-secondary)] animate-pulse" />
                  </div>
                </section>
              ))}
            </div>

            {/* Right — summary skeleton */}
            <aside className="lg:col-span-4">
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
                <div className="h-3 w-28 rounded-full bg-[var(--color-bg-secondary)] mb-5 animate-pulse" />
                <div className="flex flex-col gap-3">
                  <div className="h-12 rounded bg-[var(--color-bg-secondary)] animate-pulse" />
                  <div className="h-12 rounded bg-[var(--color-bg-secondary)] animate-pulse" />
                </div>
                <div className="h-14 rounded-full bg-[var(--color-bg-secondary)] mt-7 animate-pulse" />
              </div>
            </aside>
          </div>
        </Container>
      </main>
    </>
  );
}
