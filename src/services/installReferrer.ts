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
import { PlayInstallReferrer } from 'react-native-play-install-referrer';

/**
 * Reads the Play Install Referrer string on Android, or null elsewhere / on failure.
 *
 * The native read is provided by `react-native-play-install-referrer` (a wrapper
 * around Google's `com.android.installreferrer`). It is Android-only; iOS and all
 * other platforms are a no-op (Requirement 5) because there is no device-side
 * install referrer there.
 *
 * NOTE (verification): the parse/store/stamp layers around this are unit-tested
 * (via a mock of this function), but the native install-time read itself is an
 * Android install-time signal that can only be confirmed on a real Play install —
 * see Task 15 (on-device check). It requires a native build; it will not work in
 * Expo Go or a plain emulator without Google Play services.
 */
export async function readInstallReferrer(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    return await new Promise<string | null>((resolve) => {
      try {
        PlayInstallReferrer.getInstallReferrerInfo((info, error) => {
          if (error || !info) {
            resolve(null);
            return;
          }
          resolve(info.installReferrer ?? null);
        });
      } catch {
        // Synchronous throw from the native bridge (e.g. module not linked) —
        // resolve null so analytics never crashes the app.
        resolve(null);
      }
    });
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
