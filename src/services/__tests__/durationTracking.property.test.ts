import * as fc from 'fast-check';
import {
  useDurationTrackingStore,
  setDurationService,
  resetDurationTrackingInternals,
} from '@/stores/durationTrackingStore';
import type { DurationService } from '../durationService';

// Mock the durationService module so the store doesn't try to create a real one
jest.mock('../durationService', () => ({
  createDurationService: jest.fn(() => ({
    persist: jest.fn().mockResolvedValue(null),
    query: jest.fn().mockResolvedValue([]),
    getStats: jest.fn().mockResolvedValue(null),
    getCardAverageDuration: jest.fn().mockResolvedValue(null),
    deleteAll: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('Feature: usage-outcome-insights, Property 2: Duration pause/resume preserves accumulated time', () => {
  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * For any active tracking session with accumulated time T seconds, and any
   * background period of duration B where B < 900 seconds (15 minutes),
   * backgrounding and then foregrounding the app must result in accumulated
   * time still equal to T (background time is not counted). Any additional
   * foreground time A after resume must produce a total of T + A seconds.
   */

  let mockPersist: jest.Mock;
  let mockService: DurationService;

  beforeEach(() => {
    jest.useFakeTimers();
    resetDurationTrackingInternals();
    useDurationTrackingStore.setState({
      isTracking: false,
      activeCardId: null,
      startTimestamp: null,
      accumulatedSec: 0,
      backgroundedAt: null,
    });

    mockPersist = jest.fn().mockResolvedValue({
      id: 'mock-id',
      cardId: 'test-card',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      activeDurationSec: 0,
      endStatus: 'completed',
    });

    mockService = {
      persist: mockPersist,
      query: jest.fn().mockResolvedValue([]),
      getStats: jest.fn().mockResolvedValue(null),
      getCardAverageDuration: jest.fn().mockResolvedValue(null),
      deleteAll: jest.fn().mockResolvedValue(undefined),
    };

    setDurationService(mockService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('background time < 15 min is not counted; accumulated time T is preserved after resume', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7200 }), // accumulatedSec (foreground time before background)
        fc.integer({ min: 0, max: 899 }),   // backgroundDurationSec (< 15 min)
        (accumulatedSec, backgroundDurationSec) => {
          // Reset state for each run
          resetDurationTrackingInternals();
          useDurationTrackingStore.setState({
            isTracking: false,
            activeCardId: null,
            startTimestamp: null,
            accumulatedSec: 0,
            backgroundedAt: null,
          });

          const store = useDurationTrackingStore.getState();

          // Start tracking
          store.startTracking('test-card');

          // Simulate foreground time of T seconds
          jest.advanceTimersByTime(accumulatedSec * 1000);

          // Go to background
          useDurationTrackingStore.getState().handleAppBackground();

          // Verify: accumulated time should be ~T seconds
          const stateAfterBg = useDurationTrackingStore.getState();
          expect(stateAfterBg.isTracking).toBe(true);
          expect(stateAfterBg.backgroundedAt).not.toBeNull();
          expect(stateAfterBg.accumulatedSec).toBe(accumulatedSec);

          // Simulate background time B < 900 seconds
          jest.advanceTimersByTime(backgroundDurationSec * 1000);

          // Return to foreground
          useDurationTrackingStore.getState().handleAppForeground();

          // Verify: accumulated time still equals T (background time not counted)
          const stateAfterFg = useDurationTrackingStore.getState();
          expect(stateAfterFg.isTracking).toBe(true);
          expect(stateAfterFg.backgroundedAt).toBeNull();
          expect(stateAfterFg.accumulatedSec).toBe(accumulatedSec);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('additional foreground time A after resume produces total of T + A', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 3600 }),  // accumulatedSec (foreground time before background)
        fc.integer({ min: 0, max: 899 }),    // backgroundDurationSec (< 15 min)
        fc.integer({ min: 1, max: 3600 }),   // additionalForegroundSec after resume
        (accumulatedSec, backgroundDurationSec, additionalSec) => {
          // Reset state for each run
          resetDurationTrackingInternals();
          useDurationTrackingStore.setState({
            isTracking: false,
            activeCardId: null,
            startTimestamp: null,
            accumulatedSec: 0,
            backgroundedAt: null,
          });

          const store = useDurationTrackingStore.getState();

          // Start tracking
          store.startTracking('test-card');

          // Simulate foreground time of T seconds
          jest.advanceTimersByTime(accumulatedSec * 1000);

          // Go to background
          useDurationTrackingStore.getState().handleAppBackground();

          // Simulate background time B < 900 seconds
          jest.advanceTimersByTime(backgroundDurationSec * 1000);

          // Return to foreground
          useDurationTrackingStore.getState().handleAppForeground();

          // Simulate additional foreground time A
          jest.advanceTimersByTime(additionalSec * 1000);

          // Go to background again to capture the new segment in accumulatedSec
          useDurationTrackingStore.getState().handleAppBackground();

          // Verify: accumulated time should be T + A
          const finalState = useDurationTrackingStore.getState();
          expect(finalState.accumulatedSec).toBe(accumulatedSec + additionalSec);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: usage-outcome-insights, Property 3: Background timeout auto-ends with correct metadata', () => {
  /**
   * **Validates: Requirements 1.4**
   *
   * For any active tracking session with accumulated time T seconds, when the
   * app is backgrounded and the background duration exceeds 900 seconds (15 minutes),
   * the system must auto-persist a DurationRecord with endStatus = 'timed_out',
   * endedAt equal to the moment the app was backgrounded, and activeDurationSec = T.
   */

  let mockPersist: jest.Mock;
  let mockService: DurationService;

  beforeEach(() => {
    jest.useFakeTimers();
    resetDurationTrackingInternals();
    useDurationTrackingStore.setState({
      isTracking: false,
      activeCardId: null,
      startTimestamp: null,
      accumulatedSec: 0,
      backgroundedAt: null,
    });

    mockPersist = jest.fn().mockResolvedValue({
      id: 'mock-id',
      cardId: 'test-card',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      activeDurationSec: 0,
      endStatus: 'timed_out',
    });

    mockService = {
      persist: mockPersist,
      query: jest.fn().mockResolvedValue([]),
      getStats: jest.fn().mockResolvedValue(null),
      getCardAverageDuration: jest.fn().mockResolvedValue(null),
      deleteAll: jest.fn().mockResolvedValue(undefined),
    };

    setDurationService(mockService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('auto-persists with timed_out status, endedAt = backgrounded moment, activeDurationSec = T', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7200 }),    // accumulatedSec (foreground time before background)
        fc.integer({ min: 901, max: 3600 }),   // backgroundDurationSec (> 15 min)
        (accumulatedSec, backgroundDurationSec) => {
          // Reset state for each run
          mockPersist.mockClear();
          resetDurationTrackingInternals();
          useDurationTrackingStore.setState({
            isTracking: false,
            activeCardId: null,
            startTimestamp: null,
            accumulatedSec: 0,
            backgroundedAt: null,
          });

          const store = useDurationTrackingStore.getState();

          // Start tracking
          store.startTracking('test-card');

          // Simulate foreground time of T seconds
          jest.advanceTimersByTime(accumulatedSec * 1000);

          // Go to background — capture the moment
          useDurationTrackingStore.getState().handleAppBackground();

          const stateAfterBg = useDurationTrackingStore.getState();
          const backgroundedAt = stateAfterBg.backgroundedAt;
          expect(backgroundedAt).not.toBeNull();

          // Simulate background time B > 900 seconds
          jest.advanceTimersByTime(backgroundDurationSec * 1000);

          // Return to foreground — this should trigger auto-end
          useDurationTrackingStore.getState().handleAppForeground();

          // Verify: session is ended
          const finalState = useDurationTrackingStore.getState();
          expect(finalState.isTracking).toBe(false);
          expect(finalState.activeCardId).toBeNull();
          expect(finalState.accumulatedSec).toBe(0);

          // Verify: persist was called with correct metadata
          expect(mockPersist).toHaveBeenCalledTimes(1);
          const persistCall = mockPersist.mock.calls[0][0];

          expect(persistCall.cardId).toBe('test-card');
          expect(persistCall.endStatus).toBe('timed_out');
          expect(persistCall.endedAt).toBe(backgroundedAt);
          expect(persistCall.activeDurationSec).toBe(accumulatedSec);
        }
      ),
      { numRuns: 100 }
    );
  });
});
