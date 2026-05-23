import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSupabaseBrowserClient } from "./supabase/client";

/**
 * Auth store — two login methods, single user shape.
 *
 * The page exposes two flows:
 *   - "phone" → OTP over SMS. Today this is fully mocked (any 4-digit
 *     code passes). We'll swap in `supabase.auth.signInWithOtp({ phone })`
 *     once an SMS gateway (Twilio / TurboSMS / SMSc.ua) is configured on
 *     the Supabase project. The signatures here are deliberately shaped
 *     to match that swap with zero UI churn.
 *   - "email" → real Supabase email OTP. `signInWithOtp({ email })`
 *     sends a 6-digit token; `verifyOtp({ email, token, type: "email" })`
 *     exchanges it for a session. We mirror the resulting Supabase user
 *     into our `user` field so every consumer of `useAuth` keeps working
 *     identically across both methods.
 *
 * Supabase manages its own httpOnly cookie + refresh token rotation. We
 * persist a thin mirror of the user object in localStorage so the UI can
 * render immediately on page load — `syncFromSupabase()` reconciles
 * against the real session on hydrate.
 */

export type AuthMethod = "phone" | "email";

export interface AuthUser {
  /** Stable id. Supabase assigns UUID; phone-mock derives from phone. */
  id: string;
  /** International E.164 phone, e.g. "+380501234567". Empty for email-only users. */
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** ISO date the account was first created. */
  createdAt: string;
  /** Subscribed to the marketing newsletter — toggled from /account/profile. */
  newsletter?: boolean;
  /** Owner / staff flag from `profiles.is_admin`. Drives visibility of the
   *  /admin link in the account sidebar. The actual route is server-guarded
   *  and RLS-gated — this flag is purely a UI hint. */
  isAdmin?: boolean;
}

export type AuthStep = "idle" | "code-sent" | "needs-profile";

interface AuthState {
  user: AuthUser | null;
  /** Which method the user picked. Drives which inputs the login page shows. */
  method: AuthMethod;
  /** Phone the user is verifying. Set after requestCode, cleared on success/logout. */
  pendingPhone: string | null;
  /** Email the user is verifying. Set after requestEmailCode. */
  pendingEmail: string | null;
  /** Auth flow step — drives the login page's two-step UI. */
  step: AuthStep;
  /** Surface for inline errors on the login page. */
  error: string | null;
  /** Last error timestamp — same wording in a row should still re-trigger UI
   *  animations, so we increment a counter rather than relying on string ref. */
  errorBump: number;

  /** Hydration flag — true once persist has read localStorage AND we've
   *  reconciled against any active Supabase session. Components that guard
   *  routes should wait for this to avoid flashing the wrong UI. */
  hydrated: boolean;

  // -----------------------------------------------------------------------
  // Method toggle
  // -----------------------------------------------------------------------
  setMethod: (method: AuthMethod) => void;

  // -----------------------------------------------------------------------
  // Phone (mock today, Supabase SMS OTP later)
  // -----------------------------------------------------------------------
  requestCode: (phone: string) => Promise<void>;
  /** Verify a phone code. Mock accepts any 4-digit code. Returns true/false
   *  so the caller can react. */
  verifyCode: (code: string) => Promise<boolean>;

  // -----------------------------------------------------------------------
  // Email (real Supabase OTP)
  // -----------------------------------------------------------------------
  requestEmailCode: (email: string) => Promise<void>;
  /** Verify a 6-digit email OTP via Supabase. Returns true on success. */
  verifyEmailCode: (code: string) => Promise<boolean>;

  // -----------------------------------------------------------------------
  // Flow control
  // -----------------------------------------------------------------------
  /** Cancel the in-progress verification — sends user back to the entry step. */
  resetFlow: () => void;
  /** Wipe session entirely. Also signs out of Supabase. */
  logout: () => Promise<void>;
  /** Patch user profile fields locally only. Used by the /account/profile
   *  page for fields it persists itself (newsletter toggle etc). For the
   *  required onboarding fields use `completeOnboarding`. */
  updateProfile: (patch: Partial<Omit<AuthUser, "id" | "createdAt">>) => void;

  /** Persist required onboarding fields (firstName / lastName / phone) to
   *  the `profiles` table and update the local user. Returns true on
   *  success. Sets `step` back to "idle" so the login page's redirect
   *  effect kicks in afterward. */
  completeOnboarding: (patch: {
    firstName: string;
    lastName: string;
    phone: string;
  }) => Promise<boolean>;

  /** Read the Supabase session and overwrite `user` if a real session exists.
   *  Called once on app boot from a top-level `<AuthHydrator />` component. */
  syncFromSupabase: () => Promise<void>;
}

/**
 * Strip everything except digits and a leading "+". Helps us treat
 * "+380 (50) 123-45-67" and "+380501234567" as the same input.
 */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return (hasPlus ? "+" : "") + digits;
}

/**
 * "+380501234567" → "+380 50 123 45 67". Used in display only.
 * Falls back to the raw value for non-Ukrainian numbers — we want
 * pretty formatting where we can, but no broken whitespace otherwise.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const n = normalizePhone(phone);
  if (n.startsWith("+380") && n.length === 13) {
    const a = n.slice(0, 4);
    const b = n.slice(4, 6);
    const c = n.slice(6, 9);
    const d = n.slice(9, 11);
    const e = n.slice(11, 13);
    return `${a} ${b} ${c} ${d} ${e}`;
  }
  return n;
}

/** Minimal RFC-5321-ish check — Supabase will do the real validation. We
 *  only block the obviously-wrong cases so the UI can surface them inline
 *  without a network round-trip. */
function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      // Email is the live method right now — phone OTP gateway isn't
      // configured yet, so we default to the flow that actually works.
      // The phone tab is still rendered but shows an "in development"
      // notice instead of the input.
      method: "email",
      pendingPhone: null,
      pendingEmail: null,
      step: "idle",
      error: null,
      errorBump: 0,
      hydrated: false,

      setMethod: (method) => {
        // Reset error + step when switching tabs so the user isn't greeted
        // by a stale "wrong code" message.
        set({
          method,
          step: "idle",
          error: null,
          pendingPhone: null,
          pendingEmail: null,
        });
      },

      // ---------------------------------------------------------------
      // Phone — mock
      // ---------------------------------------------------------------

      requestCode: async (phone: string) => {
        const normalized = normalizePhone(phone);
        if (!/^\+\d{7,15}$/.test(normalized)) {
          set((s) => ({
            error: "Введи номер у міжнародному форматі — починаючи з «+».",
            errorBump: s.errorBump + 1,
          }));
          return;
        }
        // Mock latency so the UI's loading state has a moment to breathe.
        await new Promise((r) => setTimeout(r, 350));
        set({
          pendingPhone: normalized,
          step: "code-sent",
          error: null,
        });
      },

      verifyCode: async (code: string) => {
        const trimmed = code.trim();
        if (!/^\d{4}$/.test(trimmed)) {
          set((s) => ({
            error: "Код складається з 4 цифр.",
            errorBump: s.errorBump + 1,
          }));
          return false;
        }
        const { pendingPhone } = get();
        if (!pendingPhone) {
          set((s) => ({
            error: "Сесія загубилась. Спробуй знову.",
            errorBump: s.errorBump + 1,
            step: "idle",
          }));
          return false;
        }
        // Mock latency for UX polish.
        await new Promise((r) => setTimeout(r, 450));

        // Mock acceptance: any 4-digit code works. Once we swap in Supabase
        // we'll get a real session token here and `user` becomes whatever
        // the backend assigns. For now: synthesise a user from the phone.
        const now = new Date().toISOString();
        set({
          user: {
            id: `mock-${pendingPhone}`,
            phone: pendingPhone,
            createdAt: now,
          },
          pendingPhone: null,
          step: "idle",
          error: null,
        });
        return true;
      },

      // ---------------------------------------------------------------
      // Email — real Supabase OTP
      // ---------------------------------------------------------------

      requestEmailCode: async (email: string) => {
        const trimmed = email.trim().toLowerCase();
        if (!isPlausibleEmail(trimmed)) {
          set((s) => ({
            error: "Перевір адресу — щось не схоже на email.",
            errorBump: s.errorBump + 1,
          }));
          return;
        }
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: {
            // Auto-create the account if it doesn't exist. Same UX as the
            // phone flow — no separate "register" page.
            shouldCreateUser: true,
          },
        });
        if (error) {
          set((s) => ({
            error: error.message || "Не вдалось надіслати код.",
            errorBump: s.errorBump + 1,
          }));
          return;
        }
        set({
          pendingEmail: trimmed,
          step: "code-sent",
          error: null,
        });
      },

      verifyEmailCode: async (code: string) => {
        const trimmed = code.trim();
        // 6 digits matches both the phone OTP (Supabase default) and
        // the email OTP length we configured at Auth → Email. Keep the
        // two in sync — if email OTP length ever moves, update this
        // regex and the `codeLength` prop on the email CodeStep.
        if (!/^\d{6}$/.test(trimmed)) {
          set((s) => ({
            error: "Код складається з 6 цифр.",
            errorBump: s.errorBump + 1,
          }));
          return false;
        }
        const { pendingEmail } = get();
        if (!pendingEmail) {
          set((s) => ({
            error: "Сесія загубилась. Спробуй знову.",
            errorBump: s.errorBump + 1,
            step: "idle",
          }));
          return false;
        }

        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.verifyOtp({
          email: pendingEmail,
          token: trimmed,
          type: "email",
        });
        if (error || !data.user) {
          set((s) => ({
            error: error?.message || "Невірний код. Спробуй ще раз.",
            errorBump: s.errorBump + 1,
          }));
          return false;
        }

        const u = data.user;

        // Pull profile fields — populated by the on_auth_user_created
        // trigger at signup, then enriched by the onboarding step. If
        // any required field is still missing we route the user to
        // /login's onboarding step instead of straight to /account.
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone, email, newsletter, is_admin")
          .eq("id", u.id)
          .maybeSingle();

        const phone = profile?.phone ?? u.phone ?? "";
        const firstName = profile?.first_name ?? undefined;
        const lastName = profile?.last_name ?? undefined;
        const needsProfile = !firstName || !lastName || !phone;

        set((s) => ({
          user: {
            id: u.id,
            phone,
            email: u.email ?? pendingEmail,
            firstName: firstName ?? undefined,
            lastName: lastName ?? undefined,
            newsletter: profile?.newsletter ?? undefined,
            isAdmin: profile?.is_admin ?? false,
            createdAt: u.created_at ?? new Date().toISOString(),
          },
          pendingEmail: null,
          step: needsProfile ? "needs-profile" : "idle",
          error: null,
          errorBump: s.errorBump,
        }));
        return true;
      },

      // ---------------------------------------------------------------
      // Flow control
      // ---------------------------------------------------------------

      resetFlow: () => {
        set({
          step: "idle",
          pendingPhone: null,
          pendingEmail: null,
          error: null,
        });
      },

      logout: async () => {
        // Sign out from Supabase too — phone mock users have no Supabase
        // session, but signOut() is a safe no-op in that case.
        try {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
        } catch {
          // Network hiccup at sign-out shouldn't strand the user in a
          // logged-in UI. Wipe local state regardless.
        }
        set({
          user: null,
          pendingPhone: null,
          pendingEmail: null,
          step: "idle",
          error: null,
        });
      },

      updateProfile: (patch) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...patch } });
      },

      completeOnboarding: async (patch) => {
        const current = get().user;
        if (!current) {
          set((s) => ({
            error: "Сесія загубилась. Увійди знову.",
            errorBump: s.errorBump + 1,
          }));
          return false;
        }

        const firstName = patch.firstName.trim();
        const lastName = patch.lastName.trim();
        const phone = normalizePhone(patch.phone);

        if (!firstName || !lastName) {
          set((s) => ({
            error: "Заповни ім'я та прізвище.",
            errorBump: s.errorBump + 1,
          }));
          return false;
        }
        if (!/^\+\d{7,15}$/.test(phone)) {
          set((s) => ({
            error: "Введи номер у міжнародному форматі — починаючи з «+».",
            errorBump: s.errorBump + 1,
          }));
          return false;
        }

        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase
          .from("profiles")
          .update({
            first_name: firstName,
            last_name: lastName,
            phone,
          })
          .eq("id", current.id);

        if (error) {
          set((s) => ({
            error: error.message || "Не вдалось зберегти. Спробуй знову.",
            errorBump: s.errorBump + 1,
          }));
          return false;
        }

        set({
          user: { ...current, firstName, lastName, phone },
          step: "idle",
          error: null,
        });
        return true;
      },

      syncFromSupabase: async () => {
        if (typeof window === "undefined") return;
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;
        const u = session.user;

        // Pull profile alongside — auth.users gives us id/email/phone but
        // first/last name + newsletter + is_admin live in our profiles table.
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone, email, newsletter, is_admin")
          .eq("id", u.id)
          .maybeSingle();

        const phone = profile?.phone ?? u.phone ?? "";
        const firstName = profile?.first_name ?? undefined;
        const lastName = profile?.last_name ?? undefined;
        const needsProfile = !firstName || !lastName || !phone;

        // Supabase session wins — overwrite any stale local mirror. We
        // intentionally don't merge with the previous `user` because the
        // ids may differ (mock id vs Supabase UUID).
        //
        // If the profile is incomplete (existing email signups that never
        // finished onboarding — including anyone who signed up before the
        // onboarding flow shipped), flag the step so /login shows the
        // onboarding screen instead of bouncing them to /account.
        set((s) => ({
          user: {
            id: u.id,
            phone,
            email: u.email ?? profile?.email ?? undefined,
            firstName,
            lastName,
            newsletter: profile?.newsletter ?? undefined,
            isAdmin: profile?.is_admin ?? false,
            createdAt: u.created_at ?? new Date().toISOString(),
          },
          // Only override step if it's currently idle. Don't clobber an
          // in-flight "code-sent" (rare race, but defensive).
          step: needsProfile && s.step === "idle" ? "needs-profile" : s.step,
        }));
      },
    }),
    {
      name: "batch-auth",
      // Only persist the user + method preference. Flow state (step, error,
      // pending) should reset on reload — otherwise reopening the tab
      // leaves the login page stuck on a half-finished OTP screen.
      partialize: (s) => ({ user: s.user, method: s.method }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Mark hydrated immediately so the UI can render. The Supabase
        // reconcile happens in parallel and will update `user` if the
        // session disagrees with what we restored from localStorage.
        state.hydrated = true;
        state.syncFromSupabase().catch(() => {
          /* see logout() — network errors shouldn't block UI */
        });
      },
    },
  ),
);
