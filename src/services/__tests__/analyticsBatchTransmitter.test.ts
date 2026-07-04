import {
  startTransmitter,
  stopTransmitter,
  flushNow,
  checkThresholdFlush,
} from '../analyticsBatchTransmitter';
import type { TransmitterConfig, QueuedEvent } from '@/types/analytics';

jest.mock('@/data/analyticsEventQueue', () => ({
  getPendingEvents: jest.fn(),
  markAsSending: jest.fn(),
  markAsPending: jest.fn(),
  deleteEvents: jest.fn(),
  getQueueSize: jest.fn(),
}));

import {
  getPendingEvents,
  markAsSending,
  markAsPending,
  deleteEvents,
  getQueueSize,
} from '@/data/analyticsEventQueue';

const mockedGetPendingEvents = getPendingEvents as jest.MockedFunction<typeof getPendingEvents>;
const mockedMarkAsSending = markAsSending as jest.MockedFunction<typeof markAsSending>;
const mockedMarkAsPending = markAsPending as jest.MockedFunction<typeof markAsPending>;
const mockedDeleteEvents = deleteEvents as jest.MockedFunction<typeof deleteEvents>;
const mockedGetQueueSize = getQueueSize as jest.MockedFunction<typeof getQueueSize>;

// Mock global fetch
const mockedFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>;
global.fetch = mockedFetch;

const DEFAULT_CONFIG: TransmitterConfig = {
  baseUrl: 'https://analytics.example.com',
  batchSize: 50,
  flushThreshold: 10,
  flushIntervalMs: 60_000,
  retryBaseMs: 120_000,
  retryCapMs: 900_000,
};

function makeFakeQueuedEvents(count: number): QueuedEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `event-${i}`,
    payload: JSON.stringify({
      anonymous_user_id: '550e8400-e29b-41d4-a716-446655440000',
      session_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      event_type: 'app_opened',
      timestamp: '2025-01-15T14:30:00.123Z',
      properties: { days_since_install: i },
    }),
    created_at: `2025-01-15T14:${String(i).padStart(2, '0')}:00.000Z`,
    status: 'pending' as const,
  }));
}

/**
 * Helper to flush pending microtasks after advancing fake timers.
 * Multiple awaits are needed to drain nested promise chains.
 */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('analyticsBatchTransmitter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockedMarkAsSending.mockResolvedValue(undefined);
    mockedMarkAsPending.mockResolvedValue(undefined);
    mockedDeleteEvents.mockResolvedValue(undefined);
    stopTransmitter();
  });

  afterEach(() => {
    stopTransmitter();
    jest.useRealTimers();
  });

  describe('Flush triggers', () => {
    it('periodic timer calls flushNow at configured interval', async () => {
      mockedGetPendingEvents.mockResolvedValue([]);

      startTransmitter(DEFAULT_CONFIG);

      // Advance by one interval
      jest.advanceTimersByTime(DEFAULT_CONFIG.flushIntervalMs);
      await flushMicrotasks();

      expect(mockedGetPendingEvents).toHaveBeenCalledWith(DEFAULT_CONFIG.batchSize);
    });

    it('periodic timer fires repeatedly at the configured interval', async () => {
      mockedGetPendingEvents.mockResolvedValue([]);

      startTransmitter(DEFAULT_CONFIG);

      // Advance by three intervals
      jest.advanceTimersByTime(DEFAULT_CONFIG.flushIntervalMs);
      await flushMicrotasks();
      jest.advanceTimersByTime(DEFAULT_CONFIG.flushIntervalMs);
      await flushMicrotasks();
      jest.advanceTimersByTime(DEFAULT_CONFIG.flushIntervalMs);
      await flushMicrotasks();

      expect(mockedGetPendingEvents).toHaveBeenCalledTimes(3);
    });

    it('checkThresholdFlush triggers flush when queue size >= threshold', async () => {
      const events = makeFakeQueuedEvents(10);
      mockedGetQueueSize.mockResolvedValue(10);
      mockedGetPendingEvents.mockResolvedValue(events);
      mockedFetch.mockResolvedValue(new Response(null, { status: 200 }));

      startTransmitter(DEFAULT_CONFIG);

      await checkThresholdFlush();
      await flushMicrotasks();

      expect(mockedGetPendingEvents).toHaveBeenCalled();
      expect(mockedMarkAsSending).toHaveBeenCalledWith(events.map((e) => e.id));
    });
  });

  describe('Exponential backoff calculation', () => {
    it('after first failure, retries at retryBaseMs (120s)', async () => {
      const events = makeFakeQueuedEvents(5);
      mockedGetPendingEvents.mockResolvedValue(events);
      mockedFetch.mockRejectedValue(new Error('Network error'));

      // Use a very large flushIntervalMs to avoid periodic timer interference
      startTransmitter({ ...DEFAULT_CONFIG, flushIntervalMs: 999_999_999 });

      // Trigger flush - failure schedules retry at 120s
      await flushNow();

      // Reset mocks for detecting the retry
      mockedGetPendingEvents.mockClear();
      mockedGetPendingEvents.mockResolvedValue([]);

      // Advance just under retryBaseMs - should NOT have retried yet
      jest.advanceTimersByTime(DEFAULT_CONFIG.retryBaseMs - 1);
      await flushMicrotasks();
      expect(mockedGetPendingEvents).toHaveBeenCalledTimes(0);

      // Advance by 1 more ms to reach retryBaseMs
      jest.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(mockedGetPendingEvents).toHaveBeenCalledTimes(1);
    });

    it('after second failure, retries at retryBaseMs * 2 (240s)', async () => {
      const events = makeFakeQueuedEvents(5);
      mockedGetPendingEvents.mockResolvedValue(events);
      mockedFetch.mockRejectedValue(new Error('Network error'));

      startTransmitter({ ...DEFAULT_CONFIG, flushIntervalMs: 999_999_999 });

      // First flush fails - schedules retry at 120s
      await flushNow();

      // Advance to first retry (120s) - also fails, schedules at 240s
      jest.advanceTimersByTime(DEFAULT_CONFIG.retryBaseMs);
      await flushMicrotasks();

      // Now clear mocks to detect next retry at 240s
      mockedGetPendingEvents.mockClear();
      mockedGetPendingEvents.mockResolvedValue(events);

      // Advance just under 240s - should NOT have retried
      jest.advanceTimersByTime(DEFAULT_CONFIG.retryBaseMs * 2 - 1);
      await flushMicrotasks();
      expect(mockedGetPendingEvents).toHaveBeenCalledTimes(0);

      // Advance by 1 more ms to hit 240s
      jest.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(mockedGetPendingEvents).toHaveBeenCalledTimes(1);
    });

    it('backoff is capped at retryCapMs (15 min)', async () => {
      const events = makeFakeQueuedEvents(5);
      mockedGetPendingEvents.mockResolvedValue(events);
      mockedFetch.mockRejectedValue(new Error('Network error'));

      startTransmitter({ ...DEFAULT_CONFIG, flushIntervalMs: 999_999_999 });

      // Trigger multiple failures to exceed cap
      // retryBaseMs=120s, doubles: 120 -> 240 -> 480 -> 960 capped at 900
      await flushNow(); // failure 1, schedules retry at 120s

      jest.advanceTimersByTime(120_000);
      await flushMicrotasks(); // failure 2, schedules at 240s

      jest.advanceTimersByTime(240_000);
      await flushMicrotasks(); // failure 3, schedules at 480s

      jest.advanceTimersByTime(480_000);
      await flushMicrotasks(); // failure 4, schedules at 900s (capped)

      // Now reset mocks to detect next retry timing
      mockedGetPendingEvents.mockClear();
      mockedGetPendingEvents.mockResolvedValue(events);

      // Should NOT fire before 900s
      jest.advanceTimersByTime(899_999);
      await flushMicrotasks();
      expect(mockedGetPendingEvents).toHaveBeenCalledTimes(0);

      // Should fire at exactly 900s
      jest.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(mockedGetPendingEvents).toHaveBeenCalledTimes(1);
    });

    it('backoff resets to base on successful transmission', async () => {
      const events = makeFakeQueuedEvents(5);
      mockedGetPendingEvents.mockResolvedValue(events);
      mockedFetch.mockRejectedValue(new Error('Network error'));

      startTransmitter({ ...DEFAULT_CONFIG, flushIntervalMs: 999_999_999 });

      // First flush fails - schedules retry at 120s
      await flushNow();

      // Advance to retry, make it succeed this time
      mockedFetch.mockResolvedValue(new Response(null, { status: 200 }));
      jest.advanceTimersByTime(120_000);
      await flushMicrotasks();

      // Now make it fail again to see if backoff resets
      mockedFetch.mockRejectedValue(new Error('Network error'));
      mockedGetPendingEvents.mockClear();
      mockedGetPendingEvents.mockResolvedValue(events);

      // Trigger another flush
      await flushNow();

      // Should schedule retry at retryBaseMs (120s), not 240s
      jest.advanceTimersByTime(DEFAULT_CONFIG.retryBaseMs - 1);
      await flushMicrotasks();
      expect(mockedGetPendingEvents).toHaveBeenCalledTimes(1); // Only the flushNow call

      jest.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(mockedGetPendingEvents).toHaveBeenCalledTimes(2); // Retry fired
    });
  });

  describe('sending to pending recovery', () => {
    it('on network error, events are marked back to pending', async () => {
      const events = makeFakeQueuedEvents(3);
      mockedGetPendingEvents.mockResolvedValue(events);
      mockedFetch.mockRejectedValue(new Error('Network unavailable'));

      startTransmitter(DEFAULT_CONFIG);

      await flushNow();

      const ids = events.map((e) => e.id);
      expect(mockedMarkAsSending).toHaveBeenCalledWith(ids);
      expect(mockedMarkAsPending).toHaveBeenCalledWith(ids);
      expect(mockedDeleteEvents).not.toHaveBeenCalled();
    });

    it('on non-2xx response, events are marked back to pending', async () => {
      const events = makeFakeQueuedEvents(3);
      mockedGetPendingEvents.mockResolvedValue(events);
      mockedFetch.mockResolvedValue(new Response(null, { status: 500 }));

      startTransmitter(DEFAULT_CONFIG);

      await flushNow();

      const ids = events.map((e) => e.id);
      expect(mockedMarkAsSending).toHaveBeenCalledWith(ids);
      expect(mockedMarkAsPending).toHaveBeenCalledWith(ids);
      expect(mockedDeleteEvents).not.toHaveBeenCalled();
    });

    it('on 2xx response, events are deleted from queue', async () => {
      const events = makeFakeQueuedEvents(3);
      mockedGetPendingEvents.mockResolvedValue(events);
      mockedFetch.mockResolvedValue(new Response(null, { status: 200 }));

      startTransmitter(DEFAULT_CONFIG);

      await flushNow();

      const ids = events.map((e) => e.id);
      expect(mockedMarkAsSending).toHaveBeenCalledWith(ids);
      expect(mockedDeleteEvents).toHaveBeenCalledWith(ids);
      expect(mockedMarkAsPending).not.toHaveBeenCalled();
    });
  });

  describe('Queue size eviction', () => {
    it('checkThresholdFlush does NOT flush when below threshold', async () => {
      mockedGetQueueSize.mockResolvedValue(DEFAULT_CONFIG.flushThreshold - 1);

      startTransmitter(DEFAULT_CONFIG);

      await checkThresholdFlush();

      expect(mockedGetPendingEvents).not.toHaveBeenCalled();
    });

    it('checkThresholdFlush does nothing when transmitter is not started', async () => {
      mockedGetQueueSize.mockResolvedValue(100);

      // Don't start transmitter
      await checkThresholdFlush();

      expect(mockedGetQueueSize).not.toHaveBeenCalled();
      expect(mockedGetPendingEvents).not.toHaveBeenCalled();
    });
  });
});
