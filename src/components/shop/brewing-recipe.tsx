"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Coffee, Droplets, Thermometer, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";
import type { BrewMethod } from "@/data/products";

interface BrewingRecipeProps {
  brewing: BrewMethod[];
}

/**
 * "Спосіб приготування" — recipe block on the product page.
 *
 * Renders the SKU's recommended brewing methods as a row of selectable
 * pills; clicking a pill swaps the active recipe card below it. Each card
 * shows the four standard dial-ins (ratio · grind · water temp · time) as
 * a clean grid, plus an optional one-line tip beneath.
 *
 * AnimatePresence with a `mode="wait"` swap gives a soft transition when
 * the user flips between methods — same feel as the gallery / banner
 * crossfades elsewhere on the site, so it doesn't read as a separate
 * design system.
 */
export function BrewingRecipe({ brewing }: BrewingRecipeProps) {
  // Default to the first recipe — the data layer treats array order as
  // "preferred method first", so this lands the user on the recommended
  // one without requiring an explicit `default` flag.
  const [activeIndex, setActiveIndex] = useState(0);
  const active = brewing[activeIndex];

  if (!active) return null;

  return (
    <div className="flex flex-col gap-5">
      {/* Section header — kept lightweight, the underlying section in the
          PDP already separates this block with a top border + spacing. */}
      <h3 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
        Спосіб приготування
      </h3>

      {/* Method pills — same visual language as roast / weight selectors
          on the PDP so the user immediately reads them as choices. */}
      <div className="flex flex-wrap gap-2">
        {brewing.map((b, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={b.method}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-pressed={isActive}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition-all duration-300",
                isActive
                  ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                  : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
              )}
            >
              {b.method}
            </button>
          );
        })}
      </div>

      {/* Recipe card — animated swap on method change. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active.method}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4, ease: EASING.smooth }}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5 lg:p-6"
        >
          {/* 2×2 grid of dials. Each cell collapses to a hyphen if missing
              so the layout stays balanced — better than rendering different
              numbers of cells per method. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <Dial
              icon={<Coffee className="h-4 w-4" strokeWidth={1.6} />}
              label="Пропорція"
              value={active.ratio}
            />
            <Dial
              icon={<Droplets className="h-4 w-4" strokeWidth={1.6} />}
              label="Помел"
              value={active.grind}
            />
            <Dial
              icon={<Thermometer className="h-4 w-4" strokeWidth={1.6} />}
              label="Температура"
              value={
                active.waterTemp != null ? `${active.waterTemp} °C` : undefined
              }
            />
            <Dial
              icon={<Timer className="h-4 w-4" strokeWidth={1.6} />}
              label="Час"
              value={active.time}
            />
          </div>

          {active.tip && (
            <p className="mt-5 pt-5 border-t border-[var(--color-border-default)] text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {active.tip}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * One stat in the 2×2 grid — icon, label, value. Values can be undefined
 * (some methods only have ratio + grind, others have all four), in which
 * case we render an em-dash so the row stays vertically aligned.
 */
function Dial({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
      >
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
          {label}
        </span>
        <span className="mt-1 font-display text-[15px] font-medium tabular-nums text-[var(--color-text-primary)]">
          {value ?? "—"}
        </span>
      </div>
    </div>
  );
}
