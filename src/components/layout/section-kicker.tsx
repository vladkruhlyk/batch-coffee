import { cn } from "@/lib/utils";

interface SectionKickerProps {
  /** Optional index — e.g. "01", "02". Omit to show just label + rule. */
  number?: string;
  /** Short label next to the (optional) number */
  label: string;
  /** On dark background? */
  inverse?: boolean;
  className?: string;
}

/**
 * Editorial section label — "N°01 · КАТАЛОГ" or just "· КАТАЛОГ".
 * Used at the top of every home section for journal-like rhythm.
 */
export function SectionKicker({
  number,
  label,
  inverse = false,
  className,
}: SectionKickerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 text-[11px] tracking-[0.3em] uppercase font-sans font-medium",
        inverse ? "text-white/60" : "text-[var(--color-text-muted)]",
        className,
      )}
    >
      {number && (
        <span className="font-display text-sm">N°{number}</span>
      )}
      <span
        className={cn(
          "block w-8 h-px",
          inverse ? "bg-white/30" : "bg-[var(--color-border-strong)]",
        )}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
