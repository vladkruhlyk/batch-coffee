import { createSupabaseBrowserClient } from "./supabase/client";

/**
 * Saved delivery destinations for the logged-in user.
 *
 * Thin CRUD wrapper around the `addresses` Postgres table. RLS gates
 * every query — server enforces `auth.uid() = user_id` so a missing or
 * wrong session naturally yields an empty list / 401. Call sites stay
 * unaware of those policies and just treat errors as "couldn't reach
 * the server" cases.
 *
 * Column mapping: Postgres uses snake_case (`is_default`, `user_id`)
 * while the rest of the app speaks camelCase. We translate at the
 * boundary so the UI never sees the database naming convention.
 */

export type AddressLabel = "Дім" | "Робота" | "Інше";

export interface Address {
  id: string;
  label: AddressLabel;
  recipient: string;
  phone: string;
  city: string;
  /** Nova Poshta branch / postomat / street address. */
  destination: string;
  isDefault: boolean;
}

/** Input shape for create/update — id is server-generated, isDefault is
 *  managed through `setDefaultAddress` so it stays out of the regular
 *  update path (otherwise two simultaneous "set default" toggles could
 *  briefly violate the partial unique index). */
export type AddressInput = Omit<Address, "id" | "isDefault"> & {
  isDefault?: boolean;
};

interface AddressRow {
  id: string;
  user_id: string;
  label: AddressLabel;
  recipient: string;
  phone: string;
  city: string;
  destination: string;
  is_default: boolean;
  created_at: string;
}

function rowToAddress(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label,
    recipient: row.recipient,
    phone: row.phone,
    city: row.city,
    destination: row.destination,
    isDefault: row.is_default,
  };
}

/** List the current user's addresses, default first, then by creation. */
export async function listAddresses(): Promise<Address[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as AddressRow[]).map(rowToAddress);
}

/** Insert a new address for `userId`. If `isDefault` is true, the
 *  caller should have already cleared any prior default — we don't do
 *  it here to keep this function single-purpose. Use the higher-level
 *  flow in the page that wraps both in sequence. */
export async function createAddress(
  userId: string,
  input: AddressInput,
): Promise<Address> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: userId,
      label: input.label,
      recipient: input.recipient,
      phone: input.phone,
      city: input.city,
      destination: input.destination,
      is_default: input.isDefault ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToAddress(data as AddressRow);
}

/** Update mutable fields. `is_default` is intentionally excluded — see
 *  the `AddressInput` comment. */
export async function updateAddress(
  id: string,
  input: AddressInput,
): Promise<Address> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("addresses")
    .update({
      label: input.label,
      recipient: input.recipient,
      phone: input.phone,
      city: input.city,
      destination: input.destination,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToAddress(data as AddressRow);
}

export async function deleteAddress(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw error;
}

/** Atomically (well — two-step) mark one address as default and unset
 *  every other one for this user. Order matters: we clear first to
 *  avoid tripping the `addresses_one_default_per_user` partial unique
 *  index when transitioning between two different rows. */
export async function setDefaultAddress(
  userId: string,
  id: string,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error: clearErr } = await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);
  if (clearErr) throw clearErr;

  const { error: setErr } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id);
  if (setErr) throw setErr;
}
