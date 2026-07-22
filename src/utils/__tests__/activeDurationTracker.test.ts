/**
 * Unit tests for ActiveDurationTracker utility.
 *
 * Validates: Requirements 1.3, 1.4
 */

import { AppState } from 'react-native';

// Mock react-native AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
  },
}));

// Mock the store to avoid pulling in native module dependencies
jest.mock('@/stores/durationTrackingStore', () => ({
  useDurationTrackingStore: {
    getState: jest.fn(),
  },
}));

import { createActiveDurationTracker } from '@/utils/activeDurationTracker';

describe('createActiveDurationTracker', () => {
  let mockStore: {
    handleAppBackground: jest.Mock;
    handleAppForeground: jest.Mock;
  };
  let mockRemove: jest.Mock;
  let capturedListener: ((state: string) => void) | null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStore = {
      handleAppBackground: jest.fn(),
      handleAppForeground: jest.fn(),
    };
    mockRemove = jest.fn();
    capturedListener = null;

    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_event: string, listener: (state: string) => void) => {
        capturedListener = listener;
        return { remove: mockRemove };
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('registers an AppState listener on initialize()', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    tracker.initialize();

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('does not register duplicate listeners on double initialize()', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    tracker.initialize();
    tracker.initialize();

    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('calls store.handleAppBackground() when state changes to background', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    tracker.initialize();

    capturedListener!('background');

    expect(mockStore.handleAppBackground).toHaveBeenCalledTimes(1);
  });

  it('calls store.handleAppBackground() when state changes to inactive', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    tracker.initialize();

    capturedListener!('inactive');

    expect(mockStore.handleAppBackground).toHaveBeenCalledTimes(1);
  });

  it('calls store.handleAppForeground() when state changes to active', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    tracker.initialize();

    capturedListener!('active');

    expect(mockStore.handleAppForeground).toHaveBeenCalledTimes(1);
  });

  it('starts a 15-minute timeout on background that triggers handleAppForeground', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    tracker.initialize();

    capturedListener!('background');
    expect(mockStore.handleAppForeground).not.toHaveBeenCalled();

    // Advance past 15 minutes
    jest.advanceTimersByTime(900_000);

    expect(mockStore.handleAppForeground).toHaveBeenCalledTimes(1);
  });

  it('clears background timeout when app returns to active before 15 min', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    tracker.initialize();

    capturedListener!('background');
    // Come back after 5 minutes
    jest.advanceTimersByTime(300_000);
    capturedListener!('active');

    // The timeout should have been cleared — advancing further should NOT trigger foreground again
    jest.advanceTimersByTime(600_000);
    // handleAppForeground called once (from the 'active' event), not again from timeout
    expect(mockStore.handleAppForeground).toHaveBeenCalledTimes(1);
  });

  it('replaces previous timeout on repeated background events', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    tracker.initialize();

    capturedListener!('background');
    jest.advanceTimersByTime(600_000); // 10 min
    // Second background event (e.g. inactive → background transition)
    capturedListener!('background');
    jest.advanceTimersByTime(600_000); // 10 min more (20 total from first, 10 from second)

    // The first timeout was at 15 min but got replaced by the second.
    // handleAppBackground was called twice (once per background event).
    // The first timeout should NOT have fired because it was cleared by the second background event.
    // After 10 more min from second event (20 total from first), the second timeout hasn't fired yet.
    expect(mockStore.handleAppForeground).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300_000); // 15 min from second background event
    expect(mockStore.handleAppForeground).toHaveBeenCalledTimes(1);
  });

  it('removes the AppState listener and clears timeout on teardown()', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    tracker.initialize();

    capturedListener!('background');
    tracker.teardown();

    expect(mockRemove).toHaveBeenCalledTimes(1);

    // Timeout should have been cleared
    jest.advanceTimersByTime(900_000);
    expect(mockStore.handleAppForeground).not.toHaveBeenCalled();
  });

  it('does nothing on teardown if not initialized', () => {
    const tracker = createActiveDurationTracker(() => mockStore as any);
    // Should not throw
    tracker.teardown();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('uses the latest store state on each event (not stale closure)', () => {
    let callCount = 0;
    const getStore = () => {
      callCount++;
      return mockStore as any;
    };
    const tracker = createActiveDurationTracker(getStore);
    tracker.initialize();

    capturedListener!('background');
    capturedListener!('active');

    // getStore should have been called fresh each time
    expect(callCount).toBe(2);
  });
});
