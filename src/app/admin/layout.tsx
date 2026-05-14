import Link from "next/link";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { LogOut, PackageOpen } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/layout/container";

/**
 * Admin shell — runs as a server component so the access check happens
 * before any HTML is sent. Two outcomes:
 *   - No session → redirect to /login?next=/admin (after login, bounce back)
 *   - Session but is_admin = false → redirect to "/" (silently — we don't
 *     advertise the route)
 *
 * Doing the gate server-side means a hostile client can't bypass it by
 * disabling JS or editing the bundle. RLS still backstops every query
 * (admin policies are scoped to `is_current_user_admin()`), so even if
 * this guard somehow let a non-admin through, they'd see empty data.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, first_name, last_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect("/");
  }

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email ||
    "Адмін";

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Compact admin header — utilitarian on purpose, this isn't a
          customer-facing page. No site nav, no cart, no search; just
          the section title and a way back out. */}
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-primary)]">
        <Container size="wide">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-6">
              <Link
                href="/admin"
                className="font-display text-lg font-semibold tracking-[-0.02em]"
              >
                BATCH · Admin
              </Link>
              <nav className="hidden sm:flex items-center gap-1 text-sm">
                <Link
                  href="/admin/orders"
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <PackageOpen className="h-4 w-4" strokeWidth={1.6} />
                  Замовлення
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="hidden md:inline text-[var(--color-text-muted)]">
                {displayName}
              </span>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-4 py-2 text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)] transition-colors"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.6} />
                На сайт
              </Link>
            </div>
          </div>
        </Container>
      </header>

      <Container size="wide" className="py-10 lg:py-14">
        {children}
      </Container>
    </div>
  );
}
