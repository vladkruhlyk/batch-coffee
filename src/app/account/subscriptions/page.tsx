import { SubscriptionComingSoon } from "@/components/subscription/coming-soon";

/**
 * /account/subscriptions — UI for pause / cancel / change-schedule of
 * an active subscription. Gated off alongside /subscription/setup
 * because there's nothing to manage yet (no recurring charges run).
 *
 * Full management UI is preserved in git history; restore by reverting
 * this file. AccountShell still wraps the route, so the customer
 * lands here from the sidebar and sees the "коли запрацює — скажемо"
 * notice in place of the mock controls.
 */
export default function AccountSubscriptionsPage() {
  return <SubscriptionComingSoon context="manage" />;
}
