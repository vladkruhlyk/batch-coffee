"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
  type Address,
  type AddressInput,
  type AddressLabel,
} from "@/lib/addresses";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";

/**
 * Addresses tab — manage saved delivery destinations.
 *
 * Now backed by the `addresses` Supabase table (RLS-gated to the
 * current user). The page handles four operations:
 *   - add        → createAddress
 *   - remove     → deleteAddress
 *   - update     → updateAddress
 *   - setDefault → setDefaultAddress (two-step under the hood)
 *
 * Optimistic UI isn't necessary here — the latency is well under the
 * "feels slow" threshold and a failed mutation is easier to recover
 * from when the visible state still reflects the server.
 */
export default function AddressesPage() {
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Address | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Initial load. The auth guard in AccountShell already ensures `user`
  // is present before this page renders, but we still wait on hydration
  // so RLS sees the right session cookie. `loading` starts true so
  // there's no flash of "empty" before the first fetch resolves.
  useEffect(() => {
    if (!hydrated || !user) return;
    let cancelled = false;
    listAddresses()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(messageOf(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, user]);

  const setDefault = useCallback(
    async (id: string) => {
      if (!user) return;
      setBusyId(id);
      setError(null);
      try {
        await setDefaultAddress(user.id, id);
        setItems((prev) =>
          prev.map((a) => ({ ...a, isDefault: a.id === id })),
        );
      } catch (e) {
        setError(messageOf(e));
      } finally {
        setBusyId(null);
      }
    },
    [user],
  );

  const remove = useCallback(async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await deleteAddress(id);
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusyId(null);
    }
  }, []);

  const upsert = useCallback(
    async (next: AddressInput, existingId: string | null) => {
      if (!user) return;
      setError(null);
      try {
        if (existingId) {
          const updated = await updateAddress(existingId, next);
          setItems((prev) =>
            prev.map((a) =>
              a.id === existingId ? { ...updated, isDefault: a.isDefault } : a,
            ),
          );
        } else {
          // First-ever address auto-becomes the default — it's the only
          // one we have, no point making the user toggle it themselves.
          const shouldBeDefault = items.length === 0 || next.isDefault === true;
          if (shouldBeDefault) {
            // Clear any existing default first so the partial unique
            // index doesn't trip. (No-op if list was empty.)
            await Promise.all(
              items
                .filter((a) => a.isDefault)
                .map((a) => setDefaultAddress(user.id, a.id)),
            );
          }
          const created = await createAddress(user.id, {
            ...next,
            isDefault: shouldBeDefault,
          });
          setItems((prev) => {
            const without = shouldBeDefault
              ? prev.map((a) => ({ ...a, isDefault: false }))
              : prev;
            return [...without, created];
          });
        }
        setEditing(null);
        setShowForm(false);
      } catch (e) {
        setError(messageOf(e));
      }
    },
    [items, user],
  );

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.025em]">
            Адреси
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Збережені точки доставки для швидкого оформлення замовлень.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-5 py-2.5 text-sm hover:opacity-85 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Додати адресу
        </button>
      </header>

      {/* Add/edit form — collapses cleanly under the header */}
      <AnimatePresence>
        {(showForm || editing) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASING.smooth }}
            className="overflow-hidden"
          >
            <AddressForm
              initial={editing}
              onCancel={() => {
                setEditing(null);
                setShowForm(false);
              }}
              onSubmit={(input) =>
                upsert(input, editing ? editing.id : null)
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-sm text-rose-700 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid place-items-center py-14 text-[var(--color-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {items.map((addr) => (
            <li
              key={addr.id}
              className={cn(
                "rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6 flex flex-col gap-4 transition-opacity",
                busyId === addr.id && "opacity-60 pointer-events-none",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                  <LabelIcon label={addr.label} />
                  {addr.label}
                </span>
                {addr.isDefault && (
                  <span className="inline-flex items-center gap-1 text-[10px] tracking-[0.25em] uppercase rounded-full px-2.5 py-1 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]">
                    <Star className="h-3 w-3" /> За замовч.
                  </span>
                )}
              </div>
              <div>
                <p className="font-display text-lg font-semibold">
                  {addr.recipient}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)] tabular-nums">
                  {addr.phone}
                </p>
              </div>
              <p className="text-sm leading-relaxed flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                <span>
                  {addr.city}, {addr.destination}
                </span>
              </p>

              <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
                {!addr.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefault(addr.id)}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    Зробити основною
                  </button>
                )}
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => setEditing(addr)}
                  aria-label="Редагувати"
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(addr.id)}
                  aria-label="Видалити"
                  className="grid h-9 w-9 place-items-center rounded-full text-rose-700 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline add/edit form. Kept lightweight — full Nova Poshta integration
// (autocomplete отделений / поштоматов) belongs to Phase 3.
// ---------------------------------------------------------------------------

function AddressForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: Address | null;
  onCancel: () => void;
  onSubmit: (input: AddressInput) => Promise<void> | void;
}) {
  const [form, setForm] = useState<AddressInput>(() =>
    initial
      ? {
          label: initial.label,
          recipient: initial.recipient,
          phone: initial.phone,
          city: initial.city,
          destination: initial.destination,
          isDefault: initial.isDefault,
        }
      : {
          label: "Дім",
          recipient: "",
          phone: "",
          city: "",
          destination: "",
          isDefault: false,
        },
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.recipient || !form.phone || !form.city || !form.destination) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7"
    >
      <h3 className="font-display text-xl font-semibold mb-5">
        {initial ? "Редагувати адресу" : "Нова адреса"}
      </h3>

      {/* Label selector */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["Дім", "Робота", "Інше"] as AddressLabel[]).map((lbl) => (
          <button
            key={lbl}
            type="button"
            onClick={() => setForm((s) => ({ ...s, label: lbl }))}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs transition-all duration-300",
              form.label === lbl
                ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
            )}
          >
            <LabelIcon label={lbl} />
            {lbl}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <FormField
          id="recipient"
          label="Отримувач"
          value={form.recipient}
          onChange={(v) => setForm((s) => ({ ...s, recipient: v }))}
          placeholder="Імʼя і прізвище"
        />
        <FormField
          id="phone"
          label="Телефон"
          value={form.phone}
          onChange={(v) => setForm((s) => ({ ...s, phone: v }))}
          placeholder="+380 50 123 45 67"
        />
        <FormField
          id="city"
          label="Місто"
          value={form.city}
          onChange={(v) => setForm((s) => ({ ...s, city: v }))}
          placeholder="Київ"
        />
        <FormField
          id="destination"
          label="Відділення / адреса"
          value={form.destination}
          onChange={(v) => setForm((s) => ({ ...s, destination: v }))}
          placeholder="Нова Пошта №47, Хрещатик 22"
        />
      </div>

      <label className="mt-5 inline-flex items-center gap-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.isDefault}
          onChange={(e) =>
            setForm((s) => ({ ...s, isDefault: e.target.checked }))
          }
          className="h-4 w-4 rounded border-[var(--color-border-strong)]"
        />
        Зробити основною
      </label>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-3 text-sm hover:opacity-85 disabled:opacity-60 disabled:cursor-wait transition-opacity"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Зберегти"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-6 py-3 text-sm hover:border-[var(--color-text-primary)] disabled:opacity-60 transition-colors"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] block mb-2"
      >
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full bg-transparent border-b border-[var(--color-border-strong)] focus:border-[var(--color-text-primary)] pb-2 text-base outline-none transition-colors"
      />
    </div>
  );
}

function LabelIcon({ label }: { label: AddressLabel }) {
  switch (label) {
    case "Дім":
      return <Home className="h-3.5 w-3.5" />;
    case "Робота":
      return <Building2 className="h-3.5 w-3.5" />;
    default:
      return <MapPin className="h-3.5 w-3.5" />;
  }
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-14 px-6 text-center">
      <p className="font-display text-xl font-semibold">Адрес поки немає.</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
        Додай адресу або номер відділення Нової Пошти — і наступне замовлення
        оформиш в один клік.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-3 text-sm hover:opacity-85 transition-opacity"
      >
        <Plus className="h-4 w-4" /> Додати адресу
      </button>
    </div>
  );
}

/** Pull a human-readable string out of whatever Supabase / fetch threw. */
function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Щось пішло не так. Спробуй ще раз.";
}
