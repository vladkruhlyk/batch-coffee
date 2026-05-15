"use client";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";

/**
 * Tiny self-contained SVG charts for the admin dashboard. Kept inline
 * (no Recharts / Chart.js) so the bundle stays small and the styling
 * inherits brand tokens directly. We don't need legends, tooltips on
 * hover for every point, or fancy transitions — admin metrics are
 * scannable, not interactive.
 *
 * Two shapes:
 *   - LineChart: time series (revenue or order count per day)
 *   - BarChart: categorical comparison (status counts)
 *
 * Both expect already-aggregated data — caller does the bucketing,
 * we just render.
 */

interface LineDatum {
  /** Display label for the x-axis tick. */
  label: string;
  /** Optional full date for the tooltip (defaults to label). */
  date?: string;
  value: number;
}

export function LineChart({
  data,
  height = 200,
  format = (v) => v.toString(),
  emphasis = false,
}: {
  data: LineDatum[];
  height?: number;
  /** How to format each data-point's value for hover labels. */
  format?: (v: number) => string;
  /** Slightly thicker line + filled area. Reserved for the primary
   *  revenue chart. */
  emphasis?: boolean;
}) {
  if (data.length === 0) {
    return (
      <div
        className="grid place-items-center text-sm text-[var(--color-text-muted)]"
        style={{ height }}
      >
        Дані відсутні
      </div>
    );
  }

  const width = 800; // viewBox; SVG scales to container
  const padX = 28;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padX + i * xStep,
    y: padY + innerH - (d.value / maxValue) * innerH,
    datum: d,
  }));

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  // Filled-area variant — line plus a closed path back along the
  // baseline. Subtle, brand-aligned dark transparency.
  const areaPath = `${path} L ${padX + innerW} ${padY + innerH} L ${padX} ${padY + innerH} Z`;

  // X-ticks — show only a handful so labels don't pile up. Always
  // include first + last; everything in between is a rough subsample.
  const tickIndices = pickTickIndices(data.length, 5);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* Gridlines — 3 horizontal lines (0, mid, max) */}
        {[0, 0.5, 1].map((frac) => {
          const y = padY + innerH - frac * innerH;
          return (
            <line
              key={frac}
              x1={padX}
              x2={padX + innerW}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-[var(--color-border-default)]"
            />
          );
        })}

        {emphasis && (
          <path
            d={areaPath}
            fill="currentColor"
            className="text-[var(--color-text-primary)]"
            opacity={0.08}
          />
        )}

        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={emphasis ? 2 : 1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-text-primary)]"
        />

        {points.map((p) => (
          <circle
            key={`${p.datum.label}-${p.x}`}
            cx={p.x}
            cy={p.y}
            r={emphasis ? 3 : 2.5}
            fill="var(--color-bg-primary)"
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-[var(--color-text-primary)]"
          >
            <title>
              {p.datum.date ?? p.datum.label}: {format(p.datum.value)}
            </title>
          </circle>
        ))}

        {/* X-axis labels — render in SVG so they line up perfectly */}
        {tickIndices.map((i) => {
          const p = points[i];
          if (!p) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={height - 4}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              className="text-[var(--color-text-muted)]"
            >
              {p.datum.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

interface BarDatum {
  label: string;
  value: number;
  /** Optional Tailwind class triple for the bar fill colour. */
  toneClass?: string;
}

export function BarChart({
  data,
  height = 220,
  format = (v) => v.toString(),
}: {
  data: BarDatum[];
  height?: number;
  format?: (v: number) => string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div
        className="grid place-items-center text-sm text-[var(--color-text-muted)]"
        style={{ height }}
      >
        Дані відсутні
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul
      className="flex items-end justify-between gap-3 px-1"
      style={{ height }}
    >
      {data.map((d) => {
        const pct = (d.value / maxValue) * 100;
        return (
          <li
            key={d.label}
            className="flex-1 flex flex-col items-center justify-end gap-2 min-w-0"
          >
            <span className="text-xs font-display font-semibold tabular-nums">
              {format(d.value)}
            </span>
            <div
              className={cn(
                "w-full rounded-t-md transition-all min-h-[4px]",
                d.toneClass ?? "bg-[var(--color-text-primary)]",
              )}
              style={{ height: `${Math.max(4, pct * 0.65)}%` }}
              title={`${d.label}: ${format(d.value)}`}
            />
            <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--color-text-muted)] text-center truncate w-full">
              {d.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Currency-formatter passthrough — the dashboard uses prices a lot. */
export const formatChartCurrency = (v: number) => formatPrice(v);

/**
 * Pick `n` evenly-spaced indices from 0..length-1 inclusive of both
 * endpoints. Used to subsample x-axis labels so they don't overlap.
 */
function pickTickIndices(length: number, n: number): number[] {
  if (length <= n) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(i * step));
}
