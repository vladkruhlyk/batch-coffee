import { Mountain, MapPin, Sprout, Leaf, CalendarDays } from "lucide-react";
import type { Product } from "@/data/products";

interface OriginPanelProps {
  product: Product;
}

/**
 * "Походження" — spec-sheet card under the gallery on the PDP. Fills the
 * left column's empty space below the image with editorially useful info
 * the right column doesn't already cover (taste meters, recipe, variants).
 *
 * Cells are rendered conditionally — partial data still looks intentional
 * rather than littered with em-dashes. If the product has no origin info
 * at all (e.g. gear, gifts), the parent should skip mounting this entirely.
 */
export function OriginPanel({ product }: OriginPanelProps) {
  // Build the row list so empty fields don't render — keeps the panel
  // tight when only a few fields are filled.
  const rows: Array<{
    icon: React.ReactNode;
    label: string;
    value: string;
  }> = [];

  if (product.country) {
    rows.push({
      icon: <MapPin className="h-4 w-4" strokeWidth={1.6} />,
      label: "Країна",
      value: product.country,
    });
  }
  if (product.region) {
    rows.push({
      icon: <MapPin className="h-4 w-4" strokeWidth={1.6} />,
      label: "Регіон",
      value: product.region,
    });
  }
  if (product.altitude) {
    rows.push({
      icon: <Mountain className="h-4 w-4" strokeWidth={1.6} />,
      label: "Висота",
      value: product.altitude,
    });
  }
  if (product.varietal) {
    rows.push({
      icon: <Sprout className="h-4 w-4" strokeWidth={1.6} />,
      label: "Сорт",
      value: product.varietal,
    });
  }
  if (product.farm) {
    rows.push({
      icon: <Leaf className="h-4 w-4" strokeWidth={1.6} />,
      label: "Ферма",
      value: product.farm,
    });
  }
  if (product.harvest) {
    rows.push({
      icon: <CalendarDays className="h-4 w-4" strokeWidth={1.6} />,
      label: "Збір",
      value: product.harvest,
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-6 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 lg:p-7">
      {/* Section heading — matches the editorial kicker style used in the
          variant blocks on the right column. */}
      <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-5">
        Походження
      </h2>

      {/* Two-column grid on desktop, single column on phones. Lets us pack
          6 facts into a tight rectangle without making rows feel cramped. */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            >
              {row.icon}
            </span>
            <div className="flex flex-col">
              <dt className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
                {row.label}
              </dt>
              <dd className="mt-0.5 font-display text-[15px] font-medium text-[var(--color-text-primary)]">
                {row.value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
