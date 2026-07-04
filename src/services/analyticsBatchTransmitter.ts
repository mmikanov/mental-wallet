import type { TransmitterConfig } from '@/types/analytics';
import {
  getPendingEvents,
  markAsSending,
  markAsPending,
  deleteEvents,
  getQueueSize,
} from '@/data/analyticsEventQueue';

// --- Module State ---

let flushInterval: ReturnType<typeof setInterval> | null = null;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let connectivityTimeout: ReturnType<typeof setTimeout> | null = null;
let currentRetryMs: number = 0;
let isFlushing: boolean = false;
let activeConfig: TransmitterConfig | null = null;

// TODO: Add connectivity listener when expo-network or @react-native-community/netinfo
// is added to the project. For now, we rely on the periodic timer for retransmission.
// When available, listen for connectivity restore and call flushNow() within 10s of reconnect.

/**
 * Starts the periodic flush timer.
 * The store should call `resetSendingToPending()` before calling this.
 */
export function startTransmitter(config: TransmitterConfig): void {
  // Avoid double-starting
  if (flushInterval !== null) {
    stopTransmitter();
  }

  activeConfig = config;
  currentRetryMs = config.retryBaseMs;

  // Periodic flush every flushIntervalMs
  flushInterval = setInterval(() => {
    void flushNow();
  }, config.flushIntervalMs);
}

/**
 * Stops the transmitter — clears timers and resets module state.
 */
export function stopTransmitter(): void {
  if (flushInterval !== null) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  if (retryTimeout !== null) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  if (connectivityTimeout !== null) {
    clearTimeout(connectivityTimeout);
    connectivityTimeout = null;
  }
  activeConfig = null;
  isFlushing = false;
}

/**
 * Forces an immediate flush attempt. Called by the periodic timer,
 * threshold check, or connectivity restore handler.
 *
 * Will not attempt to send if the baseUrl is empty/placeholder
 * (production URL not yet configured).
 */
export async function flushNow(): Promise<void> {
  if (isFlushing || activeConfig === null) {
    return;
  }

  // Do not attempt transmission when base URL is empty (production placeholder)
  if (!activeConfig.baseUrl) {
    return;
  }

  isFlushing = true;

  try {
    const batchSize = activeConfig.batchSize;
    const events = await getPendingEvents(batchSize);

    if (events.length === 0) {
      return;
    }

    const ids = events.map((e) => e.id);

    // Mark events as 'sending' to prevent duplicate transmission
    await markAsSending(ids);

    // Parse payloads for the batch body
    const parsedPayloads = events.map((e) => JSON.parse(e.payload));

    try {
      const response = await fetch(`${activeConfig.baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: parsedPayloads }),
      });

      if (response.ok) {
        // Success: delete transmitted events from queue
        await deleteEvents(ids);
        // Reset backoff on success
        currentRetryMs = activeConfig.retryBaseMs;
      } else {
        // Non-2xx: mark back to pending and schedule retry
        await markAsPending(ids);
        scheduleRetry();
      }
    } catch {
      // Network error: mark back to pending and schedule retry
      await markAsPending(ids);
      scheduleRetry();
    }
  } finally {
    isFlushing = false;
  }
}

/**
 * Checks whether the queue has reached the flush threshold
 * and triggers an immediate flush if so.
 * Call this after inserting an event.
 */
export async function checkThresholdFlush(): Promise<void> {
  if (activeConfig === null) {
    return;
  }

  const size = await getQueueSize();
  if (size >= activeConfig.flushThreshold) {
    void flushNow();
  }
}

// --- Internal Helpers ---

/**
 * Schedules a retry flush with exponential backoff.
 */
function scheduleRetry(): void {
  if (activeConfig === null) {
    return;
  }

  // Clear any existing retry timer
  if (retryTimeout !== null) {
    clearTimeout(retryTimeout);
  }

  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    void flushNow();
  }, currentRetryMs);

  // Exponential backoff: double the interval, capped at retryCapMs
  currentRetryMs = Math.min(currentRetryMs * 2, activeConfig.retryCapMs);
}
