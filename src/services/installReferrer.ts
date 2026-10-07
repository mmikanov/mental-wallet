/**
 * Install Referrer boundary for passive channel attribution (Android only).
 *
 * This module isolates the native Play Install Referrer read behind a single
 * seam (`readInstallReferrer`) and provides a pure, unit-testable parser
 * (`parseChannelFromReferrer`) for extracting the channel (`utm_source`) from
 * the referrer string.
 *
 * iOS and all other platforms are a no-op (Requirement 5): there is no
 * device-side install referrer, so `readInstallReferrer` returns null there.
 *
 * Requirements: 4.1, 5.1
 */

import { Platform } from 'react-native';

/**
 * Reads the Play Install Referrer string on Android, or null elsewhere / on failure.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * NATIVE WIRING REQUIRED (operator follow-up — Task 14, NOT done here):
 *
 * This is a STUB. In this environment no native Play Install Referrer module is
 * installed or verifiable, and this is a bare workflow (committed `android/`),
 * so a config plugin alone does nothing without a native rebuild. The parse /
 * store / stamp layers (Tasks 11, 13 and the parse half of 12) are fully
 * unit-tested; the native install-time read below is the ONLY piece that needs
 * the native build + on-device verification.
 *
 * To wire the real read, the operator must:
 *   1. Add an exact-pinned dependency wrapping `com.android.installreferrer`,
 *      e.g.  react-native-play-install-referrer@1.1.8
 *      (confirm Expo SDK 54 / RN 0.81 / New Architecture compatibility at
 *      install time, then pin the exact resolved version in package.json).
 *   2. Because this is a bare workflow, ensure the module autolinks into the
 *      committed `android/` project and run a native rebuild. If the package
 *      ships an Expo config plugin, add it to `plugins` in `app.json` AND run
 *      prebuild / native rebuild (a plugin alone is inert without the build).
 *   3. Replace ONLY the stub body below with the real call, keeping the
 *      `Platform.OS !== 'android'` guard and the try/catch returning null, e.g.:
 *
 *        import { PlayInstallReferrer } from 'react-native-play-install-referrer';
 *        return await new Promise<string | null>((resolve) => {
 *          PlayInstallReferrer.getInstallReferrerInfo((info, error) => {
 *            if (error || !info) return resolve(null);
 *            resolve(info.installReferrer ?? null);
 *          });
 *        });
 *
 *   4. Then follow the release checklist (version bump, eas build, submit) —
 *      Task 14, outside this phase.
 * ───────────────────────────────────────────────────────────────────────────
 */
export async function readInstallReferrer(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    // STUB: no native module wired in this environment. Returns null until the
    // operator swaps in the real read (see block comment above). The parse/store
    // layers are exercised in tests via a mock of this function.
    return null;
  } catch {
    // The native read must never throw out — analytics must never crash the app.
    return null;
  }
}

/**
 * Extracts the channel label from a Play Install Referrer string.
 *
 * The referrer arrives as URL-encoded query params, e.g.
 * `utm_source=reddit&utm_campaign=launch`. Returns the decoded `utm_source`
 * value, or null when the input is empty/null or has no `utm_source`.
 */
export function parseChannelFromReferrer(referrer: string | null): string | null {
  if (!referrer) {
    return null;
  }

  for (const pair of referrer.split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = pair.slice(0, eq);
    if (key !== 'utm_source') {
      continue;
    }
    const rawValue = pair.slice(eq + 1);
    if (!rawValue) {
      return null;
    }
    let decoded: string;
    try {
      // Referrer params may be percent-encoded; also normalise '+' to space.
      decoded = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      // Malformed encoding — fall back to the raw value rather than throwing.
      decoded = rawValue;
    }
    const trimmed = decoded.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}
