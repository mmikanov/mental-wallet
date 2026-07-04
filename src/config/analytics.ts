/**
 * Analytics configuration — centralized config for the analytics system.
 *
 * Development builds point to the local mock analytics server (task 10.1).
 * Production URL is left as an empty string placeholder until the real
 * backend decision is made. The batch transmitter will not attempt to send
 * when the URL is empty.
 *
 * Validates: Requirements 13.8
 */

import type { TransmitterConfig } from '@/types/analytics';

/**
 * Analytics base URL.
 * - Dev: local mock server at http://localhost:3001
 * - Production: empty string (deferred backend decision)
 */
export const ANALYTICS_BASE_URL: string = __DEV__
  ? 'http://localhost:3001'
  : '';

/**
 * Configurable flush interval in milliseconds.
 * Dev builds default to 5 minutes for easier testing observation.
 * Production uses 60 seconds.
 * Can be changed at runtime in dev via setFlushIntervalMs().
 */
let flushIntervalMs: number = __DEV__ ? 300_000 : 60_000;

/**
 * Get the current flush interval.
 */
export function getFlushIntervalMs(): number {
  return flushIntervalMs;
}

/**
 * Set the flush interval (dev only). Restarts the transmitter
 * if a restart callback has been registered.
 */
export function setFlushIntervalMs(ms: number): void {
  flushIntervalMs = ms;
  if (onFlushIntervalChanged) {
    onFlushIntervalChanged();
  }
}

/** Callback invoked when the flush interval changes (to restart the transmitter). */
let onFlushIntervalChanged: (() => void) | null = null;

/**
 * Register a callback to be called when flush interval changes.
 * Used by the analytics store to restart the transmitter with the new interval.
 */
export function registerFlushIntervalChangeHandler(handler: () => void): void {
  onFlushIntervalChanged = handler;
}

/**
 * Returns the full TransmitterConfig with the appropriate base URL
 * for the current environment.
 */
export function getTransmitterConfig(): TransmitterConfig {
  return {
    baseUrl: ANALYTICS_BASE_URL,
    batchSize: 50,
    flushThreshold: __DEV__ ? 999 : 10, // In dev, don't auto-flush on threshold (only on timer)
    flushIntervalMs,
    retryBaseMs: 120_000,
    retryCapMs: 900_000, // 15 minutes
  };
}
