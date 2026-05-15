import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SubscriptionComingSoon } from "@/components/subscription/coming-soon";

/**
 * /subscription/setup is the entry point for picking a subscription
 * plan, schedule, and payment method. Disabled until LiqPay recurring
 * + the cron-driven shipment job are wired — customers can't commit
 * to a recurring charge that we can't actually run yet.
 *
 * The full setup flow lives in git history (last working commit:
 * before this rewrite). Restore by reverting this file and re-adding
 * SubscriptionComingSoon usage to the marketing CTAs.
 */
export const metadata: Metadata = {
  title: "Підписка — скоро · BATCH Coffee",
  description:
    "Підписка готується до запуску — поки що оформити її не можна, але каву можна купити разово в каталозі.",
};

export default function SubscriptionSetupPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <SubscriptionComingSoon context="setup" />
      </main>
      <Footer />
    </>
  );
}
