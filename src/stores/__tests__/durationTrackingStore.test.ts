/**
 * Unit tests for DurationTrackingStore.
 * Tests duration tracking lifecycle: start, stop, background/foreground handling,
 * and the 15-minute background timeout.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

jest.mock('@/services/durationService', () => ({
  createDurationService: jest.fn(),
}));

import { act } from '@testing-library/react-native';
import {
  useDurationTrackingStore,
  setDurationService,
  resetDurationTrackingInternals,
} from '../durationTrackingStore';
import type { DurationService } from '@/services/durationService';

// --- Helpers ---

function createMockDurationService(
  overrides: Partial<DurationService> = {}
): DurationService {
  return {
    persist: jest.fn().mockResolvedValue(null),
    query: jest.fn().mockResolvedValue([]),
    getStats: jest.fn().mockResolvedValue(null),
    getCardAverageDuration: jest.fn().mockResolvedValue(null),
    deleteAll: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function resetStore() {
  useDurationTrackingStore.setState({
    isTracking: false,
    activeCardId: null,
    startTimestamp: null,
    accumulatedSec: 0,
    backgroundedAt: null,
  });
  resetDurationTrackingInternals();
}

describe('DurationTrackingStore', () => {
  let mockService: DurationService;

  beforeEach(() => {
    mockService = createMockDurationService();
    setDurationService(mockService);
    resetStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startTracking', () => {
    it('should set isTracking=true and record the cardId', () => {
      useDurationTrackingStore.getState().startTracking('card-1');

      const state = useDurationTrackingStore.getState();
      expect(state.isTracking).toBe(true);
      expect(state.activeCardId).toBe('card-1');
      expect(state.accumulatedSec).toBe(0);
      expect(state.backgroundedAt).toBeNull();
      expect(state.startTimestamp).not.toBeNull();
    });

    it('should record a valid ISO 8601 timestamp', () => {
      useDurationTrackingStore.getState().startTracking('card-1');

      const state = useDurationTrackingStore.getState();
      expect(() => new Date(state.startTimestamp!)).not.toThrow();
      expect(new Date(state.startTimestamp!).toISOString()).toBe(state.startTimestamp);
    });

    it('should overwrite a previous tracking session without persisting (Req 1.5)', () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      useDurationTrackingStore.getState().startTracking('card-2');

      const state = useDurationTrackingStore.getState();
      expect(state.activeCardId).toBe('card-2');
      expect(state.accumulatedSec).toBe(0);
      expect(mockService.persist).not.toHaveBeenCalled();
    });
  });

  describe('stopTracking', () => {
    it('should persist a duration record with computed active seconds', async () => {
      useDurationTrackingStore.getState().startTracking('card-1');

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30_000);

      await useDurationTrackingStore.getState().stopTracking('completed');

      expect(mockService.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          activeDurationSec: 30,
          endStatus: 'completed',
        })
      );
    });

    it('should reset all state after stopping', async () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      jest.advanceTimersByTime(5_000);

      await useDurationTrackingStore.getState().stopTracking('collapsed');

      const state = useDurationTrackingStore.getState();
      expect(state.isTracking).toBe(false);
      expect(state.activeCardId).toBeNull();
      expect(state.startTimestamp).toBeNull();
      expect(state.accumulatedSec).toBe(0);
      expect(state.backgroundedAt).toBeNull();
    });

    it('should be a no-op if not tracking', async () => {
      await useDurationTrackingStore.getState().stopTracking('completed');
      expect(mockService.persist).not.toHaveBeenCalled();
    });

    it('should persist with correct start and end timestamps', async () => {
      const beforeStart = new Date().toISOString();
      useDurationTrackingStore.getState().startTracking('card-1');
      jest.advanceTimersByTime(10_000);

      await useDurationTrackingStore.getState().stopTracking('completed');

      const call = (mockService.persist as jest.Mock).mock.calls[0][0];
      expect(new Date(call.startedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeStart).getTime()
      );
      expect(new Date(call.endedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(call.startedAt).getTime()
      );
    });

    it('should support all end statuses', async () => {
      for (const status of ['completed', 'collapsed', 'timed_out'] as const) {
        resetStore();
        (mockService.persist as jest.Mock).mockClear();

        useDurationTrackingStore.getState().startTracking('card-1');
        jest.advanceTimersByTime(5_000);
        await useDurationTrackingStore.getState().stopTracking(status);

        expect(mockService.persist).toHaveBeenCalledWith(
          expect.objectContaining({ endStatus: status })
        );
      }
    });
  });

  describe('handleAppBackground', () => {
    it('should accumulate foreground time and record backgroundedAt', () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      jest.advanceTimersByTime(20_000);

      useDurationTrackingStore.getState().handleAppBackground();

      const state = useDurationTrackingStore.getState();
      expect(state.accumulatedSec).toBe(20);
      expect(state.backgroundedAt).not.toBeNull();
      expect(state.isTracking).toBe(true);
    });

    it('should be a no-op if not tracking', () => {
      useDurationTrackingStore.getState().handleAppBackground();

      const state = useDurationTrackingStore.getState();
      expect(state.backgroundedAt).toBeNull();
      expect(state.accumulatedSec).toBe(0);
    });

    it('should be a no-op if already backgrounded', () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      jest.advanceTimersByTime(10_000);
      useDurationTrackingStore.getState().handleAppBackground();

      const firstBackgroundedAt = useDurationTrackingStore.getState().backgroundedAt;
      jest.advanceTimersByTime(5_000);

      useDurationTrackingStore.getState().handleAppBackground();

      const state = useDurationTrackingStore.getState();
      // Should not double-add or change backgroundedAt
      expect(state.accumulatedSec).toBe(10);
      expect(state.backgroundedAt).toBe(firstBackgroundedAt);
    });
  });

  describe('handleAppForeground', () => {
    it('should resume if background time <= 15 minutes (Req 1.3)', () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      jest.advanceTimersByTime(10_000);
      useDurationTrackingStore.getState().handleAppBackground();

      // Background for 5 minutes (300 seconds) — well within threshold
      jest.advanceTimersByTime(300_000);
      useDurationTrackingStore.getState().handleAppForeground();

      const state = useDurationTrackingStore.getState();
      expect(state.isTracking).toBe(true);
      expect(state.backgroundedAt).toBeNull();
      // Background time not counted — accumulated should still be 10 from foreground only
      expect(state.accumulatedSec).toBe(10);
    });

    it('should auto-end session if background time > 15 minutes (Req 1.4)', () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      jest.advanceTimersByTime(45_000); // 45 seconds foreground
      useDurationTrackingStore.getState().handleAppBackground();

      // Background for 16 minutes (960 seconds) — exceeds threshold
      jest.advanceTimersByTime(960_000);
      useDurationTrackingStore.getState().handleAppForeground();

      const state = useDurationTrackingStore.getState();
      expect(state.isTracking).toBe(false);
      expect(state.activeCardId).toBeNull();

      // Should persist with timed_out status
      expect(mockService.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          activeDurationSec: 45,
          endStatus: 'timed_out',
        })
      );
    });

    it('should set endedAt to backgroundedAt on timeout (Req 1.4)', () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      jest.advanceTimersByTime(10_000);
      useDurationTrackingStore.getState().handleAppBackground();

      const bgAt = useDurationTrackingStore.getState().backgroundedAt;

      jest.advanceTimersByTime(901_000); // Just over 15 minutes
      useDurationTrackingStore.getState().handleAppForeground();

      const call = (mockService.persist as jest.Mock).mock.calls[0][0];
      expect(call.endedAt).toBe(bgAt);
    });

    it('should be a no-op if not tracking', () => {
      useDurationTrackingStore.getState().handleAppForeground();
      expect(mockService.persist).not.toHaveBeenCalled();
    });

    it('should be a no-op if not backgrounded', () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      useDurationTrackingStore.getState().handleAppForeground();

      expect(useDurationTrackingStore.getState().isTracking).toBe(true);
      expect(mockService.persist).not.toHaveBeenCalled();
    });

    it('should not count background time in accumulated seconds after resume', async () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      jest.advanceTimersByTime(10_000); // 10s foreground

      useDurationTrackingStore.getState().handleAppBackground();
      jest.advanceTimersByTime(60_000); // 60s background (within threshold)

      useDurationTrackingStore.getState().handleAppForeground();
      jest.advanceTimersByTime(5_000); // 5s more foreground

      await useDurationTrackingStore.getState().stopTracking('completed');

      // Total should be 10 + 5 = 15 (background time excluded)
      expect(mockService.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          activeDurationSec: 15,
        })
      );
    });
  });

  describe('multiple background/foreground cycles', () => {
    it('should correctly accumulate across multiple cycles', async () => {
      useDurationTrackingStore.getState().startTracking('card-1');

      // Foreground: 10s
      jest.advanceTimersByTime(10_000);
      useDurationTrackingStore.getState().handleAppBackground();

      // Background: 30s (within threshold)
      jest.advanceTimersByTime(30_000);
      useDurationTrackingStore.getState().handleAppForeground();

      // Foreground: 20s
      jest.advanceTimersByTime(20_000);
      useDurationTrackingStore.getState().handleAppBackground();

      // Background: 60s (within threshold)
      jest.advanceTimersByTime(60_000);
      useDurationTrackingStore.getState().handleAppForeground();

      // Foreground: 5s
      jest.advanceTimersByTime(5_000);

      await useDurationTrackingStore.getState().stopTracking('completed');

      // Total foreground: 10 + 20 + 5 = 35
      expect(mockService.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          activeDurationSec: 35,
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle stop immediately after start (< 3s — service will discard)', async () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      // No time advancement — 0 seconds elapsed

      await useDurationTrackingStore.getState().stopTracking('completed');

      // persist is called with 0 seconds — service handles the < 3s discard
      expect(mockService.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          activeDurationSec: 0,
        })
      );
    });

    it('should handle stopTracking while backgrounded', async () => {
      useDurationTrackingStore.getState().startTracking('card-1');
      jest.advanceTimersByTime(15_000);
      useDurationTrackingStore.getState().handleAppBackground();

      // stopTracking called while backgrounded (e.g., from a notification action)
      await useDurationTrackingStore.getState().stopTracking('completed');

      // Should use accumulated time only (no additional foreground time)
      expect(mockService.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          activeDurationSec: 15,
        })
      );
    });
  });
});
