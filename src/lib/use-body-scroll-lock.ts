import { useEffect } from "react";

/**
 * Ref-counted body-scroll lock shared by every overlay (cart drawer,
 * search overlay, …).
 *
 * The naive per-component pattern — `prev = body.overflow; set hidden;
 * cleanup: restore prev` — breaks when two overlays overlap: opening the
 * second saves `prev = "hidden"`, and closing EITHER one restores scroll
 * while the other is still open. Ref-counting fixes that: we capture the
 * page's original overflow once (on the 0→1 transition) and only restore
 * it once the last lock releases (N→0).
 */

let lockCount = 0;
let savedOverflow = "";

function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
  }
}

/** Lock body scroll while `active` is true; release on false/unmount. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);
}
