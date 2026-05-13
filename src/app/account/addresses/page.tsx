"use client";

import { useState } from "react";
import { Building2, Home, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getMockAddresses, type MockAddress } from "@/data/mock-account";
import { cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";

/**
 * Addresses tab — manage saved delivery destinations.
 *
 * Local CRUD only (mock-mode). Each operation maps 1:1 to a future
 * Supabase row mutation:
 *   - add        → INSERT INTO addresses
 *   - remove     → DELETE WHERE id = ...
 *   - setDefault → UPDATE addresses SET is_default = (id = ?)
 *   - update     → UPDATE WHERE id = ...
 * The component state is keyed on the address `id` so re-renders stay
 * stable when the real API takes over.
 */
export default function AddressesPage() {
  const [items, setItems] = useState<MockAddress[]>(() => getMockAddresses());
  const [editing, setEditing] = useState<MockAddress | null>(null);
  const [showForm, setShowForm] = useState(false);

  const setDefault = (id: string) => {
    setItems((prev) =>
      prev.map((a) => ({ ...a, isDefault: a.id === id })),
    );
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((a) => a.id !== id));
  };

  const upsert = (next: MockAddress) => {
    setItems((prev) => {
      const exists = prev.some((a) => a.id === next.id);
      if (exists) return prev.map((a) => (a.id === next.id ? next : a));
      return [...prev, next];
    });
    setEditing(null);
    setShowForm(false);
  };

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
              onSubmit={upsert}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {items.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {items.map((addr) => (
            <li
              key={addr.id}
              className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6 flex flex-col gap-4"
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
  initial: MockAddress | null;
  onCancel: () => void;
  onSubmit: (addr: MockAddress) => void;
}) {
  // `Date.now()` inside the useState arg would be called during render —
  // React 19 flags it as "impure during render". Wrap in a lazy initializer
  // so it runs exactly once when the component mounts.
  const [form, setForm] = useState<MockAddress>(() =>
    initial ?? {
      id: `addr-${Date.now()}`,
      label: "Дім",
      recipient: "",
      phone: "",
      city: "",
      destination: "",
      isDefault: false,
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipient || !form.phone || !form.city || !form.destination) {
      return;
    }
    onSubmit(form);
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
        {(["Дім", "Робота", "Інше"] as const).map((lbl) => (
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
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-3 text-sm hover:opacity-85 transition-opacity"
        >
          Зберегти
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-6 py-3 text-sm hover:border-[var(--color-text-primary)] transition-colors"
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

function LabelIcon({ label }: { label: MockAddress["label"] }) {
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
