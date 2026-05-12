import type { Metadata } from "next";
import Link from "next/link";
// Note: Instagram icon dropped from lucide in newer versions — use a
// generic external-link glyph instead. Keeps zero deps; we can swap to a
// brand SVG when we have a finalised social kit.
import { ArrowUpRight, Clock, MapPin, Phone, Send } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SectionKicker } from "@/components/layout/section-kicker";

export const metadata: Metadata = {
  title: "Контакти — BATCH Coffee",
  description:
    "Адреса кавʼярні, телефон, соцмережі та графік роботи BATCH Coffee Roastery.",
};

/**
 * Contacts — single-page directory: address + map placeholder, phone, email,
 * socials, hours. Light form left out for now; the FAQ + email links are
 * usually enough at this stage. Form goes in when Resend is wired.
 */
export default function ContactsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
          {/* Hero */}
          <header className="grid lg:grid-cols-12 gap-8 mb-16 lg:mb-24">
            <div className="lg:col-span-7">
              <SectionKicker label="Контакти" />
              <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,4rem)] leading-[1.02] tracking-[-0.04em] mt-10">
                Завжди раді
                <span className="block text-[var(--color-text-secondary)] font-medium">
                  чути тебе.
                </span>
              </h1>
            </div>
            <div className="lg:col-span-5 lg:pt-6">
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Питання, замовлення, корпоративка, преса, навчання, гастролі —
                будь-що. Відповідаємо протягом години в робочі дні, протягом
                кількох годин в неробочі.
              </p>
            </div>
          </header>

          {/* Main grid — map placeholder + contact rows */}
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Map placeholder card */}
            <div className="lg:col-span-7">
              <div
                className="relative overflow-hidden rounded-[var(--radius-2xl)] aspect-[16/10] lg:aspect-[4/3]"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse at 45% 40%, #D9C2A1 0%, #8B6240 60%, #3E2818 100%)",
                }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-12 text-white">
                  <span className="text-[11px] tracking-[0.3em] uppercase text-white/70">
                    Кавʼярня та обсмажник
                  </span>
                  <h2 className="mt-3 font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
                    Велика Васильківська, 24
                  </h2>
                  <p className="mt-2 text-white/85">Київ, 01004</p>
                </div>
              </div>

              {/* "Replace with Google Maps embed" hint */}
              <p className="mt-3 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                Замість плейсхолдера тут буде Google Maps embed з точкою —
                додамо коли визначишся з фінальною адресою.
              </p>
            </div>

            {/* Contact list */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <ContactRow
                icon={<MapPin className="h-4 w-4" />}
                label="Адреса"
                primary="Велика Васильківська, 24"
                secondary="Київ, 01004"
              />
              <ContactRow
                icon={<Clock className="h-4 w-4" />}
                label="Графік"
                primary="Пн–Нд · 08:00–22:00"
                secondary="Кухня до 21:30 · Самовивіз до 22:00"
              />
              <ContactRow
                icon={<Phone className="h-4 w-4" />}
                label="Телефон"
                primary="+380 (50) 123-45-67"
                href="tel:+380501234567"
              />
              <ContactRow
                icon={<Send className="h-4 w-4" />}
                label="Email"
                primary="hello@batch.coffee"
                href="mailto:hello@batch.coffee"
              />
              <ContactRow
                icon={<ArrowUpRight className="h-4 w-4" />}
                label="Instagram"
                primary="@batch.coffee"
                href="https://instagram.com/batch.coffee"
                external
              />
            </div>
          </div>

          {/* Quick links to related pages */}
          <section className="mt-20 lg:mt-32 grid sm:grid-cols-3 gap-3 lg:gap-4">
            <QuickLink
              title="Доставка"
              body="Як, скільки, куди й коли."
              href="/delivery"
            />
            <QuickLink
              title="Часті питання"
              body="Свіжість, зберігання, повернення."
              href="/faq"
            />
            <QuickLink
              title="Завітати"
              body="Що чекає в кавʼярні."
              href="/visit"
            />
          </section>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function ContactRow({
  icon,
  label,
  primary,
  secondary,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string;
  href?: string;
  external?: boolean;
}) {
  const Body = (
    <div className="flex items-start gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6 hover:border-[var(--color-text-primary)] transition-colors">
      <span
        aria-hidden
        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="mt-1 font-display text-lg font-medium tabular-nums">
          {primary}
        </p>
        {secondary && (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {secondary}
          </p>
        )}
      </div>
    </div>
  );

  if (!href) return Body;
  if (external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {Body}
      </a>
    );
  return <Link href={href}>{Body}</Link>;
}

function QuickLink({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7 hover:border-[var(--color-text-primary)] transition-colors"
    >
      <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {body}
      </p>
      <span className="mt-5 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-primary)] group-hover:opacity-60 transition-opacity">
        Читати →
      </span>
    </Link>
  );
}
