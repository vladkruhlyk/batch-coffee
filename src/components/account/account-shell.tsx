"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  LayoutDashboard,
  Loader2,
  LogOut,
  PackageOpen,
  Repeat,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { useAuth, formatPhone } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

interface AccountShellProps {
  children: ReactNode;
}

const NAV = [
  {
    label: "Огляд",
    href: "/account",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Замовлення",
    href: "/account/orders",
    icon: PackageOpen,
  },
  {
    label: "Підписка",
    href: "/account/subscriptions",
    icon: Repeat,
  },
  {
    label: "Профіль",
    href: "/account/profile",
    icon: UserRound,
  },
];

/**
 * Shared shell for every page under `/account`.
 *
 * Responsibilities:
 *   - Gate: redirects to /login when the auth store has hydrated and there's
 *     no user. The hydration wait is critical — without it, the gate fires
 *     during the brief moment between SSR and store rehydration and we get
 *     a flash-of-login-page even for signed-in users.
 *   - Layout: persistent sidebar nav on desktop; horizontal scroll-row of
 *     pills on mobile.
 *   - Greeting header — name (if filled) or formatted phone fallback,
 *     plus a logout button that lives outside the per-page content so it
 *     never disappears.
 */
export function AccountShell({ children }: AccountShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const logout = useAuth((s) => s.logout);

  // Auth guard. Push to /login with ?next= so the user lands back here
  // after verifying their code. Also drag users with incomplete profiles
  // through onboarding before letting them see the cabinet — the email
  // OTP flow doesn't collect a name and we need at least one to render a
  // useful greeting (otherwise "Вітаємо, email@..." which feels weird).
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      const next = encodeURIComponent(pathname || "/account");
      router.replace(`/login?next=${next}`);
      return;
    }
    // Skip the completeness check for legacy phone-mock users — their
    // id has the "mock-" prefix and there's no Supabase profile row to
    // fill in. Once real SMS lands, the mock branch goes away entirely.
    const isMockUser = user.id.startsWith("mock-");
    const incomplete =
      !isMockUser && (!user.firstName || !user.lastName || !user.phone);
    if (incomplete) {
      // The /login page reads `step` directly from the store; setting it
      // here is the cleanest way to signal "open onboarding, not entry".
      useAuth.setState({ step: "needs-profile" });
      router.replace("/login");
    }
  }, [hydrated, user, router, pathname]);

  // Pre-hydration / unauthenticated → don't paint the cabinet, but
  // also DON'T return null: that collapses the page to header+footer,
  // and the footer pops up right under the navbar for a beat before
  // the real content (or redirect) lands. Render a tall spinner-
  // shaped placeholder so the page-height stays stable.
  if (!hydrated || !user) {
    return (
      <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
        <div className="min-h-[60vh] grid place-items-center text-[var(--color-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Container>
    );
  }

  // Greeting falls back through name → phone → email. Anonymous-feel
  // empty string is the last resort so the layout doesn't break.
  const displayName =
    user.firstName || user.lastName
      ? [user.firstName, user.lastName].filter(Boolean).join(" ")
      : user.phone
        ? formatPhone(user.phone)
        : (user.email ?? "");

  return (
    <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
      {/* Page header */}
      <div className="grid lg:grid-cols-12 gap-8 mb-12 lg:mb-16">
        <div className="lg:col-span-8">
          <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
            Особистий кабінет
          </span>
          <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em] mt-4">
            {displayName ? `Вітаємо, ${displayName}.` : "Вітаємо."}
          </h1>
        </div>
        {/* Logout — matched to the rest of the site's secondary CTA style
            (rounded outlined pill). Top-aligned on desktop so it sits in
            the corner of the header row rather than orbiting the title. */}
        <div className="lg:col-span-4 lg:col-start-9 flex lg:justify-end lg:items-start">
          <button
            type="button"
            onClick={() => {
              // Fire-and-forget — signOut() round-trip shouldn't block the
              // redirect. Local state wipes synchronously inside logout().
              void logout();
              router.replace("/");
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.6} />
            Вийти
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Sidebar nav — desktop. Sticks below the fixed header just like
            the catalog filter sidebar. */}
        <aside className="hidden lg:block lg:col-span-3">
          <nav className="sticky top-28 flex flex-col gap-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-full px-5 py-3 text-sm transition-colors",
                    active
                      ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.6} />
                  {item.label}
                </Link>
              );
            })}
            {/* Admin shortcut — only owners see it. The actual route is
                guarded server-side so this flag is just a UI hint. */}
            {user.isAdmin && (
              <Link
                href="/admin"
                className="mt-4 group flex items-center gap-3 rounded-full px-5 py-3 text-sm border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <ShieldCheck className="h-4 w-4" strokeWidth={1.6} />
                Адмінка
              </Link>
            )}
          </nav>
        </aside>

        {/* Mobile nav — horizontal scroll pills above the content. */}
        <nav className="lg:hidden -mx-6 px-6 flex gap-2 overflow-x-auto pb-3">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                    : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
                {item.label}
              </Link>
            );
          })}
          {user.isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm whitespace-nowrap border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)] transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.6} />
              Адмінка
            </Link>
          )}
        </nav>

        <div className="lg:col-span-9">{children}</div>
      </div>
    </Container>
  );
}
