/**
 * sessionContext — Utilities for querying the active emotion session state.
 *
 * These helpers allow other parts of the app (e.g., the mood-logging flow)
 * to check whether an emotion session is in progress without importing
 * the full sessionStore or coupling to its internal shape.
 *
 * Validates: Requirements 10.7
 */

import { useSessionStore } from '@/stores/sessionStore';

/**
 * Returns true when an emotion-first session is currently active.
 *
 * Use this to suppress redundant prompts (like the pre-use mood slider)
 * during an active session — the user has already reported their emotional
 * state via the Emotion_Picker, so asking again adds friction.
 *
 * This is a plain function (not a hook) so it can be called from callbacks,
 * services, and non-React code. For reactive use in components, prefer
 * subscribing to `useSessionStore(s => s.isSessionActive)` directly.
 */
export function isInActiveEmotionSession(): boolean {
  return useSessionStore.getState().isSessionActive;
}
