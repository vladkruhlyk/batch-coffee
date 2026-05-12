import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ContainerSize = "default" | "narrow" | "wide" | "full";

interface ContainerProps {
  children: ReactNode;
  size?: ContainerSize;
  className?: string;
}

const sizeMap: Record<ContainerSize, string> = {
  narrow: "max-w-[720px]",   // text-heavy pages (article, brew-guide method)
  default: "max-w-[1200px]", // most content pages
  wide: "max-w-[1440px]",    // shop grid, hero sections
  full: "max-w-none",        // edge-to-edge sections
};

/**
 * Page content container with consistent horizontal padding.
 * All sections use this to keep edges aligned.
 */
export function Container({
  children,
  size = "default",
  className,
}: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 md:px-10 lg:px-16",
        sizeMap[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
