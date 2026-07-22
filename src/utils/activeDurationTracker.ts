/**
 * ActiveDurationTracker — Coordinates React Native's AppState API with the
 * DurationTrackingStore to pause/resume timing on background/foreground transitions.
 *
 * Key behaviors:
 * - Registers an AppState 'change' listener on initialize()
 * - On 'background' or 'inactive': calls store.handleAppBackground() and starts a
 *   15-minute setTimeout to auto-end via timeout if the app stays backgrounded.
 * - On 'active': clears the background timeout, calls store.handleAppForeground()
 * - teardown() removes the listener and clears any pending timeout
 *
 * Validates: Requirements 1.3, 1.4
 */

import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { useDurationTrackingStore } from '@/stores/durationTrackingStore';

const BACKGROUND_TIMEOUT_MS = 900_000; // 15 minutes

export interface ActiveDurationTracker {
  /** Register AppState listener. Call on app mount. */
  initialize(): void;
  /** Remove AppState listener and clear pending timeouts. Call on app unmount. */
  teardown(): void;
}

export function createActiveDurationTracker(
  getStore: () => typeof useDurationTrackingStore extends { getState: () => infer S } ? S : never = () => useDurationTrackingStore.getState()
): ActiveDurationTracker {
  let subscription: NativeEventSubscription | null = null;
  let backgroundTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function handleAppStateChange(nextState: AppStateStatus): void {
    const store = getStore();

    if (nextState === 'background' || nextState === 'inactive') {
      store.handleAppBackground();

      // Start the 15-minute timeout for auto-ending the session.
      // If the app stays backgrounded longer than this, we trigger
      // handleAppForeground which will detect the elapsed time and
      // auto-end with 'timed_out' status.
      if (backgroundTimeoutId !== null) {
        clearTimeout(backgroundTimeoutId);
      }
      backgroundTimeoutId = setTimeout(() => {
        backgroundTimeoutId = null;
        // Trigger the foreground handler — it will detect the >15 min
        // elapsed time and auto-end the session.
        const currentStore = getStore();
        currentStore.handleAppForeground();
      }, BACKGROUND_TIMEOUT_MS);
    } else if (nextState === 'active') {
      // Clear the background timeout since we're back in foreground
      if (backgroundTimeoutId !== null) {
        clearTimeout(backgroundTimeoutId);
        backgroundTimeoutId = null;
      }
      store.handleAppForeground();
    }
  }

  return {
    initialize(): void {
      if (subscription !== null) {
        // Already initialized — avoid duplicate listeners
        return;
      }
      subscription = AppState.addEventListener('change', handleAppStateChange);
    },

    teardown(): void {
      if (subscription !== null) {
        subscription.remove();
        subscription = null;
      }
      if (backgroundTimeoutId !== null) {
        clearTimeout(backgroundTimeoutId);
        backgroundTimeoutId = null;
      }
    },
  };
}
