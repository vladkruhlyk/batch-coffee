"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { useState } from "react";
import { User, Menu, X, ChevronDown } from "lucide-react";
import { CartIconButton } from "@/components/cart/cart-icon-button";
import { SearchButton } from "@/components/search/search-button";
import { Container } from "./container";
import { cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";

/** Catalog categories shown in the "Каталог" dropdown (desktop) and the
 *  "Наша кава" accordion (mobile). Each links straight into /shop with the
 *  category filter pre-selected. Icons reuse the category line-art. */
const CATALOG_CATEGORIES = [
  {
    label: "Кава в зернах",
    href: "/shop?category=beans",
    icon: "/cat-icons/beans.png",
    sub: "Свіже обсмаження",
  },
  {
    label: "Дріп-пакети",
    href: "/shop?category=drip",
    icon: "/cat-icons/drip.png",
    sub: "Кава з собою",
  },
  {
    label: "Аксесуари",
    href: "/shop?category=gear",
    icon: "/cat-icons/gear.png",
    sub: "Для заварювання",
  },
  {
    label: "Млинки",
    href: "/shop?category=grinders",
    icon: "/cat-icons/grinders.png",
    sub: "Для помелу",
  },
];

const NAV_LINKS = [
  { label: "Підписка", href: "/subscription" },
  { label: "Brew Guide", href: "/brew-guide" },
  { label: "Journal", href: "/journal" },
  { label: "Про нас", href: "/about" },
  { label: "Кав'ярня", href: "/visit" },
];

interface HeaderProps {
  /**
   * Set to true when the page starts with a dark hero/section and the header
   * needs to sit transparently over it (white logo + nav). It flips to the
   * solid cream+dark-text state once the user scrolls past the threshold.
   *
   * Default is `false` — header is always solid (cream bg, dark text),
   * suitable for every light-bg page.
   */
  overlay?: boolean;
}

export function Header({ overlay = false }: HeaderProps) {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 40);
  });

  // When overlay is on AND we're still at the top → transparent + white text.
  // Otherwise (scrolled, or non-overlay page) → solid cream + dark text.
  const isTransparent = overlay && !isScrolled;

  return (
    <>
      <motion.header
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASING.smooth, delay: 0.2 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-colors duration-500",
          isTransparent
            ? "bg-transparent border-b border-transparent text-white"
            : "bg-[var(--color-bg-primary)]/85 backdrop-blur-md border-b border-[var(--color-border-default)] text-[var(--color-text-primary)]",
        )}
      >
        <Container size="wide">
          <div className="flex items-center justify-between h-20 lg:h-24">
            {/* Logo — switches white/black based on header state */}
            <Link
              href="/"
              className="group relative block hover:opacity-70 transition-opacity duration-300"
              aria-label="BATCH Coffee — головна"
            >
              {/* Both images stacked, cross-fade on state change. The
                  containing Link sets the bounding box; black image fills it,
                  white image is absolutely overlaid. */}
              <Image
                src="/logo-black.png"
                alt="BATCH Coffee Roastery"
                width={140}
                height={140}
                priority
                className={cn(
                  "block h-12 lg:h-14 w-auto transition-opacity duration-500",
                  isTransparent ? "opacity-0" : "opacity-100",
                )}
              />
              <Image
                src="/logo-white.png"
                alt=""
                aria-hidden
                width={140}
                height={140}
                priority
                className={cn(
                  "absolute inset-0 block h-12 lg:h-14 w-auto transition-opacity duration-500",
                  isTransparent ? "opacity-100" : "opacity-0",
                )}
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-8">
              <CatalogDropdown />
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[13px] tracking-[0.08em] hover:opacity-60 transition-opacity duration-300"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Icons. The user-icon was previously `hidden md:block` —
                that meant phone visitors had no way into /account from
                the header at all. Now it shows everywhere; on the
                narrowest viewports it sits next to the cart. */}
            <div className="flex items-center gap-3">
              <SearchButton />
              <Link
                href="/account"
                aria-label="Особистий кабінет"
                className="p-2 hover:opacity-60 transition-opacity duration-300"
              >
                <User className="w-5 h-5" strokeWidth={1.5} />
              </Link>
              <CartIconButton />
              <button
                aria-label="Меню"
                onClick={() => setMobileOpen(true)}
                className="p-2 lg:hidden hover:opacity-60 transition-opacity duration-300"
              >
                <Menu className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </Container>
      </motion.header>

      {/* Mobile menu. Wrapped in AnimatePresence so the `exit` opacity
          fade actually plays on close — without it the menu unmounts
          instantly. */}
      <AnimatePresence>
        {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: EASING.smooth }}
          className="fixed inset-0 z-[100] bg-[var(--color-bg-primary)] lg:hidden"
        >
          <Container size="wide">
            <div className="flex items-center justify-between h-20">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                aria-label="BATCH Coffee — головна"
              >
                <Image
                  src="/logo-black.png"
                  alt="BATCH Coffee Roastery"
                  width={140}
                  height={140}
                  className="block h-12 w-auto"
                />
              </Link>
              <button
                aria-label="Закрити меню"
                onClick={() => setMobileOpen(false)}
                className="p-2"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
            <nav className="flex flex-col gap-2 mt-16">
              {/* Каталог — expandable list of categories. Tapping a category
                  deep-links into /shop with that filter pre-selected. */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASING.smooth }}
              >
                <button
                  type="button"
                  aria-expanded={mobileCatalogOpen}
                  onClick={() => setMobileCatalogOpen((v) => !v)}
                  className="flex w-full items-center justify-between font-display text-4xl py-3 hover:opacity-60 transition-opacity"
                >
                  Каталог
                  <ChevronDown
                    className={cn(
                      "w-7 h-7 transition-transform duration-300",
                      mobileCatalogOpen && "rotate-180",
                    )}
                    strokeWidth={1.5}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {mobileCatalogOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASING.smooth }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-1 pb-3 pl-1">
                        {CATALOG_CATEGORIES.map((c) => (
                          <Link
                            key={c.href}
                            href={c.href}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-4 py-2.5 hover:opacity-60 transition-opacity"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={c.icon}
                              alt=""
                              aria-hidden
                              className="h-7 w-7"
                            />
                            <span className="font-display text-2xl">
                              {c.label}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.1 + (i + 1) * 0.06,
                    ease: EASING.smooth,
                  }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block font-display text-4xl py-3 hover:opacity-60 transition-opacity"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              {/* Account link — separated from the main nav with a
                  divider so it reads as a secondary action. Picked
                  smaller copy than the main NAV_LINKS to set the
                  hierarchy: marketing pages first, then "your stuff". */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.1 + (NAV_LINKS.length + 1) * 0.06,
                  ease: EASING.smooth,
                }}
                className="mt-10 pt-6 border-t border-[var(--color-border-default)]"
              >
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-3 text-xl font-display py-2 hover:opacity-60 transition-opacity"
                >
                  <User className="w-5 h-5" strokeWidth={1.5} />
                  Особистий кабінет
                </Link>
              </motion.div>
            </nav>
          </Container>
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Desktop "Каталог" nav item — a hover-reveal mega-menu of catalog
 * categories. Each row deep-links into /shop with the filter pre-selected.
 *
 * The panel is a DOM descendant of the hovered wrapper, so moving the cursor
 * from the trigger down onto the panel keeps it open — mouseleave is based on
 * DOM hierarchy, not the visual box, and the panel's `pt-4` keeps the
 * hover area flush with the trigger (no dead gap to fall through).
 */
function CatalogDropdown() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        href="/shop"
        className="flex items-center gap-1 text-[13px] tracking-[0.08em] hover:opacity-60 transition-opacity duration-300"
      >
        Каталог
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-300",
            open && "rotate-180",
          )}
          strokeWidth={1.5}
        />
      </Link>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: EASING.smooth }}
            className="absolute left-1/2 top-full z-50 w-[340px] -translate-x-1/2 pt-4"
          >
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-2 text-[var(--color-text-primary)] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)]">
              {CATALOG_CATEGORIES.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] p-2.5 hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.icon} alt="" aria-hidden className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display font-semibold text-[15px] leading-tight">
                      {c.label}
                    </span>
                    <span className="block text-[12px] text-[var(--color-text-secondary)]">
                      {c.sub}
                    </span>
                  </span>
                </Link>
              ))}
              <Link
                href="/shop"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--color-text-primary)] px-4 py-3 text-[13px] tracking-[0.08em] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity duration-300"
              >
                Весь каталог
                <span aria-hidden>→</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
