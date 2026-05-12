"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { Container } from "@/components/layout/container";
import { SectionKicker } from "@/components/layout/section-kicker";
import { WordReveal } from "@/components/animations/word-reveal";
import { Reveal } from "@/components/animations/reveal";
import { EASING } from "@/lib/easing";

/**
 * Newsletter signup — third section on the homepage.
 *
 * Visually distinct from the cream-toned Categories + Bestsellers above:
 * a dark rounded panel that breaks the rhythm and signals "this is an
 * invitation, not a product list." Lives inside the normal section padding
 * so it reads as part of the page flow, not a full-bleed banner.
 *
 * The form is client-only for now — captures email locally and flips to
 * a success state. Wire to an API (/api/newsletter) once the backend
 * endpoint exists; the submit handler is the single seam.
 *
 * Validation is intentionally minimal — rely on the browser's native
 * `type="email"` + `required` so the feel stays lightweight. If the
 * backend needs stricter checks (DNS lookup, dedupe) do it server-side.
 */
export function HomeNewsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state !== "idle") return;
    setState("submitting");
    // TODO(batch): POST to /api/newsletter. Simulated latency for UX polish
    // so the success state doesn't snap in instantly.
    await new Promise((r) => setTimeout(r, 550));
    setState("done");
  };

  return (
    <section className="relative py-[var(--section-gap)] bg-[var(--color-bg-primary)]">
      <Container size="wide">
        <Reveal y={40} duration={0.9}>
          <div className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)] px-7 py-14 sm:px-12 sm:py-16 lg:px-20 lg:py-24">
            {/* Decorative radial highlight — warm wash in the top-right,
                echoes the banner splash art without stealing focus. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse at 85% 20%, rgba(201,144,86,0.28) 0%, transparent 55%)",
              }}
            />
            {/* Grain — consistent with category tiles / banner fallback. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />

            <div className="relative grid lg:grid-cols-12 gap-10 lg:gap-16 items-end">
              {/* Headline side */}
              <div className="lg:col-span-7">
                <Reveal>
                  <SectionKicker number="03" label="Розсилка" inverse />
                </Reveal>
                <h2 className="font-display font-semibold text-[clamp(1.875rem,4.2vw,4rem)] leading-[1] tracking-[-0.045em] mt-10 max-w-2xl">
                  <WordReveal duration={1} stagger={0.07}>
                    Перші, хто дізнається
                  </WordReveal>
                  <span className="block font-medium text-white/55 mt-1">
                    <WordReveal delay={0.25} duration={1} stagger={0.07}>
                      про нові лоти.
                    </WordReveal>
                  </span>
                </h2>
                <Reveal delay={0.35}>
                  <p className="text-white/60 leading-relaxed max-w-md mt-6">
                    Один лист на два тижні — свіжі обсмажки, ранні анонси
                    сетів, історії ферм і рецепти заварювання. Без спаму,
                    відписка в один клік.
                  </p>
                </Reveal>
              </div>

              {/* Form side */}
              <div className="lg:col-span-5">
                <Reveal delay={0.45}>
                  <AnimatePresence mode="wait">
                    {state === "done" ? (
                      <motion.div
                        key="done"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.5, ease: EASING.smooth }}
                        className="rounded-[var(--radius-lg)] border border-white/20 bg-white/5 px-6 py-5 backdrop-blur-sm"
                      >
                        <p className="text-xs tracking-[0.28em] uppercase text-white/50 mb-2">
                          Готово
                        </p>
                        <p className="font-display text-xl leading-snug">
                          Дякуємо. Перший лист прилетить із наступною обсмажкою.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.form
                        key="form"
                        onSubmit={handleSubmit}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.5, ease: EASING.smooth }}
                        className="w-full"
                        noValidate={false}
                      >
                        <label
                          htmlFor="home-newsletter"
                          className="text-[11px] tracking-[0.3em] uppercase text-white/50 mb-3 block"
                        >
                          Email
                        </label>
                        <div className="flex items-center gap-3 border-b border-white/25 pb-3 focus-within:border-white/80 transition-colors">
                          <input
                            id="home-newsletter"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={state === "submitting"}
                            placeholder="ti@example.com"
                            autoComplete="email"
                            className="flex-1 bg-transparent text-base outline-none placeholder:text-white/30 disabled:opacity-60"
                          />
                          <button
                            type="submit"
                            disabled={state === "submitting"}
                            className="shrink-0 text-sm tracking-[0.12em] uppercase hover:opacity-70 transition-opacity disabled:opacity-50 disabled:cursor-wait"
                          >
                            {state === "submitting" ? "…" : "Підписатись →"}
                          </button>
                        </div>
                        <p className="text-xs text-white/40 mt-4 leading-relaxed max-w-sm">
                          Натискаючи «Підписатись», ти погоджуєшся з{" "}
                          <a
                            href="/privacy"
                            className="underline underline-offset-2 decoration-white/30 hover:text-white/70 transition-colors"
                          >
                            політикою конфіденційності
                          </a>
                          .
                        </p>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </Reveal>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
