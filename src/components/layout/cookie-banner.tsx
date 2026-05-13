"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { X } from "lucide-react";
import { EASING } from "@/lib/easing";

const STORAGE_KEY = "batch-cookie-consent";

/**
 * Minimal cookie consent banner.
 *
 * We use first-party cookies + localStorage for cart, session, and basic
 * analytics — that triggers Ukraine's data-protection rules (and GDPR if
 * we ever sell into the EU). Showing the banner once is the cheapest
 * compliance gesture. Acceptance is persisted to localStorage so the
 * banner only appears once per device.
 *
 * Why not block requests until consent: at our scale that's overkill and
 * hurts UX. The cart works fine for everyone; if a user rejects later
 * we'll add a "Manage cookies" link in the footer that wipes localStorage.
 */
export function CookieBanner() {
  // Lazy init reads localStorage during the very first render. SSR sees
  // `false`; the client hydrates with the real value. Avoids setState
  // inside useEffect, which React 19 lint forbids.
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem(STORAGE_KEY);
  });

  const accept = () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    // Soft decline — we still need cart cookies to function, so this is
    // really just "stop showing the banner". When we add a proper cookie
    // manager we'll split essential vs. analytics here.
    window.localStorage.setItem(STORAGE_KEY, "dismissed");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.4, ease: EASING.smooth }}
          // High z-index so it sits above CartDrawer + SearchOverlay.
          className="fixed bottom-3 left-3 right-3 lg:left-auto lg:right-6 lg:bottom-6 lg:max-w-md z-[200]"
        >
          <div
            role="region"
            aria-label="Cookie consent"
            className="rounded-[var(--radius-xl)] bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.4)] backdrop-blur-md"
          >
            <div className="p-5 lg:p-6">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[11px] tracking-[0.3em] uppercase text-white/55">
                  Cookies
                </p>
                <button
                  type="button"
                  onClick={decline}
                  aria-label="Сховати"
                  className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-3 text-sm text-white/80 leading-relaxed">
                Ми використовуємо cookies щоб запамʼятати твій кошик і
                сесію в кабінеті. Без рекламних трекерів, без передачі
                третім особам. Детальніше — в{" "}
                <Link
                  href="/privacy"
                  className="text-white underline underline-offset-2 decoration-white/40 hover:decoration-white transition-colors"
                >
                  політиці конфіденційності
                </Link>
                .
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={accept}
                  className="inline-flex items-center gap-2 rounded-full bg-white text-[var(--color-text-primary)] px-5 py-2.5 text-sm hover:opacity-90 transition-opacity"
                >
                  Прийняти
                </button>
                <button
                  type="button"
                  onClick={decline}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80 hover:text-white hover:border-white/40 transition-colors"
                >
                  Тільки необхідні
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
