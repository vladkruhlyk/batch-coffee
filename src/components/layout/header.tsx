"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";
import { User, Menu, X } from "lucide-react";
import { CartIconButton } from "@/components/cart/cart-icon-button";
import { SearchButton } from "@/components/search/search-button";
import { Container } from "./container";
import { cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";

const NAV_LINKS = [
  { label: "Наша кава", href: "/shop" },
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

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 40);
  });

  // When overlay is on AND we're still at the top → transparent + white text.
  // Otherwise (scrolled, or non-overlay page) → solid cream + dark text.
  const isTransparent = overlay && !isScrolled;

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
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

            {/* Icons */}
            <div className="flex items-center gap-3">
              <SearchButton />
              <Link
                href="/account"
                aria-label="Особистий кабінет"
                className="p-2 hover:opacity-60 transition-opacity duration-300 hidden md:block"
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

      {/* Mobile menu */}
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
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.1 + i * 0.06,
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
            </nav>
          </Container>
        </motion.div>
      )}
    </>
  );
}
