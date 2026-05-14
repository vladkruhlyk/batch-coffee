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
import {
  useAuth,
  formatPhone,
  normalizePhone,
  type AuthMethod,
  type AuthUser,
} from "@/lib/auth-store";
import { EASING } from "@/lib/easing";
import { cn } from "@/lib/utils";

/**
 * Login page — two methods, two-step flow on a single route.
 *
 * Method toggle at the top swaps between phone (SMS OTP, mocked today)
 * and email (real Supabase email OTP). Each method has its own entry
 * step + verification step. The store's `step` field drives which step
 * is visible.
 *
 * Once verification succeeds, `user` flips truthy in the store and the
 * effect below pushes to `/account` (or `?next=` if present).
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
  const method = useAuth((s) => s.method);
  const pendingPhone = useAuth((s) => s.pendingPhone);
  const pendingEmail = useAuth((s) => s.pendingEmail);
  const error = useAuth((s) => s.error);
  const errorBump = useAuth((s) => s.errorBump);
  const hydrated = useAuth((s) => s.hydrated);
  const setMethod = useAuth((s) => s.setMethod);
  const requestCode = useAuth((s) => s.requestCode);
  const verifyCode = useAuth((s) => s.verifyCode);
  const requestEmailCode = useAuth((s) => s.requestEmailCode);
  const verifyEmailCode = useAuth((s) => s.verifyEmailCode);
  const resetFlow = useAuth((s) => s.resetFlow);
  const completeOnboarding = useAuth((s) => s.completeOnboarding);

  // Already logged in AND profile is complete? Bounce immediately. We
  // wait for hydration so we don't flash the login form during the
  // SSR → client handoff. The `step === "idle"` guard keeps the user
  // on the onboarding screen if `verifyEmailCode` flagged them as
  // needing to fill in name + phone first.
  useEffect(() => {
    if (hydrated && user && step === "idle") {
      router.replace(nextHref);
    }
  }, [hydrated, user, step, router, nextHref]);

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
            {step === "needs-profile" ? (
              <OnboardingStep
                key="onboarding"
                user={user}
                error={error}
                errorBump={errorBump}
                onSubmit={completeOnboarding}
              />
            ) : step === "code-sent" ? (
              method === "email" ? (
                <CodeStep
                  key="code-email"
                  destination={pendingEmail}
                  destinationLabel="email"
                  codeLength={8}
                  error={error}
                  errorBump={errorBump}
                  onVerify={verifyEmailCode}
                  onBack={resetFlow}
                  onResend={async () => {
                    if (pendingEmail) await requestEmailCode(pendingEmail);
                  }}
                />
              ) : (
                <CodeStep
                  key="code-phone"
                  destination={pendingPhone}
                  destinationLabel="phone"
                  codeLength={4}
                  error={error}
                  errorBump={errorBump}
                  onVerify={verifyCode}
                  onBack={resetFlow}
                  onResend={async () => {
                    if (pendingPhone) await requestCode(pendingPhone);
                  }}
                />
              )
            ) : (
              <EntryStep
                key="entry"
                method={method}
                error={error}
                errorBump={errorBump}
                onMethodChange={setMethod}
                onSubmitEmail={requestEmailCode}
              />
            )}
          </AnimatePresence>
        </div>
      </Container>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — method toggle + matching input (phone OR email).
// ---------------------------------------------------------------------------

function EntryStep({
  method,
  error,
  errorBump,
  onMethodChange,
  onSubmitEmail,
}: {
  method: AuthMethod;
  error: string | null;
  errorBump: number;
  onMethodChange: (m: AuthMethod) => void;
  onSubmitEmail: (email: string) => Promise<void>;
}) {
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
        {method === "email"
          ? "Заходимо за email."
          : "Вхід за номером телефона."}
      </h1>
      <p className="text-[var(--color-text-secondary)] leading-relaxed mt-5">
        {method === "email"
          ? "Введи свою адресу — пришлемо код на пошту. Якщо акаунту ще нема — створимо його за секунду."
          : "SMS-вхід тимчасово недоступний — налаштовуємо. Поки що, будь ласка, скористайся входом за email."}
      </p>

      {/* Method tabs — phone is primary, email is the alternate. */}
      <MethodTabs method={method} onChange={onMethodChange} />

      {/* AnimatePresence swap so the field morphs in on tab change instead
          of popping. Mode "wait" prevents both forms rendering at once. */}
      <AnimatePresence mode="wait">
        {method === "email" ? (
          <EmailField
            key="email-field"
            error={error}
            errorBump={errorBump}
            onSubmit={onSubmitEmail}
          />
        ) : (
          <PhoneInDevelopment
            key="phone-soon"
            onSwitchToEmail={() => onMethodChange("email")}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Phone tab placeholder — SMS provider isn't wired up yet, so we render a
// notice instead of an input. Keeps the tab visible so customers know
// phone login is on the roadmap. Delete this component (and the branch
// above) once real OTP is hooked through Twilio / TurboSMS — the
// `PhoneField` already lives in git history.
// ---------------------------------------------------------------------------

function PhoneInDevelopment({
  onSwitchToEmail,
}: {
  onSwitchToEmail: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3, ease: EASING.smooth }}
      className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)] px-6 py-7"
    >
      <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
        У розробці
      </span>
      <p className="mt-3 text-[var(--color-text-primary)] leading-relaxed">
        SMS-вхід ще не підключений. Поки що використай вхід за email — це
        займе хвилину.
      </p>
      <button
        type="button"
        onClick={onSwitchToEmail}
        className="mt-6 inline-flex items-center gap-3 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-4 text-sm tracking-[0.12em] uppercase transition-opacity duration-300 hover:opacity-85"
      >
        Увійти через email <ArrowRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Method tabs — segmented control.
// ---------------------------------------------------------------------------

function MethodTabs({
  method,
  onChange,
}: {
  method: AuthMethod;
  onChange: (m: AuthMethod) => void;
}) {
  const tabs: Array<{ key: AuthMethod; label: string }> = [
    { key: "phone", label: "Телефон" },
    { key: "email", label: "Email" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Метод входу"
      className="mt-9 inline-flex rounded-full border border-[var(--color-border-strong)] p-1 bg-[var(--color-bg-primary)]"
    >
      {tabs.map((t) => {
        const active = method === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "px-5 py-2 text-xs tracking-[0.18em] uppercase rounded-full transition-colors",
              active
                ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email field (Step 1, email method).
// ---------------------------------------------------------------------------

function EmailField({
  error,
  errorBump,
  onSubmit,
}: {
  error: string | null;
  errorBump: number;
  onSubmit: (email: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    <motion.form
      onSubmit={handleSubmit}
      className="mt-8"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3, ease: EASING.smooth }}
    >
      <label
        htmlFor="email"
        className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] block mb-3"
      >
        Email
      </label>
      <input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="you@example.com"
        className="w-full text-xl font-display bg-transparent border-b-2 border-[var(--color-border-strong)] focus:border-[var(--color-text-primary)] pb-3 outline-none transition-colors"
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
    </motion.form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — OTP grid with auto-advance + resend countdown.
//
// Shared between phone (4 cells, mock) and email (6 cells, Supabase). Cell
// width shrinks when length=6 so 6 cells still fit on a 360px viewport.
// ---------------------------------------------------------------------------

const RESEND_SECONDS = 60;

function CodeStep({
  destination,
  destinationLabel,
  codeLength,
  error,
  errorBump,
  onVerify,
  onBack,
  onResend,
}: {
  destination: string | null;
  destinationLabel: "phone" | "email";
  codeLength: number;
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
    Array(codeLength).fill(""),
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
      if (submitting || code.length !== codeLength) return;
      setSubmitting(true);
      try {
        const ok = await onVerify(code);
        if (ok) {
          router.replace(nextHref);
        } else {
          // Clear cells so the user can type a fresh code without backspacing.
          setDigits(Array(codeLength).fill(""));
          inputs.current[0]?.focus();
        }
      } finally {
        setSubmitting(false);
      }
    },
    [onVerify, router, nextHref, submitting, codeLength],
  );

  const updateDigit = (i: number, raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 1);
    setDigits((prev) => {
      const copy = [...prev];
      copy[i] = next;
      // Auto-advance focus on filled cell.
      if (next && i < codeLength - 1) {
        inputs.current[i + 1]?.focus();
      }
      // Auto-submit when all cells filled.
      const joined = copy.join("");
      if (joined.length === codeLength && !copy.includes("")) {
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
    if (e.key === "ArrowRight" && i < codeLength - 1) {
      inputs.current[i + 1]?.focus();
    }
  };

  // Paste support — drop a copied "1234" / "123456" into any cell and we
  // fan it out across all cells.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (text.length === 0) return;
    e.preventDefault();
    const chars = text.slice(0, codeLength).split("");
    const next = Array(codeLength).fill("");
    chars.forEach((c, idx) => (next[idx] = c));
    setDigits(next);
    const lastFilled = chars.length - 1;
    inputs.current[Math.min(lastFilled + 1, codeLength - 1)]?.focus();
    if (chars.length === codeLength) {
      handleVerify(next.join(""));
    }
  };

  const prettyDestination = useMemo(() => {
    if (!destination) return "";
    return destinationLabel === "phone" ? formatPhone(destination) : destination;
  }, [destination, destinationLabel]);

  const handleResend = async () => {
    if (resendIn > 0) return;
    await onResend();
    setResendIn(RESEND_SECONDS);
  };

  // Cells scale down as count goes up so the whole row still fits inside
  // the ~312px content column on a 360px viewport.
  //   - 4 cells (phone mock): roomy.
  //   - 6 cells: slim.
  //   - 8 cells (current Supabase email default): tightest, with extra
  //     responsive bump-ups at sm/lg breakpoints.
  const cellClasses =
    codeLength >= 8
      ? "h-12 w-8 sm:h-14 sm:w-10 lg:h-16 lg:w-12 text-xl lg:text-2xl"
      : codeLength >= 6
        ? "h-14 w-10 sm:h-16 sm:w-12 lg:h-20 lg:w-14 text-2xl lg:text-3xl"
        : "h-16 w-14 lg:h-20 lg:w-16 text-3xl lg:text-4xl";

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
        <ArrowLeft className="h-3.5 w-3.5" />{" "}
        {destinationLabel === "phone" ? "Інший номер" : "Інший email"}
      </button>

      <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
        Введи код
      </span>
      <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.035em] mt-4">
        {destinationLabel === "phone"
          ? "Перевіряємо твій номер."
          : "Перевіряємо твою адресу."}
      </h1>
      <p className="text-[var(--color-text-secondary)] leading-relaxed mt-5">
        Відправили код на{" "}
        <span
          className={cn(
            "text-[var(--color-text-primary)] font-medium",
            destinationLabel === "phone" && "tabular-nums",
          )}
        >
          {prettyDestination}
        </span>
        . Введи {codeLength} цифр нижче.
      </p>

      <div
        className={cn(
          "mt-10 flex",
          codeLength >= 8 ? "gap-1.5 sm:gap-2" : "gap-2 sm:gap-3",
        )}
        onPaste={handlePaste}
      >
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
            className={cn(
              "rounded-[var(--radius-lg)] border-2 border-[var(--color-border-strong)] bg-transparent text-center font-display tabular-nums focus:border-[var(--color-text-primary)] outline-none transition-colors disabled:opacity-60",
              cellClasses,
            )}
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

// ---------------------------------------------------------------------------
// Step 3 (first-time email signups only) — ask for name + phone. The
// profile row already exists at this point (created by the on_auth_user_created
// trigger), so completeOnboarding just UPDATEs it. Once the row has all
// three fields, the auth store flips `step` back to "idle" and the page's
// redirect effect carries the user on to /account.
// ---------------------------------------------------------------------------

function OnboardingStep({
  user,
  error,
  errorBump,
  onSubmit,
}: {
  user: AuthUser | null;
  error: string | null;
  errorBump: number;
  onSubmit: (patch: {
    firstName: string;
    lastName: string;
    phone: string;
  }) => Promise<boolean>;
}) {
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  // Pre-fill phone with "+380 " unless we already have one from Supabase.
  const [phone, setPhone] = useState(() => {
    const p = user?.phone?.trim();
    return p && p !== "" ? formatPhone(p) : "+380 ";
  });
  const [submitting, setSubmitting] = useState(false);

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Same sticky-prefix + Ukrainian auto-format trick as the (now-disabled)
    // phone login field. Keeps display nice without rewriting the value
    // every keystroke on non-UA numbers.
    let v = e.target.value;
    if (!v.startsWith("+")) v = "+" + v.replace(/[^\d]/g, "");
    const normalized = normalizePhone(v);
    setPhone(
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
      await onSubmit({ firstName, lastName, phone });
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
        Останній крок
      </span>
      <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.035em] mt-4">
        Як до тебе звертатися?
      </h1>
      <p className="text-[var(--color-text-secondary)] leading-relaxed mt-5">
        Ім&apos;я та прізвище потрібні, щоб привітатися й оформити доставку.
        Номер — щоб кур&apos;єр міг зв&apos;язатися перед прибуттям.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-7">
        <div>
          <label
            htmlFor="firstName"
            className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] block mb-3"
          >
            Ім&apos;я
          </label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            autoFocus
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Влад"
            className="w-full text-xl font-display bg-transparent border-b-2 border-[var(--color-border-strong)] focus:border-[var(--color-text-primary)] pb-3 outline-none transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="lastName"
            className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] block mb-3"
          >
            Прізвище
          </label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Кругляк"
            className="w-full text-xl font-display bg-transparent border-b-2 border-[var(--color-border-strong)] focus:border-[var(--color-text-primary)] pb-3 outline-none transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="onboarding-phone"
            className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] block mb-3"
          >
            Номер телефону
          </label>
          <input
            id="onboarding-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="+380 50 123 45 67"
            className="w-full text-xl font-display tabular-nums bg-transparent border-b-2 border-[var(--color-border-strong)] focus:border-[var(--color-text-primary)] pb-3 outline-none transition-colors"
          />
        </div>

        <ErrorLine error={error} errorBump={errorBump} />

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-3 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-4 text-sm tracking-[0.12em] uppercase transition-opacity duration-300 hover:opacity-85 disabled:opacity-60 disabled:cursor-wait"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Готово <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </motion.section>
  );
}
