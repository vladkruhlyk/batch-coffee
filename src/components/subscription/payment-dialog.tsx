"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CreditCard, Loader2, Lock, X } from "lucide-react";
import { EASING } from "@/lib/easing";
import { formatPrice, cn } from "@/lib/utils";

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Final amount the user is paying for this subscription cycle. */
  amount: number;
  /** Short label shown on the receipt row — e.g. "Колумбія Уїла · 500 г". */
  summary: string;
  /** Subscription cadence label — "Раз на 2 тижні". */
  cadenceLabel: string;
  /** Called after the (mocked) payment succeeds. The parent then writes
   *  to the subscription store + routes to /account/subscriptions. */
  onSuccess: () => void;
}

/**
 * Payment dialog — mock LiqPay-style overlay for subscription checkout.
 *
 * Card form is intentionally lightweight: we don't validate or store
 * card data ourselves (PCI compliance). When wiring real LiqPay, this
 * component swaps in their recurring-token form (iframe / redirect).
 * The two outcomes — success / cancel — stay the same.
 *
 * Input formatting is just cosmetic (groups of 4 for the card number,
 * MM/YY mask for expiry). The real fields get tokenised by the
 * provider, so even the values we hold here are throwaway.
 */
export function PaymentDialog({
  open,
  onClose,
  amount,
  summary,
  cadenceLabel,
  onSuccess,
}: PaymentDialogProps) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state when dialog reopens so prior aborted attempts don't leak
  // partial input into the next session. Tied to `open` flipping
  // false→true — exactly the moment we want a fresh form.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setNumber("");
      setExpiry("");
      setCvc("");
      setName("");
      setSubmitting(false);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    // Mock LiqPay latency — real flow would do a 3-D Secure redirect that
    // takes 2-6 seconds. 1.2s is enough to read as a real network call
    // without being annoying.
    await new Promise((r) => setTimeout(r, 1200));
    onSuccess();
  };

  // Format helpers — purely cosmetic, no validation.
  const handleNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 16);
    const groups = digits.match(/.{1,4}/g) ?? [];
    setNumber(groups.join(" "));
  };
  const handleExpiry = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) setExpiry(digits);
    else setExpiry(digits.slice(0, 2) + "/" + digits.slice(2));
  };
  const handleCvc = (raw: string) => {
    setCvc(raw.replace(/\D/g, "").slice(0, 4));
  };

  const ready =
    number.replace(/\s/g, "").length >= 16 &&
    expiry.length === 5 &&
    cvc.length >= 3 &&
    name.trim().length > 1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={submitting ? undefined : onClose}
            className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            key="dialog"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.35, ease: EASING.smooth }}
            role="dialog"
            aria-label="Оплата підписки"
            className="fixed inset-x-3 bottom-3 lg:inset-x-auto lg:left-1/2 lg:top-1/2 lg:bottom-auto lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[520px] z-[130] rounded-[var(--radius-2xl)] bg-[var(--color-bg-primary)] shadow-[0_30px_70px_-12px_rgba(0,0,0,0.4)] max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-3 px-6 py-5 border-b border-[var(--color-border-default)]">
              <div>
                <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                  Оплата підписки
                </span>
                <p className="mt-1 font-display text-xl lg:text-2xl font-semibold tracking-[-0.025em]">
                  {formatPrice(amount)}{" "}
                  <span className="text-sm font-medium text-[var(--color-text-muted)]">
                    / {cadenceLabel.toLowerCase()}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label="Закрити"
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Summary row */}
            <div className="px-6 pt-5">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                <span className="text-[var(--color-text-primary)] font-medium">
                  {summary}
                </span>{" "}
                · перше списання сьогодні, далі — {cadenceLabel.toLowerCase()}.
              </p>
            </div>

            {/* Card form */}
            <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-5">
              <Field
                id="card-number"
                label="Номер картки"
                icon={<CreditCard className="h-4 w-4" />}
                value={number}
                onChange={handleNumber}
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                autoComplete="cc-number"
              />

              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="card-expiry"
                  label="MM/YY"
                  value={expiry}
                  onChange={handleExpiry}
                  placeholder="12/27"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                />
                <Field
                  id="card-cvc"
                  label="CVC"
                  value={cvc}
                  onChange={handleCvc}
                  placeholder="123"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </div>

              <Field
                id="card-name"
                label="Імʼя власника картки"
                value={name}
                onChange={setName}
                placeholder="VLAD KRUHLYK"
                autoComplete="cc-name"
              />

              <button
                type="submit"
                disabled={!ready || submitting}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-4 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Обробляємо…
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Підтвердити та оплатити
                  </>
                )}
              </button>

              <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed text-center">
                Оплата через LiqPay · PCI-DSS · Дані картки до нас не доходять.
                Демо-режим: введи будь-які значення.
              </p>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
  icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric";
  autoComplete?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] block mb-2"
      >
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-3 border-b border-[var(--color-border-strong)] focus-within:border-[var(--color-text-primary)] pb-2 transition-colors",
        )}
      >
        {icon && (
          <span className="text-[var(--color-text-muted)]" aria-hidden>
            {icon}
          </span>
        )}
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className="flex-1 bg-transparent text-base outline-none tabular-nums placeholder:text-[var(--color-text-muted)]"
        />
      </div>
    </div>
  );
}
