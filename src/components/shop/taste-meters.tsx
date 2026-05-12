"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";
import type { TasteMeters as TasteMetersType } from "@/data/products";

interface TasteMetersProps {
  meters: TasteMetersType;
  /** "compact"     — 3 columns side-by-side, small dots (legacy, still exported).
   *  "row"         — stacked rows with labels on the left + five dots (legacy).
   *  "bar"         — candle-style animated bars + flame marker, PDP scale.
   *  "bar-compact" — same candle-style bars tuned tighter for product cards. */
  variant?: "compact" | "row" | "bar" | "bar-compact";
  /** On dark backgrounds (not used currently but future-proof) */
  inverse?: boolean;
  className?: string;
}

const LABELS: Array<{ key: keyof TasteMetersType; short: string; full: string }> = [
  { key: "acidity", short: "Кислотність", full: "Кислотність" },
  { key: "sweetness", short: "Солодкість", full: "Солодкість" },
  { key: "bitterness", short: "Гіркота", full: "Гіркота" },
];

/** Brand accent used by the bar variant — same yellow as the burnt fill, so
 *  the splash mark feels lit by the bar rather than glued onto it. Pinned
 *  locally; it's a visual flourish, not a global token. */
const FLAME_COLOR = "#E9D358";

/** BATCH splash mark — full-petal frame from the loader. Reused as a CSS
 *  mask so we can tint it to match the burnt portion of the bar. */
const SPLASH_MASK = "url(/5.png)";

/**
 * Taste meter strip. Four variants:
 *  - compact     — dense 3-col layout for product cards (legacy dots)
 *  - row         — labelled rows with five dots (legacy / generic)
 *  - bar         — candle-like horizontal bars: yellow fill + flame nib at
 *                  the score point, black remainder track. Designed for PDP.
 *  - bar-compact — same visual language, tighter dimensions for cards.
 */
export function TasteMeters({
  meters,
  variant = "compact",
  inverse = false,
  className,
}: TasteMetersProps) {
  if (variant === "bar" || variant === "bar-compact") {
    const compact = variant === "bar-compact";
    return (
      <div
        className={cn(
          "flex flex-col",
          compact ? "gap-2.5" : "gap-5",
          className,
        )}
      >
        {LABELS.map(({ key, full }, i) => (
          <MeterBar
            key={key}
            label={full}
            value={meters[key]}
            inverse={inverse}
            compact={compact}
            // Cascade the rows so the flames light up left-to-right, top-to-
            // bottom — reads as a single gesture rather than three bars
            // firing in unison. Slightly tighter cadence on the compact
            // card variant so the whole strip finishes quickly.
            delay={i * (compact ? 0.1 : 0.14)}
          />
        ))}
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {LABELS.map(({ key, full }) => (
          <MeterRow
            key={key}
            label={full}
            value={meters[key]}
            inverse={inverse}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-3 lg:gap-5",
        className,
      )}
    >
      {LABELS.map(({ key, short }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <span
            className={cn(
              "text-[9px] tracking-[0.18em] uppercase leading-none",
              inverse ? "text-white/55" : "text-[var(--color-text-muted)]",
            )}
          >
            {short}
          </span>
          <Dots value={meters[key]} inverse={inverse} />
        </div>
      ))}
    </div>
  );
}

function MeterRow({
  label,
  value,
  inverse,
}: {
  label: string;
  value: number;
  inverse: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span
        className={cn(
          "text-[10px] tracking-[0.25em] uppercase",
          inverse ? "text-white/60" : "text-[var(--color-text-muted)]",
        )}
      >
        {label}
      </span>
      <Dots value={value} inverse={inverse} />
    </div>
  );
}

function MeterBar({
  label,
  value,
  inverse,
  delay,
  compact = false,
}: {
  label: string;
  value: number;
  inverse: boolean;
  delay: number;
  /** Tighter dimensions for small containers like product cards. */
  compact?: boolean;
}) {
  // 1-5 scale mapped to percentage. Clamped so upstream data never breaks
  // the layout with silly values (0 or 6+).
  const clamped = Math.max(0, Math.min(5, value));
  const percent = (clamped / 5) * 100;

  // Derived visual tokens. Keeping them in one block makes the compact /
  // default contrast explicit — no "surprise" scaling scattered across the
  // tree.
  const fillDuration = compact ? 0.9 : 1.1;
  const flameDelay = delay + (compact ? 0.7 : 0.9);

  return (
    <div
      className={cn(
        "flex items-center",
        compact ? "gap-3" : "gap-5",
      )}
    >
      <span
        className={cn(
          "shrink-0 tracking-wide",
          compact
            ? "min-w-[84px] text-[11px]"
            : "min-w-[104px] text-sm",
          inverse ? "text-white/75" : "text-[var(--color-text-primary)]",
        )}
      >
        {label}
      </span>

      {/* Track — a single thin rail that holds the "unburnt" remainder.
          Height is just enough to read as a line, not a bar. */}
      <div
        className={cn(
          "relative flex-1",
          compact ? "h-[2px]" : "h-[3px]",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full",
            // Dark remainder — matches the candle-wick aesthetic in the
            // reference. Inverse uses a soft white for dark surfaces.
            inverse ? "bg-white/25" : "bg-[var(--color-text-primary)]",
          )}
        />

        {/* Fill container — its width animates from 0 → `percent`. The
            flame is pinned to its right edge so it naturally rides along
            with the burn. */}
        <motion.div
          aria-hidden
          className="absolute left-0 top-0 h-full"
          initial={{ width: 0 }}
          whileInView={{ width: `${percent}%` }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: fillDuration, ease: EASING.smooth, delay }}
        >
          {/* Yellow burnt portion. Rounded so the left cap looks like
              spent wax rather than a hard edge. */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: FLAME_COLOR }}
          />

          {/* Splash-mark nib — pinned to the right edge of the burnt fill
              and centred vertically on the bar end. translate-x-1/2 puts
              the petal centre exactly on the transition point so the
              flower reads as "the score lives here". A subtle pop-in keeps
              it from feeling dragged in by the fill. */}
          <motion.div
            className="absolute right-0 top-1/2"
            // Lift the splash mark so it floats above the bar — petals only
            // graze the rail at the bottom rather than splaying both sides.
            // Pull it leftward (translateX < 50%) so the visible petal mass
            // overlaps the burnt-yellow tip; the PNG has internal padding
            // that otherwise leaves a gap between bar end and the flower.
            style={{ translateX: "30%", translateY: "-78%" }}
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.5,
              ease: EASING.smooth,
              // Fire the bloom right as the fill lands at its target.
              delay: flameDelay,
            }}
          >
            <span
              aria-hidden
              className="block"
              style={{
                width: compact ? 18 : 24,
                height: compact ? 18 : 24,
                backgroundColor: FLAME_COLOR,
                WebkitMaskImage: SPLASH_MASK,
                maskImage: SPLASH_MASK,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskPosition: "center",
                maskPosition: "center",
              }}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function Dots({ value, inverse }: { value: number; inverse: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < value;
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              "block h-1.5 w-1.5 rounded-full transition-colors",
              filled
                ? inverse
                  ? "bg-white"
                  : "bg-[var(--color-text-primary)]"
                : inverse
                  ? "bg-white/20"
                  : "bg-[var(--color-border-strong)]/60",
            )}
          />
        );
      })}
    </div>
  );
}
