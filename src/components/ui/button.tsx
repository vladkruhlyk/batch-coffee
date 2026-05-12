import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "link";
type Size = "sm" | "md" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

interface ButtonAsButton
  extends BaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps | "href"> {
  href?: never;
}

interface ButtonAsLink extends BaseProps {
  href: string;
  target?: string;
  rel?: string;
  /** Fire alongside the navigation — useful for closing overlays
   *  (e.g. cart drawer) on click. Not part of native <a>, but Next's
   *  Link forwards it through to the underlying anchor. */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  "inline-flex items-center justify-center gap-2 font-sans text-sm tracking-wide transition-all duration-300 ease-out disabled:opacity-40 disabled:pointer-events-none rounded-full";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]",
  secondary:
    "bg-transparent text-[var(--color-text-primary)] border border-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)] hover:text-[var(--color-text-inverse)]",
  ghost:
    "bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]",
  link: "bg-transparent text-[var(--color-text-primary)] underline-offset-4 hover:underline p-0",
};

const sizes: Record<Size, string> = {
  sm: "px-5 py-2.5 text-xs",
  md: "px-7 py-3.5 text-sm",
  lg: "px-9 py-4.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button({ variant = "primary", size = "md", className, children, ...props }, ref) {
    const classes = cn(
      base,
      variants[variant],
      variant !== "link" && sizes[size],
      className,
    );

    if ("href" in props && props.href) {
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={props.href}
          target={props.target}
          rel={props.rel}
          onClick={props.onClick}
          className={classes}
        >
          {children}
        </Link>
      );
    }

    const { href: _href, ...buttonProps } = props as ButtonAsButton;
    void _href;

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...buttonProps}
      >
        {children}
      </button>
    );
  },
);
