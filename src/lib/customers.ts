import { createSupabaseBrowserClient } from "./supabase/client";
import type { Order } from "./orders";

/**
 * Customers module — admin-only views over the `profiles` table.
 *
 * RLS lets admins read every profile (see migration 0002). For regular
 * users these queries would return only their own row anyway, so
 * there's no extra authorisation here.
 */

export interface CustomerProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  newsletter: boolean;
  isAdmin: boolean;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  newsletter: boolean;
  is_admin: boolean;
  created_at: string;
}

function rowToCustomer(row: ProfileRow): CustomerProfile {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    newsletter: row.newsletter,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
  };
}

export async function listCustomers(): Promise<CustomerProfile[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ProfileRow[]).map(rowToCustomer);
}

export async function getCustomer(
  id: string,
): Promise<CustomerProfile | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCustomer(data as ProfileRow) : null;
}

// ---------------------------------------------------------------------------
// Derived per-customer aggregates. We compute these client-side after
// listOrders() so we don't need a separate Postgres view. Fine for
// "shop has 200 customers" scale; becomes a SQL view once we hit
// tens-of-thousands.
// ---------------------------------------------------------------------------

export interface CustomerStats {
  /** Number of non-cancelled orders the customer has placed. */
  orderCount: number;
  /** Sum of `total` across non-cancelled orders, in grivnas. */
  totalSpent: number;
  /** ISO date of the most recent order, or null if no orders yet. */
  lastOrderAt: string | null;
}

export function computeCustomerStats(
  orders: Pick<Order, "status" | "total" | "createdAt">[],
): CustomerStats {
  const valid = orders.filter((o) => o.status !== "cancelled");
  return {
    orderCount: valid.length,
    totalSpent: valid.reduce((sum, o) => sum + o.total, 0),
    lastOrderAt:
      valid.length === 0
        ? null
        : valid.reduce<string>(
            (latest, o) => (o.createdAt > latest ? o.createdAt : latest),
            valid[0].createdAt,
          ),
  };
}
