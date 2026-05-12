"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Hard floor — defaults to 1 (cart can't add 0 items). */
  min?: number;
  /** Optional ceiling — uncapped by default. */
  max?: number;
  /** "default" — used on the PDP (h-9 buttons, easy to grab).
   *  "compact" — used on product cards, where vertical real estate is tight. */
  size?: "default" | "compact";
  className?: string;
}

/**
 * Pill-shaped quantity stepper used on the PDP and product cards.
 *
 * Centralised here so both surfaces have identical interaction/keyboard
 * behaviour. The compact variant just shrinks the touch targets — the
 * shape, hover/disabled affordances, and bounds logic stay the same.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  size = "default",
  className,
}: QuantityStepperProps) {
  const compact = size === "compact";
  const button = compact ? "h-7 w-7" : "h-9 w-9";
  const icon = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max != null ? Math.min(max, value + 1) : value + 1);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[var(--color-border-strong)]",
        compact ? "p-0.5" : "p-1",
        className,
      )}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Зменшити"
        className={cn(
          "grid place-items-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-40 disabled:pointer-events-none",
          button,
        )}
      >
        <Minus className={icon} />
      </button>
      <span
        className={cn(
          "min-w-[2ch] text-center font-display font-medium tabular-nums",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={max != null && value >= max}
        aria-label="Збільшити"
        className={cn(
          "grid place-items-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-40 disabled:pointer-events-none",
          button,
        )}
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}
