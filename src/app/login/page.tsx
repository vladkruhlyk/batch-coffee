"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Container } from "@/components/layout/container";
import { useAuth, formatPhone, normalizePhone } from "@/lib/auth-store";
import { EASING } from "@/lib/easing";
import { cn } from "@/lib/utils";

/**
 * Login page — phone + OTP, two-step flow on a single route.
 *
 * The page renders one of two panels driven by `step` in the auth store:
 *   - "idle"      → phone input + "Отримати код"
 *   - "code-sent" → 4-digit OTP with auto-advance + resend countdown
 *
 * Once `verifyCode` succeeds the `user` field flips truthy in the store
 * and the effect below pushes to `/account` (or `?next=` if present).
 *
 * Backed by the mock auth store today — `requestCode`/`verifyCode` are
 * already fire-and-forget async, so swapping to Supabase signInWithOtp /
 * verifyOtp later requires no UI changes here.
 */
/**
 * Top-level page — wraps the inner component in <Suspense> so Next.js
 * can statically prerender this route. `useSearchParams()` inside
 * `LoginInner` is a CSR-only API; without the Suspense boundary the
 * static build pass throws.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextHref = params.get("next") ?? "/account";

  const user = useAuth((s) => s.user);
  const step = useAuth((s) => s.step);
  const pendingPhone = useAuth((s) => s.pendingPhone);
  const error = useAuth((s) => s.error);
  const errorBump = useAuth((s) => s.errorBump);
  const hydrated = useAuth((s) => s.hydrated);
  const requestCode = useAuth((s) => s.requestCode);
  const verifyCode = useAuth((s) => s.verifyCode);
  const resetFlow = useAuth((s) => s.resetFlow);

  // Already logged in? Bounce immediately. Wait for hydration so we don't
  // flash the login form during the SSR → client handoff.
  useEffect(() => {
    if (hydrated && user) {
      router.replace(nextHref);
    }
  }, [hydrated, user, router, nextHref]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      <Container size="default" className="flex-1 flex items-center py-24">
        <div className="w-full max-w-md mx-auto">
          {/* Back to home — subtle, top-left of the card */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-10"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> На головну
          </Link>

          <AnimatePresence mode="wait">
            {step === "code-sent" ? (
              <CodeStep
                key="code"
                phone={pendingPhone}
                error={error}
                errorBump={errorBump}
                onVerify={verifyCode}
                onBack={resetFlow}
                onResend={async () => {
                  if (pendingPhone) await requestCode(pendingPhone);
                }}
              />
            ) : (
              <PhoneStep
                key="phone"
                error={error}
                errorBump={errorBump}
                onSubmit={requestCode}
              />
            )}
          </AnimatePresence>
        </div>
      </Container>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — phone input.
// ---------------------------------------------------------------------------

function PhoneStep({
  error,
  errorBump,
  onSubmit,
}: {
  error: string | null;
  errorBump: number;
  onSubmit: (phone: string) => Promise<void>;
}) {
  const [value, setValue] = useState("+380 ");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Allow only digits, spaces, and a leading "+". Keep prefix sticky so
    // the user can't accidentally delete the country code.
    let v = e.target.value;
    if (!v.startsWith("+")) v = "+" + v.replace(/[^\d]/g, "");
    // Re-format Ukrainian numbers as the user types — purely cosmetic.
    const normalized = normalizePhone(v);
    setValue(
      normalized.startsWith("+380") && normalized.length > 4
        ? formatPhone(normalized.padEnd(13, "_")).replaceAll("_", "").trimEnd()
        : normalized,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(value);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: EASING.smooth }}
    >
      <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
        Вхід / Реєстрація
      </span>
      <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.035em] mt-4">
        Заходимо за номером телефона.
      </h1>
      <p className="text-[var(--color-text-secondary)] leading-relaxed mt-5">
        Введи свій номер — пришлемо код в SMS. Якщо акаунту ще нема — створимо
        його за секунду. Без паролів, без зайвих кроків.
      </p>

      <form onSubmit={handleSubmit} className="mt-10">
        <label
          htmlFor="phone"
          className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] block mb-3"
        >
          Номер телефону
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
          value={value}
          onChange={handleChange}
          placeholder="+380 50 123 45 67"
          className="w-full text-xl font-display tabular-nums bg-transparent border-b-2 border-[var(--color-border-strong)] focus:border-[var(--color-text-primary)] pb-3 outline-none transition-colors"
        />

        <ErrorLine error={error} errorBump={errorBump} />

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 inline-flex items-center gap-3 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-4 text-sm tracking-[0.12em] uppercase transition-opacity duration-300 hover:opacity-85 disabled:opacity-60 disabled:cursor-wait"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Отримати код <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Demo hint — only relevant while mocks are live. Replace this with
          regular fine-print copy when the backend lands. */}
      <p className="mt-8 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
        Демо-режим: SMS не відправляється. На наступному кроці введи{" "}
        <span className="text-[var(--color-text-primary)] font-medium">
          будь-які 4 цифри
        </span>
        — система прийме.
      </p>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — 4-digit OTP with auto-advance + resend countdown.
// ---------------------------------------------------------------------------

const CODE_LENGTH = 4;
const RESEND_SECONDS = 60;

function CodeStep({
  phone,
  error,
  errorBump,
  onVerify,
  onBack,
  onResend,
}: {
  phone: string | null;
  error: string | null;
  errorBump: number;
  onVerify: (code: string) => Promise<boolean>;
  onBack: () => void;
  onResend: () => Promise<void>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const nextHref = params.get("next") ?? "/account";

  const [digits, setDigits] = useState<string[]>(() =>
    Array(CODE_LENGTH).fill(""),
  );
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Auto-focus the first cell on mount.
  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  // Countdown for the "Надіслати знову" link.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendIn]);

  const handleVerify = useCallback(
    async (code: string) => {
      if (submitting || code.length !== CODE_LENGTH) return;
      setSubmitting(true);
      try {
        const ok = await onVerify(code);
        if (ok) {
          // Successful login — route to next page.
          router.replace(nextHref);
        } else {
          // Clear cells so the user can type a fresh code without backspacing.
          setDigits(Array(CODE_LENGTH).fill(""));
          inputs.current[0]?.focus();
        }
      } finally {
        setSubmitting(false);
      }
    },
    [onVerify, router, nextHref, submitting],
  );

  const updateDigit = (i: number, raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 1);
    setDigits((prev) => {
      const copy = [...prev];
      copy[i] = next;
      // Auto-advance focus on filled cell.
      if (next && i < CODE_LENGTH - 1) {
        inputs.current[i + 1]?.focus();
      }
      // Auto-submit when all cells filled.
      const joined = copy.join("");
      if (joined.length === CODE_LENGTH && !copy.includes("")) {
        handleVerify(joined);
      }
      return copy;
    });
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && digits[i] === "" && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) {
      inputs.current[i + 1]?.focus();
    }
  };

  // Paste support — drop a copied "1234" into any cell and we fan it out.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (text.length === 0) return;
    e.preventDefault();
    const chars = text.slice(0, CODE_LENGTH).split("");
    const next = Array(CODE_LENGTH).fill("");
    chars.forEach((c, idx) => (next[idx] = c));
    setDigits(next);
    const lastFilled = chars.length - 1;
    inputs.current[Math.min(lastFilled + 1, CODE_LENGTH - 1)]?.focus();
    if (chars.length === CODE_LENGTH) {
      handleVerify(next.join(""));
    }
  };

  const prettyPhone = useMemo(() => formatPhone(phone), [phone]);

  const handleResend = async () => {
    if (resendIn > 0) return;
    await onResend();
    setResendIn(RESEND_SECONDS);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: EASING.smooth }}
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-8"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Інший номер
      </button>

      <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
        Введи код
      </span>
      <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.035em] mt-4">
        Перевіряємо твій номер.
      </h1>
      <p className="text-[var(--color-text-secondary)] leading-relaxed mt-5">
        Відправили код на{" "}
        <span className="text-[var(--color-text-primary)] font-medium tabular-nums">
          {prettyPhone}
        </span>
        . Введи 4 цифри нижче.
      </p>

      <div className="mt-10 flex gap-3" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={d}
            onChange={(e) => updateDigit(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            disabled={submitting}
            aria-label={`Цифра ${i + 1}`}
            className="h-16 w-14 lg:h-20 lg:w-16 rounded-[var(--radius-lg)] border-2 border-[var(--color-border-strong)] bg-transparent text-center text-3xl lg:text-4xl font-display tabular-nums focus:border-[var(--color-text-primary)] outline-none transition-colors disabled:opacity-60"
          />
        ))}
      </div>

      <ErrorLine error={error} errorBump={errorBump} />

      <div className="mt-8 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendIn > 0}
          className={cn(
            "transition-colors",
            resendIn > 0
              ? "text-[var(--color-text-muted)] cursor-not-allowed"
              : "text-[var(--color-text-primary)] hover:opacity-70 underline underline-offset-4 decoration-[var(--color-border-strong)]",
          )}
        >
          {resendIn > 0
            ? `Надіслати знову (${resendIn}s)`
            : "Надіслати код знову"}
        </button>
        {submitting && (
          <span className="inline-flex items-center gap-2 text-[var(--color-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Перевіряємо…
          </span>
        )}
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Shared — inline error line that bumps on every new error (lets the
// motion re-trigger even if the message text is identical).
// ---------------------------------------------------------------------------

function ErrorLine({
  error,
  errorBump,
}: {
  error: string | null;
  errorBump: number;
}) {
  return (
    <div className="mt-3 min-h-[1.25rem] text-sm">
      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            key={`${errorBump}-${error}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASING.smooth }}
            className="text-rose-700"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
