import Link from "next/link";
import { Container } from "./container";
import { fetchSiteSettings } from "@/sanity/lib/fetchers";

const SHOP_LINKS = [
  { label: "Уся кава", href: "/shop" },
  { label: "Еспресо", href: "/shop?category=espresso" },
  { label: "Фільтр", href: "/shop?category=filter" },
  { label: "Капсули", href: "/shop?category=capsules" },
  { label: "Порівняти", href: "/compare" },
  { label: "Підписка", href: "/subscription" },
];

const INFO_LINKS = [
  { label: "Про нас", href: "/about" },
  { label: "Brew Guide", href: "/brew-guide" },
  { label: "Journal", href: "/journal" },
  { label: "Кав'ярня в Полтаві", href: "/visit" },
  { label: "Доставка і оплата", href: "/delivery" },
  { label: "FAQ", href: "/faq" },
];

const ACCOUNT_LINKS = [
  { label: "Мій кабінет", href: "/account" },
  { label: "Мої замовлення", href: "/account/orders" },
  { label: "Моя підписка", href: "/account/subscriptions" },
  { label: "Контакти", href: "/contacts" },
];

/**
 * Site footer. Server component — fetches global site settings from
 * Sanity (contacts, social links) on render. Settings are cached at the
 * fetcher level so 20+ pages mounting Footer don't fan out 20 requests.
 */
export async function Footer() {
  const settings = await fetchSiteSettings();
  const socialLinks = [
    settings.instagram && {
      label: "Instagram",
      href: settings.instagram,
    },
    settings.telegram && {
      label: "Telegram",
      href: settings.telegram,
    },
    settings.facebook && {
      label: "Facebook",
      href: settings.facebook,
    },
  ].filter((l): l is { label: string; href: string } => Boolean(l));

  return (
    <footer className="bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)]">
      <Container size="wide">
        <div className="py-20 lg:py-28">
          {/* Top block — brand + newsletter */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 pb-16 border-b border-white/10">
            <div>
              <h2 className="font-display font-medium text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] tracking-[-0.035em] max-w-md">
                Свіжа кава щоранку <br />
                <span className="text-white/60">в&nbsp;твоїй чашці.</span>
              </h2>
              <p className="text-white/60 mt-6 max-w-sm leading-relaxed">
                Підпишись на розсилку — гайди, історії ферм, рецепти та
                ранні анонси нових обсмажок.
              </p>
            </div>
            <div className="flex items-end">
              <form className="w-full max-w-md">
                <label
                  htmlFor="newsletter"
                  className="text-xs tracking-wider uppercase text-white/50 mb-3 block"
                >
                  Email
                </label>
                <div className="flex gap-2 border-b border-white/30 pb-2 focus-within:border-white transition-colors">
                  <input
                    id="newsletter"
                    type="email"
                    placeholder="ti@example.com"
                    className="flex-1 bg-transparent outline-none placeholder:text-white/30"
                  />
                  <button
                    type="submit"
                    className="text-sm tracking-wide hover:opacity-70 transition-opacity"
                  >
                    Підписатись →
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 py-16">
            <div>
              <h3 className="text-xs tracking-wider uppercase text-white/50 mb-5 font-sans">
                Каталог
              </h3>
              <ul className="flex flex-col gap-3">
                {SHOP_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm hover:opacity-60 transition-opacity duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs tracking-wider uppercase text-white/50 mb-5 font-sans">
                Інформація
              </h3>
              <ul className="flex flex-col gap-3">
                {INFO_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm hover:opacity-60 transition-opacity duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs tracking-wider uppercase text-white/50 mb-5 font-sans">
                Кабінет
              </h3>
              <ul className="flex flex-col gap-3">
                {ACCOUNT_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm hover:opacity-60 transition-opacity duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs tracking-wider uppercase text-white/50 mb-5 font-sans">
                Соцмережі
              </h3>
              <ul className="flex flex-col gap-3">
                {socialLinks.length === 0 ? (
                  <li className="text-sm text-white/30">— ще не задано</li>
                ) : (
                  socialLinks.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:opacity-60 transition-opacity duration-300"
                      >
                        {link.label} →
                      </a>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-8 border-t border-white/10 text-xs text-white/40">
            <div>© {new Date().getFullYear()} BATCH Coffee Roastery. Усі права захищені.</div>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-white/70 transition-colors">
                Політика конфіденційності
              </Link>
              <Link href="/terms" className="hover:text-white/70 transition-colors">
                Умови використання
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
