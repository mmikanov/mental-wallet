/**
 * Event Logger for Anonymous Analytics.
 *
 * Validates, enriches, and enqueues analytics events into the local SQLite queue.
 * Respects opt-out preferences, computes derived fields (duration_ms, session_duration_ms),
 * and exposes an event emitter for the dev event viewer.
 *
 * Requirements: 3.1, 3.2, 3.12, 3.13, 3.14, 3.15, 3.16, 4.1, 5.3, 5.4
 */

import type { AnalyticsEvent, AnalyticsEventType } from '@/types/analytics';
import { getSessionState } from '@/services/analyticsSession';
import { insertEvent, evictOldestIfFull } from '@/data/analyticsEventQueue';

// --- Constants ---

const VALID_EVENT_TYPES: readonly AnalyticsEventType[] = [
  'app_opened',
  'onboarding_step_viewed',
  'onboarding_intent_selected',
  'onboarding_kpi_selected',
  'onboarding_completed',
  'start_mode_selected',
  'session_started',
  'tool_added',
  'tool_archived',
  'tool_unarchived',
  'tool_created',
  'tool_copied',
  'tool_opened',
  'tool_completed',
  'tool_history_viewed',
  'reminder_set',
  'reminder_deleted',
  'outcome_response',
  'external_resource_opened',
  'session_ended',
  'guided_checkin_started',
  'guided_checkin_completed',
] as const;

/** Events allowed when opted out (no contextual properties). */
const OPT_OUT_ALLOWED_EVENTS: readonly AnalyticsEventType[] = [
  'app_opened',
  'session_ended',
] as const;

/** Maximum queue size before eviction. */
const MAX_QUEUE_SIZE = 1000;

/** UUID v4 regex pattern. */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** ISO 8601 timestamp regex (with milliseconds and Z or offset). */
const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// --- Module-level state ---

/** Anonymous user ID set by the analytics store. */
let anonymousUserId: string | null = null;

/** Opt-in status set by the analytics store. */
let optIn = true;

/** Maps card_id to timestamp (ms) for duration_ms computation on tool_completed. */
const toolOpenedTimestamps: Map<string, number> = new Map();

/** Maps session_id to session start timestamp (ms) for session_duration_ms computation. */
const sessionStartTimestamps: Map<string, number> = new Map();

/** Event logged listeners for the dev event viewer. */
type EventLoggedCallback = (event: AnalyticsEvent) => void;
const listeners: Set<EventLoggedCallback> = new Set();

// --- Validation Helpers ---

function isValidUuid(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}

function isValidTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_REGEX.test(value);
}

function isValidEventType(value: string): value is AnalyticsEventType {
  return (VALID_EVENT_TYPES as readonly string[]).includes(value);
}

// --- Public API ---

/**
 * Sets the anonymous user ID used for event logging.
 * Called by the analytics store after identity resolution.
 */
export function setLoggerIdentity(userId: string): void {
  anonymousUserId = userId;
}

/**
 * Sets the opt-in status for the logger.
 * Called by the analytics store when preference changes.
 */
export function setLoggerOptIn(value: boolean): void {
  optIn = value;
}

/**
 * Clears all logger state (tool timestamps, identity).
 * Called during data reset.
 */
export function clearLoggerState(): void {
  toolOpenedTimestamps.clear();
  sessionStartTimestamps.clear();
  anonymousUserId = null;
}

/**
 * Registers a listener for logged events (used by dev event viewer).
 * Returns an unsubscribe function.
 */
export function onEventLogged(callback: EventLoggedCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Validates and enqueues an analytics event.
 * Silently discards if base fields are missing/invalid or opt-out applies.
 *
 * Responsibilities:
 * - Assembles base fields from module state and session
 * - Validates UUID format, timestamp, and event type
 * - Enforces opt-out: only app_opened and session_ended (no properties) when opted out
 * - Computes duration_ms for tool_completed
 * - Computes session_duration_ms for session_ended
 * - Evicts oldest event if queue is full, then inserts
 */
export async function logEvent(
  eventType: AnalyticsEventType,
  properties?: Record<string, string | number>
): Promise<void> {
  try {
    // Validate event type
    if (!isValidEventType(eventType)) {
      return;
    }

    // Must have identity
    if (!anonymousUserId || !isValidUuid(anonymousUserId)) {
      return;
    }

    // Get session state
    const session = getSessionState();
    if (!session.sessionId || !isValidUuid(session.sessionId)) {
      return;
    }

    // Generate timestamp
    const timestamp = new Date().toISOString();
    if (!isValidTimestamp(timestamp)) {
      return;
    }

    // Opt-out enforcement
    if (!optIn) {
      if (!(OPT_OUT_ALLOWED_EVENTS as readonly string[]).includes(eventType)) {
        // Behavioral event while opted out — discard
        return;
      }
      // Allowed event but strip all contextual properties
      properties = undefined;
    }

    // Track tool_opened timestamps for duration_ms computation
    if (eventType === 'tool_opened' && properties?.card_id) {
      toolOpenedTimestamps.set(String(properties.card_id), Date.now());
    }

    // Track session start for session_duration_ms computation
    if (eventType === 'app_opened') {
      sessionStartTimestamps.set(session.sessionId, Date.now());
    }

    // Compute duration_ms for tool_completed
    if (eventType === 'tool_completed' && properties) {
      const cardId = String(properties.card_id ?? '');
      const openedAt = toolOpenedTimestamps.get(cardId);
      if (openedAt) {
        properties = { ...properties, duration_ms: Date.now() - openedAt };
        toolOpenedTimestamps.delete(cardId);
      } else {
        properties = { ...properties, duration_ms: 0 };
      }
    }

    // Compute session_duration_ms for session_ended
    if (eventType === 'session_ended') {
      const sessionStart = sessionStartTimestamps.get(session.sessionId);
      if (sessionStart) {
        const sessionDuration = Date.now() - sessionStart;
        properties = { ...properties, session_duration_ms: sessionDuration };
      } else {
        properties = { ...properties, session_duration_ms: 0 };
      }
    }

    // Assemble the event
    const event = {
      anonymous_user_id: anonymousUserId,
      session_id: session.sessionId,
      event_type: eventType,
      timestamp,
      ...(properties !== undefined ? { properties } : {}),
    } as AnalyticsEvent;

    // Evict oldest if queue is full, then insert
    await evictOldestIfFull(MAX_QUEUE_SIZE);
    await insertEvent(event);

    // Notify listeners (dev event viewer)
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors should never disrupt event logging
      }
    }
  } catch {
    // Silently discard — analytics must never crash the app
  }
}

export type { EventLoggedCallback };
