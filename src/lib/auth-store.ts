import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Mock auth store — phone + OTP login flow.
 *
 * Today this is purely client-side: localStorage persists "logged in" state
 * across reloads, no real SMS is sent, any 4-digit code is accepted. The
 * shape of the store deliberately mirrors what we'll wire to Supabase Auth
 * later — so swapping the implementation will touch `requestCode` and
 * `verifyCode` bodies only, not their signatures or the components that
 * call them.
 *
 * Real-world plan:
 *   - `requestCode(phone)` → Supabase `signInWithOtp({ phone })`, which
 *     hits the Twilio / SMSc.ua / TurboSMS gateway configured on the
 *     project. Returns immediately; SMS delivery is async.
 *   - `verifyCode(code)`  → `verifyOtp({ phone, token: code, type: "sms" })`,
 *     returns a session. We persist the session via Supabase client.
 */

export interface AuthUser {
  /** Stable id — for mocks we derive from phone. Real backend assigns UUID. */
  id: string;
  /** International E.164 phone, e.g. "+380501234567". Stored without spaces. */
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** ISO date the account was first created. */
  createdAt: string;
  /** Subscribed to the marketing newsletter — toggled from /account/profile. */
  newsletter?: boolean;
}

export type AuthStep = "idle" | "code-sent";

interface AuthState {
  user: AuthUser | null;
  /** Phone the user is currently verifying — set after requestCode, cleared
   *  on logout or after successful verify (then we keep user.phone instead). */
  pendingPhone: string | null;
  /** Auth flow step — drives the login page's two-step UI. */
  step: AuthStep;
  /** Surface for inline errors on the login page. */
  error: string | null;
  /** Last error timestamp — same wording in a row should still re-trigger UI
   *  animations, so we increment a counter rather than relying on string ref. */
  errorBump: number;

  /** Hydration flag — true once persist has read localStorage. Components that
   *  guard routes should wait for this to avoid flashing the wrong UI. */
  hydrated: boolean;

  /** "Send" the OTP. In mock-mode this just remembers the phone and flips
   *  step → "code-sent" so the UI advances. */
  requestCode: (phone: string) => Promise<void>;
  /** Verify the OTP. Mock accepts any 4-digit code. On success, synthesises
   *  a user and stores it. Returns true/false so the caller can react. */
  verifyCode: (code: string) => Promise<boolean>;
  /** Cancel the in-progress verification — sends user back to phone-step. */
  resetFlow: () => void;
  /** Wipe session entirely. */
  logout: () => void;
  /** Patch user profile fields. No-op if not logged in. */
  updateProfile: (patch: Partial<Omit<AuthUser, "id" | "createdAt">>) => void;
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

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      pendingPhone: null,
      step: "idle",
      error: null,
      errorBump: 0,
      hydrated: false,

      requestCode: async (phone: string) => {
        const normalized = normalizePhone(phone);
        // Minimal validation — must look like a phone with country code.
        // E.164 allows up to 15 digits after "+". 7 is a sane minimum.
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

      resetFlow: () => {
        set({ step: "idle", pendingPhone: null, error: null });
      },

      logout: () => {
        set({
          user: null,
          pendingPhone: null,
          step: "idle",
          error: null,
        });
      },

      updateProfile: (patch) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...patch } });
      },
    }),
    {
      name: "batch-auth",
      // Only persist the user — flow state (step, error, pending) should
      // reset on reload, otherwise reopening the tab leaves the login page
      // stuck on a half-finished OTP screen.
      partialize: (s) => ({ user: s.user }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
