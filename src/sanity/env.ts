/**
 * Sanity env vars — validated and re-exported as typed constants.
 *
 * Read-side vars (`NEXT_PUBLIC_*`) are inlined into the client bundle; the
 * write-side token (`SANITY_API_TOKEN`) is kept server-only. Centralising
 * the reads here means every other module imports already-validated
 * values, so a missing var fails loud at startup rather than as a
 * mysterious 401 at request time.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. ` +
        `Did you copy .env.local from .env.local.example?`,
    );
  }
  return value;
}

export const projectId = required(
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
);

export const dataset = required(
  "NEXT_PUBLIC_SANITY_DATASET",
  process.env.NEXT_PUBLIC_SANITY_DATASET,
);

/** API version — pinned date that determines which Sanity API behaviour we
 *  get. Bump consciously; otherwise locks us into a known-good surface. */
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2024-11-01";

/** Server-only write token. Available in server runtime; undefined on the
 *  client. Use only from server actions / route handlers / scripts. */
export const writeToken = process.env.SANITY_API_TOKEN;
