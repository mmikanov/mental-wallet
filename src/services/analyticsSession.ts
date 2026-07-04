/**
 * Session Module for Anonymous Analytics.
 *
 * Manages Session_ID lifecycle based on app state transitions and a
 * 30-minute inactivity timeout. Session IDs are memory-only and never
 * persisted to disk.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import * as Crypto from 'expo-crypto';

// --- Public Interface ---

export interface SessionState {
  sessionId: string;
  sessionStartTime: string; // ISO 8601
  backgroundEntryTime: string | null;
}

// --- Constants ---

/** 30 minutes in milliseconds — threshold for session expiry. */
const SESSION_TIMEOUT_MS = 1_800_000;

// --- Module-level state (memory-only, never persisted) ---

let currentSessionId: string | null = null;
let currentSessionStartTime: string | null = null;
let currentBackgroundEntryTime: string | null = null;

// --- UUID Generation ---

/**
 * Fallback UUID v4 generator using Math.random when expo-crypto fails.
 */
function fallbackUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates a UUID v4, falling back to Math.random if expo-crypto fails.
 */
function generateSessionId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return fallbackUUID();
  }
}

// --- Public API ---

/**
 * Creates a new session with a fresh UUID v4 session ID and current
 * UTC timestamp as session start time.
 */
export function startNewSession(): SessionState {
  currentSessionId = generateSessionId();
  currentSessionStartTime = new Date().toISOString();
  currentBackgroundEntryTime = null;

  return {
    sessionId: currentSessionId,
    sessionStartTime: currentSessionStartTime,
    backgroundEntryTime: currentBackgroundEntryTime,
  };
}

/**
 * Records the current timestamp as background entry time.
 * Called when the app transitions to the background.
 */
export function recordBackgroundEntry(): void {
  currentBackgroundEntryTime = new Date().toISOString();
}

/**
 * Evaluates foreground return — if elapsed time since background entry
 * is >= 30 minutes (1,800,000 ms), starts a new session. Otherwise,
 * returns the current session unchanged.
 */
export function handleForegroundReturn(): SessionState {
  if (currentBackgroundEntryTime) {
    const elapsed = Date.now() - new Date(currentBackgroundEntryTime).getTime();

    if (elapsed >= SESSION_TIMEOUT_MS) {
      return startNewSession();
    }
  }

  // Continue existing session (clear background entry time)
  currentBackgroundEntryTime = null;

  // If no session exists yet (edge case), start one
  if (!currentSessionId || !currentSessionStartTime) {
    return startNewSession();
  }

  return {
    sessionId: currentSessionId,
    sessionStartTime: currentSessionStartTime,
    backgroundEntryTime: currentBackgroundEntryTime,
  };
}

/**
 * Returns current session state (for use by other modules).
 */
export function getSessionState(): SessionState {
  // If no session exists, start one
  if (!currentSessionId || !currentSessionStartTime) {
    return startNewSession();
  }

  return {
    sessionId: currentSessionId,
    sessionStartTime: currentSessionStartTime,
    backgroundEntryTime: currentBackgroundEntryTime,
  };
}

/**
 * Clears session state (for data reset).
 * After calling this, a new session must be started before logging events.
 */
export function clearSession(): void {
  currentSessionId = null;
  currentSessionStartTime = null;
  currentBackgroundEntryTime = null;
}
