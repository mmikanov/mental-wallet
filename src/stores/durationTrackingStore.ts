/**
 * DurationTrackingStore — Zustand store managing the in-memory state
 * of an active duration tracking session.
 *
 * Key behaviors:
 * - Tracks foreground active time per card session
 * - Pauses on background, resumes on foreground (within 15-min threshold)
 * - Auto-ends session via 'timed_out' if backgrounded > 15 minutes
 * - Persists Duration_Record via DurationService on stop
 * - Discards session on crash/kill (no partial data persisted — Req 1.5)
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { create } from 'zustand';
import {
  createDurationService,
  type DurationEndStatus,
  type DurationService,
} from '@/services/durationService';

const BACKGROUND_TIMEOUT_SEC = 900; // 15 minutes

export interface DurationTrackingState {
  /** Whether a card session is currently being timed. */
  isTracking: boolean;
  /** The card currently being tracked. */
  activeCardId: string | null;
  /** UTC ISO 8601 timestamp when tracking started. */
  startTimestamp: string | null;
  /** Accumulated foreground seconds (updates on pause). */
  accumulatedSec: number;
  /** Timestamp when app was last backgrounded (null if in foreground). */
  backgroundedAt: string | null;

  // Actions
  startTracking: (cardId: string) => void;
  stopTracking: (endStatus: DurationEndStatus) => Promise<void>;
  handleAppBackground: () => void;
  handleAppForeground: () => void;
}

let durationService: DurationService | null = null;

function getDurationService(): DurationService {
  if (!durationService) {
    durationService = createDurationService();
  }
  return durationService;
}

/**
 * Allows injection of a mock DurationService for testing.
 */
export function setDurationService(service: DurationService): void {
  durationService = service;
}

/**
 * Module-level variable tracking the monotonic time (ms) when the current
 * foreground segment started. Used to compute elapsed foreground time
 * without relying on wall-clock differences across background/foreground cycles.
 *
 * Set when:
 *   - startTracking is called (segment begins)
 *   - handleAppForeground resumes (new segment begins)
 * Cleared when:
 *   - handleAppBackground pauses (segment ends, duration added to accumulatedSec)
 *   - stopTracking resets everything
 *   - handleAppForeground auto-ends due to timeout
 */
let currentSegmentStartMs: number | null = null;

/**
 * Compute the duration (whole seconds) of the current in-progress foreground segment.
 */
function getCurrentSegmentSec(): number {
  if (currentSegmentStartMs === null) return 0;
  const elapsed = (Date.now() - currentSegmentStartMs) / 1000;
  return Math.max(0, Math.floor(elapsed));
}

export const useDurationTrackingStore = create<DurationTrackingState>(
  (set, get) => ({
    isTracking: false,
    activeCardId: null,
    startTimestamp: null,
    accumulatedSec: 0,
    backgroundedAt: null,

    startTracking(cardId: string) {
      // If already tracking a different card, the previous session is implicitly
      // abandoned — no record persisted (same as crash per Req 1.5).
      currentSegmentStartMs = Date.now();
      set({
        isTracking: true,
        activeCardId: cardId,
        startTimestamp: new Date().toISOString(),
        accumulatedSec: 0,
        backgroundedAt: null,
      });
    },

    async stopTracking(endStatus: DurationEndStatus) {
      const { isTracking, activeCardId, startTimestamp, accumulatedSec, backgroundedAt } =
        get();

      if (!isTracking || !activeCardId || !startTimestamp) {
        return;
      }

      // Total active seconds = accumulated (completed segments) + current foreground segment
      let totalActiveSec: number;
      if (backgroundedAt) {
        // Currently backgrounded — no additional foreground time to add
        totalActiveSec = accumulatedSec;
      } else {
        totalActiveSec = accumulatedSec + getCurrentSegmentSec();
      }

      const endedAt = new Date().toISOString();

      // Reset state immediately
      currentSegmentStartMs = null;
      set({
        isTracking: false,
        activeCardId: null,
        startTimestamp: null,
        accumulatedSec: 0,
        backgroundedAt: null,
      });

      // Persist via DurationService
      const service = getDurationService();
      await service.persist({
        cardId: activeCardId,
        startedAt: startTimestamp,
        endedAt,
        activeDurationSec: totalActiveSec,
        endStatus,
      });
    },

    handleAppBackground() {
      const { isTracking, backgroundedAt } = get();

      if (!isTracking || backgroundedAt) {
        // Not tracking, or already backgrounded — nothing to do
        return;
      }

      // Add the current foreground segment duration to accumulatedSec
      const segmentSec = getCurrentSegmentSec();
      const now = new Date().toISOString();

      currentSegmentStartMs = null;
      set((state) => ({
        accumulatedSec: state.accumulatedSec + segmentSec,
        backgroundedAt: now,
      }));
    },

    handleAppForeground() {
      const { isTracking, backgroundedAt, activeCardId, startTimestamp, accumulatedSec } =
        get();

      if (!isTracking || !backgroundedAt) {
        // Not tracking, or not backgrounded — nothing to do
        return;
      }

      // Check how long we were in the background
      const backgroundElapsedSec =
        (Date.now() - new Date(backgroundedAt).getTime()) / 1000;

      if (backgroundElapsedSec > BACKGROUND_TIMEOUT_SEC) {
        // Auto-end session: timed out.
        // endedAt = moment we went to background (Req 1.4)
        // activeDurationSec = accumulated foreground time up to that point
        currentSegmentStartMs = null;
        set({
          isTracking: false,
          activeCardId: null,
          startTimestamp: null,
          accumulatedSec: 0,
          backgroundedAt: null,
        });

        if (activeCardId && startTimestamp) {
          const service = getDurationService();
          service.persist({
            cardId: activeCardId,
            startedAt: startTimestamp,
            endedAt: backgroundedAt,
            activeDurationSec: accumulatedSec,
            endStatus: 'timed_out',
          });
        }
      } else {
        // Resume — background time not counted.
        // Start a new foreground segment.
        currentSegmentStartMs = Date.now();
        set({ backgroundedAt: null });
      }
    },
  })
);

/**
 * Reset the module-level tracking state. Useful for testing.
 */
export function resetDurationTrackingInternals(): void {
  currentSegmentStartMs = null;
}
