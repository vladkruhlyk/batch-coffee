import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Container } from "@/components/layout/container";

/**
 * Custom 404 page — rendered by Next.js whenever a route or dynamic
 * `notFound()` call doesn't resolve. Keeps the visitor in our visual
 * world (Header / Footer / brand type) with three concrete next-actions
 * instead of the generic Next default.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container
          size="default"
          className="pt-36 lg:pt-44 pb-24 text-center min-h-[60vh] flex flex-col items-center justify-center"
        >
          <span className="font-display text-[clamp(6rem,18vw,12rem)] font-semibold leading-none text-[var(--color-text-muted)] tabular-nums">
            404
          </span>
          <h1 className="mt-6 font-display font-semibold text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.05] tracking-[-0.035em]">
            Тут чашка не знайдена.
          </h1>
          <p className="mt-5 text-[var(--color-text-secondary)] leading-relaxed max-w-md">
            Сторінка, яку шукаєш, не існує або зникла з полиці. Спробуй
            щось з пропозицій нижче.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3.5 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
            >
              На головну
            </Link>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-sm tracking-[0.12em] uppercase pb-1 border-b border-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
            >
              У каталог
            </Link>
            <Link
              href="/contacts"
              className="inline-flex items-center gap-2 text-sm tracking-[0.12em] uppercase pb-1 border-b border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)] transition-colors"
            >
              Написати нам
            </Link>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
