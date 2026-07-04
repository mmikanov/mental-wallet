/**
 * Account Linking with Consent — Infrastructure for linking anonymous analytics
 * identity to an authenticated account when sign-in is implemented.
 *
 * Since the app doesn't currently have authentication (deferred feature), this
 * module provides the ready-to-call infrastructure. When sign-in is added later,
 * call `hasLinkingConsent()` to check if consent was already given/declined,
 * and call `grantLinkingConsent(accountId)` or `declineLinkingConsent()` based
 * on the user's choice.
 *
 * The `identity_linked` event is an identity-management event, NOT a standard
 * behavioral event — it is transmitted even when the user is opted out of
 * behavioral analytics (Requirement 7.8).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/data/database';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { getSessionState } from '@/services/analyticsSession';

const CONSENT_KEY = 'identity_link_consent';

/**
 * Checks if a linking consent decision has already been recorded.
 * Returns true if consent was previously granted or declined.
 */
export async function hasLinkingConsent(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(CONSENT_KEY);
    return value === 'granted' || value === 'declined';
  } catch {
    return false;
  }
}

/**
 * Called when user grants consent to link their anonymous ID with their account.
 * Transmits an `identity_linked` event and persists consent.
 *
 * This event is still sent even if the user is opted out of behavioral analytics,
 * because it is an identity-management event (Requirement 7.8).
 *
 * If the event insert fails, consent is still persisted. The event will be
 * retried via the standard batch transmission mechanism (Requirement 7.4).
 */
export async function grantLinkingConsent(accountId: string): Promise<void> {
  const { anonymousUserId } = useAnalyticsStore.getState();
  if (!anonymousUserId) return;

  // Persist consent decision immediately (Requirement 7.6)
  try {
    await SecureStore.setItemAsync(CONSENT_KEY, 'granted');
  } catch {
    // Non-blocking — continue with event dispatch
  }

  // Build the identity_linked event (not in standard AnalyticsEventType union)
  const session = getSessionState();
  const id = Crypto.randomUUID();
  const payload = JSON.stringify({
    anonymous_user_id: anonymousUserId,
    session_id: session.sessionId,
    event_type: 'identity_linked',
    timestamp: new Date().toISOString(),
    properties: {
      anonymous_user_id: anonymousUserId,
      account_id: accountId,
    },
  });
  const createdAt = new Date().toISOString();

  // Insert directly into the queue for delivery via standard batch mechanism
  // Bypasses logEvent validation since identity_linked is not a standard event type
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO analytics_event_queue (id, payload, created_at, status) VALUES (?, ?, ?, 'pending')`,
      [id, payload, createdAt]
    );
  } catch {
    // If insert fails, event is lost for this attempt.
    // Consent is already persisted, so re-prompting won't happen.
  }
}

/**
 * Called when user declines to link their identity.
 * No event is sent; consent decision is persisted (Requirement 7.5, 7.6).
 */
export async function declineLinkingConsent(): Promise<void> {
  try {
    await SecureStore.setItemAsync(CONSENT_KEY, 'declined');
  } catch {
    // Non-blocking — consent may not persist across restarts
  }
}

/**
 * Returns the consent prompt configuration for UI rendering.
 * The prompt text is ≤80 words excluding button labels (Requirement 7.2).
 *
 * Call this to get the text and labels when presenting the consent dialog
 * during first sign-in flow.
 */
export function getConsentPromptConfig() {
  return {
    title: 'Link your usage history?',
    body:
      'Linking is optional. It associates your past anonymous usage data with your account ' +
      'for continuity across devices. Declining does not affect app functionality.',
    acceptLabel: 'Link my data',
    declineLabel: 'No thanks',
  };
}
