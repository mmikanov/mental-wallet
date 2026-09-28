/**
 * Bug 2, Cycle B — Preservation test (task 2.7, area 2 of 3).
 *
 * Purpose: pin the BASELINE "no double-count on card switch" behavior that must
 * remain true both BEFORE and AFTER the Cycle B wiring (tasks 2.8–2.11). Once
 * `expandCard()` calls `startTracking()`, a user tapping directly from tool A to
 * tool B will call `startTracking('B')` while A is still in progress. The store
 * contract (see the comment in `durationTrackingStore.ts`) is that the previous
 * session is *implicitly abandoned — no record persisted*, so A's time is not
 * double-counted nor mis-attributed to B (Requirement 4.7).
 *
 * What this pins:
 *   1. `startTracking('card-B')` while already tracking 'card-A' does NOT persist
 *      anything for card-A (no `persist` call at the switch point).
 *   2. A subsequent `stopTracking('completed')` persists exactly ONE record, and
 *      it is attributed to card-B only — never card-A.
 *
 * Uses an injected mock `DurationService` (via `setDurationService`) and fake
 * timers, mirroring `durationTracking.property.test.ts`. No production code is
 * changed.
 *
 * Validates: Requirements 4.7
 */

import {
  useDurationTrackingStore,
  setDurationService,
  resetDurationTrackingInternals,
} from '@/stores/durationTrackingStore';
import type { DurationService } from '@/services/durationService';

// Prevent the store from ever constructing a real DurationService (which would
// reach for the real DB). If the injected mock is somehow bypassed, this keeps
// the fallback inert.
jest.mock('@/services/durationService', () => ({
  createDurationService: jest.fn(() => ({
    persist: jest.fn().mockResolvedValue(null),
    query: jest.fn().mockResolvedValue([]),
    getStats: jest.fn().mockResolvedValue(null),
    getCardAverageDuration: jest.fn().mockResolvedValue(null),
    deleteAll: jest.fn().mockResolvedValue(undefined),
  })),
}));

function resetStore() {
  resetDurationTrackingInternals();
  useDurationTrackingStore.setState({
    isTracking: false,
    activeCardId: null,
    startTimestamp: null,
    accumulatedSec: 0,
    backgroundedAt: null,
  });
}

describe('DurationTrackingStore — switching cards does not double-count (preservation, Req 4.7)', () => {
  let mockPersist: jest.Mock;
  let mockService: DurationService;

  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();

    mockPersist = jest.fn().mockResolvedValue({
      id: 'mock-id',
      cardId: 'card-B',
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

  it('abandons the in-progress card-A session on switch (no persist for card-A)', () => {
    const store = useDurationTrackingStore.getState();

    // Begin tracking card A and accrue some foreground time.
    store.startTracking('card-A');
    jest.advanceTimersByTime(30_000); // 30s on card A

    // Switch directly to card B while A is still in progress.
    useDurationTrackingStore.getState().startTracking('card-B');

    // Req 4.7: A's session is implicitly abandoned — nothing persisted at switch.
    expect(mockPersist).not.toHaveBeenCalled();

    // Store now reflects card B as the active session.
    const state = useDurationTrackingStore.getState();
    expect(state.isTracking).toBe(true);
    expect(state.activeCardId).toBe('card-B');
    // Accumulated time reset to 0 for the new card (A's time did not carry over).
    expect(state.accumulatedSec).toBe(0);
  });

  it('persists exactly ONE record after a switch, attributed to card-B only', async () => {
    const store = useDurationTrackingStore.getState();

    store.startTracking('card-A');
    jest.advanceTimersByTime(30_000); // 30s on card A (should be discarded)

    useDurationTrackingStore.getState().startTracking('card-B');
    jest.advanceTimersByTime(10_000); // 10s on card B

    await useDurationTrackingStore.getState().stopTracking('completed');

    // Exactly one persisted record — no separate write for the abandoned card A.
    expect(mockPersist).toHaveBeenCalledTimes(1);

    const persisted = mockPersist.mock.calls[0][0];
    // Attributed to card B, never card A (no mis-attribution / no double count).
    expect(persisted.cardId).toBe('card-B');
    expect(persisted.endStatus).toBe('completed');
    // Reflects only card B's on-screen time (10s), not A's 30s.
    expect(persisted.activeDurationSec).toBe(10);
  });
});
