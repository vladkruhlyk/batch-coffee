/**
 * Dump an order + its items to stdout for debugging. Service-role so RLS
 * doesn't get in the way.
 *
 *   npx tsx scripts/inspect-order.ts BAT-1003
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

(async () => {
  const number = process.argv[2];
  if (!number) {
    console.error("Pass an order number, e.g. BAT-1003");
    process.exit(1);
  }
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("number", number)
    .single();
  if (error) throw error;
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);
  console.log("Order:");
  console.dir(order, { depth: null });
  console.log("\nItems:");
  console.dir(items, { depth: null });
})();
