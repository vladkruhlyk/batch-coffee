/**
 * Seed a handful of demo orders for the admin UI to chew on while the
 * real checkout isn't wired yet. Idempotent-ish: each run inserts a
 * fresh batch with auto-generated BAT-NNNN numbers, so re-running
 * creates more rows rather than failing.
 *
 * Run with:
 *   cd web && npx tsx scripts/seed-test-orders.ts <profile-email>
 *
 * The email is the customer whose user_id will own the orders.
 * Defaults to the first admin in `profiles` if omitted, which is
 * convenient for solo-testing.
 *
 * Uses the service-role key so RLS is bypassed — that's why this
 * lives in scripts/ and not inside the app runtime.
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Demo data. Three orders covering different statuses so every pill colour
// in the admin shows up, with a small mix of products that exist in
// data/products.ts (slugs match the catalog).
// ---------------------------------------------------------------------------

type OrderTemplate = {
  status:
    | "pending"
    | "paid"
    | "packing"
    | "shipped"
    | "delivered"
    | "cancelled";
  deliveryMethod: "novaposhta-branch" | "novaposhta-postomat" | "pickup";
  paymentMethod: "card" | "cod";
  city: string;
  address: string;
  comment?: string;
  trackingNumber?: string;
  items: Array<{
    slug: string;
    name: string;
    weightLabel: string;
    weightGrams: number;
    roast?: string;
    grind?: string;
    unitPrice: number; // grivnas (integer)
    quantity: number;
  }>;
};

const ORDERS: OrderTemplate[] = [
  {
    status: "paid",
    deliveryMethod: "novaposhta-branch",
    paymentMethod: "card",
    city: "Київ",
    address: "Нова Пошта №47, вул. Хрещатик 22",
    comment: "Будь ласка, прикладіть стікер з рекомендаціями по варінню.",
    items: [
      {
        slug: "ethiopia-sidamo",
        name: "Ефіопія Сідамо",
        weightLabel: "250 г",
        weightGrams: 250,
        roast: "Фільтр",
        grind: "Цільні зерна",
        unitPrice: 420,
        quantity: 2,
      },
      {
        slug: "drip-house-blend",
        name: "Дріп · House Blend",
        weightLabel: "6 шт",
        weightGrams: 72,
        unitPrice: 180,
        quantity: 1,
      },
    ],
  },
  {
    status: "packing",
    deliveryMethod: "novaposhta-postomat",
    paymentMethod: "card",
    city: "Львів",
    address: "Поштомат №10231, вул. Городоцька 152",
    items: [
      {
        slug: "colombia-huila",
        name: "Колумбія Уїла",
        weightLabel: "500 г",
        weightGrams: 500,
        roast: "Еспресо",
        grind: "Цільні зерна",
        unitPrice: 760,
        quantity: 1,
      },
    ],
  },
  {
    status: "shipped",
    deliveryMethod: "novaposhta-branch",
    paymentMethod: "cod",
    city: "Одеса",
    address: "Нова Пошта №3, вул. Дерибасівська 10",
    trackingNumber: "20451098765432",
    items: [
      {
        slug: "kenya-aa",
        name: "Кенія AA",
        weightLabel: "250 г",
        weightGrams: 250,
        roast: "Фільтр",
        grind: "Середній (для V60)",
        unitPrice: 480,
        quantity: 1,
      },
      {
        slug: "ethiopia-sidamo",
        name: "Ефіопія Сідамо",
        weightLabel: "250 г",
        weightGrams: 250,
        roast: "Фільтр",
        grind: "Цільні зерна",
        unitPrice: 420,
        quantity: 1,
      },
    ],
  },
];

// ---------------------------------------------------------------------------

async function findOwnerProfile(emailArg?: string) {
  if (emailArg) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, phone")
      .eq("email", emailArg)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error(`No profile with email ${emailArg}`);
    }
    return data;
  }
  // Fallback — pick the first admin so solo-testing "just works".
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, phone")
    .eq("is_admin", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No admin profile found. Pass an email arg, or flip is_admin on a profile first.",
    );
  }
  return data;
}

async function seedOrder(
  owner: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  },
  template: OrderTemplate,
) {
  const subtotal = template.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );
  const deliveryFee = template.deliveryMethod === "pickup" ? 0 : 80;
  const total = subtotal + deliveryFee;

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: owner.id,
      status: template.status,
      subtotal,
      delivery_fee: deliveryFee,
      discount: 0,
      total,
      delivery_method: template.deliveryMethod,
      delivery_address: template.address,
      delivery_city: template.city,
      payment_method: template.paymentMethod,
      recipient_first_name: owner.first_name ?? "Тест",
      recipient_last_name: owner.last_name ?? "Тестовий",
      recipient_phone: owner.phone ?? "+380000000000",
      recipient_email: owner.email,
      comment: template.comment ?? null,
      tracking_number: template.trackingNumber ?? null,
    })
    .select("id, number")
    .single();

  if (error) throw error;

  const itemsPayload = template.items.map((i) => ({
    order_id: order.id,
    product_slug: i.slug,
    product_name: i.name,
    weight_label: i.weightLabel,
    weight_grams: i.weightGrams,
    roast: i.roast ?? null,
    grind: i.grind ?? null,
    unit_price: i.unitPrice,
    quantity: i.quantity,
    line_total: i.unitPrice * i.quantity,
  }));

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(itemsPayload);
  if (itemsErr) throw itemsErr;

  return order.number as string;
}

(async () => {
  const email = process.argv[2];
  const owner = await findOwnerProfile(email);
  console.log(
    `Seeding ${ORDERS.length} orders for ${owner.email ?? owner.id} (${owner.first_name ?? "?"})…`,
  );
  for (const tpl of ORDERS) {
    const number = await seedOrder(owner, tpl);
    console.log(`  ✔ ${number}  ${tpl.status.padEnd(10)} ${tpl.city}`);
  }
  console.log("Done.");
})().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
