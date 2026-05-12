"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Container } from "@/components/layout/container";

/**
 * Top-level error boundary — Next.js renders this when any route segment
 * throws an unhandled error during render. Falls back from the broken
 * route segment but keeps the rest of the app shell intact.
 *
 * We don't render Header / Footer here because those are server
 * components that themselves could be the source of the error; rendering
 * them in the fallback would risk an infinite error loop.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log to console — in prod this goes to the Vercel runtime logs.
  // Real fix: send to Sentry / Posthog when those are wired.
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      <Container
        size="default"
        className="flex-1 flex flex-col items-center justify-center py-24 text-center"
      >
        <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
          Щось пішло не так
        </span>
        <h1 className="mt-5 font-display font-semibold text-[clamp(1.75rem,4vw,3rem)] leading-[1.05] tracking-[-0.035em] max-w-2xl">
          У нас на хвильку зламалось.
        </h1>
        <p className="mt-5 text-[var(--color-text-secondary)] leading-relaxed max-w-md">
          Ми вже знаємо про помилку. Спробуй оновити сторінку — найчастіше
          допомагає. Якщо ні — напиши нам.
        </p>

        {error.digest && (
          <p className="mt-4 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] tabular-nums">
            Код помилки: {error.digest}
          </p>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3.5 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
          >
            <RefreshCw className="h-4 w-4" />
            Спробувати знову
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm tracking-[0.12em] uppercase pb-1 border-b border-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
          >
            На головну
          </Link>
        </div>
      </Container>
    </main>
  );
}
