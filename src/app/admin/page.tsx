import { redirect } from "next/navigation";

/**
 * Admin root — no dashboard yet, so we just send the user to the only
 * section that exists. When we add e.g. /admin/customers or analytics,
 * this turns into a proper landing.
 */
export default function AdminIndexPage() {
  redirect("/admin/orders");
}
