import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AccountShell } from "@/components/account/account-shell";

/**
 * Shared layout for every /account/* route — wraps children in the
 * AccountShell (auth guard + sidebar nav) and the global Header/Footer.
 *
 * Layouts in App Router persist between sibling navigations, so the
 * sidebar's active-pill animation and any cached auth state stay smooth
 * when switching between, say, /account/orders → /account/profile.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <AccountShell>{children}</AccountShell>
      </main>
      <Footer />
    </>
  );
}
