"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, formatPhone } from "@/lib/auth-store";
import { useCart } from "@/lib/cart-store";
import { useSubscription } from "@/lib/subscription-store";
import { EASING } from "@/lib/easing";

/**
 * Profile tab — edit personal details.
 *
 * Today writes go through `useAuth.updateProfile` (local Zustand patch
 * persisted to localStorage). When the backend lands this becomes a
 * Supabase `update` on the `profiles` table — same call signature.
 *
 * Phone is intentionally read-only: changing the verified number means
 * re-running the OTP flow on a new number, which deserves a dedicated
 * "Змінити номер" wizard rather than an inline input. We'll add that
 * in the auth flow phase.
 */
export default function ProfilePage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const updateProfile = useAuth((s) => s.updateProfile);
  const logout = useAuth((s) => s.logout);
  const clearCart = useCart((s) => s.clear);
  const resetSubscription = useSubscription((s) => s.reset);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [newsletter, setNewsletter] = useState(user?.newsletter ?? true);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-hydrate form when the auth-store user changes (e.g. once
  // localStorage rehydrates after first paint). Legitimate sync-from-
  // external-store pattern; lint warns conservatively about
  // setState-in-effect but here it's the right shape.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setEmail(user.email ?? "");
      setNewsletter(user.newsletter ?? true);
    }
  }, [user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      email: email.trim() || undefined,
      newsletter,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.025em]">
          Профіль
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Імʼя, email, налаштування розсилки. Зміни зберігаються одразу.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-8"
      >
        {/* Phone — read only */}
        <div className="mb-6">
          <label className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] block mb-2">
            Телефон
          </label>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-strong)] pb-2">
            <span className="text-base tabular-nums">
              {formatPhone(user.phone)}
            </span>
            <span className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
              Підтверджений
            </span>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
            Щоб змінити номер, доведеться підтвердити новий по SMS — кнопка
            зʼявиться коли підключимо реальний бекенд.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field
            id="firstName"
            label="Імʼя"
            value={firstName}
            onChange={setFirstName}
            placeholder="Влад"
            autoComplete="given-name"
          />
          <Field
            id="lastName"
            label="Прізвище"
            value={lastName}
            onChange={setLastName}
            placeholder="Кругляк"
            autoComplete="family-name"
          />
          <div className="sm:col-span-2">
            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="ti@example.com"
              autoComplete="email"
            />
          </div>
        </div>

        {/* Newsletter toggle */}
        <div className="mt-7 pt-6 border-t border-[var(--color-border-default)]">
          <button
            type="button"
            onClick={() => setNewsletter((n) => !n)}
            aria-pressed={newsletter}
            className="flex items-center gap-3 text-sm"
          >
            <span
              className={`relative block h-6 w-11 rounded-full transition-colors duration-300 ${newsletter ? "bg-[var(--color-text-primary)]" : "bg-[var(--color-border-strong)]"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-[left] duration-300 ${newsletter ? "left-[22px]" : "left-0.5"}`}
              />
            </span>
            <span>
              <span className="block text-[var(--color-text-primary)]">
                Отримувати розсилку
              </span>
              <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
                Новинки, історії ферм, рецепти заварювання — без спаму.
              </span>
            </span>
          </button>
        </div>

        <div className="mt-7 flex items-center gap-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
          >
            Зберегти
          </button>
          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.35, ease: EASING.smooth }}
                className="inline-flex items-center gap-2 text-sm text-emerald-700"
              >
                <Check className="h-4 w-4" /> Збережено
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </form>

      {/* Danger zone — inline two-step confirm. In mock mode "delete"
          wipes all local stores (auth + cart + subscription) and bounces
          home; when Supabase lands this also fires a DELETE on the user
          row + cascades. */}
      <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 p-6 lg:p-7">
        <h3 className="font-display text-lg font-semibold text-rose-900">
          Видалити акаунт
        </h3>
        <p className="mt-2 text-sm text-rose-900/80 max-w-2xl leading-relaxed">
          Усі замовлення, адреси й історія підписки буде стерто. Це не можна
          скасувати. Якщо хочеш просто на час припинити — краще скасувати
          підписку у відповідній вкладці.
        </p>
        {confirmDelete ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                resetSubscription();
                clearCart();
                // Fire-and-forget Supabase signOut — local state wipes
                // synchronously inside logout(), so the redirect is safe.
                void logout();
                router.replace("/");
              }}
              className="inline-flex items-center gap-2 rounded-full bg-rose-700 text-white px-5 py-2.5 text-sm hover:bg-rose-800 transition-colors"
            >
              Так, видалити назавжди
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm text-rose-900 hover:bg-rose-100 transition-colors"
            >
              Передумав
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white px-5 py-2.5 text-sm text-rose-700 hover:bg-rose-100 transition-colors"
          >
            Видалити мій акаунт
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
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
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full bg-transparent border-b border-[var(--color-border-strong)] focus:border-[var(--color-text-primary)] pb-2 text-base outline-none transition-colors"
      />
    </div>
  );
}
