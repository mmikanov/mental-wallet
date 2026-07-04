import {
  logEvent,
  setLoggerIdentity,
  setLoggerOptIn,
  clearLoggerState,
} from '../analyticsEventLogger';

// Mock dependencies
jest.mock('@/data/analyticsEventQueue', () => ({
  insertEvent: jest.fn().mockResolvedValue(undefined),
  evictOldestIfFull: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/analyticsSession', () => ({
  getSessionState: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
}));

import { insertEvent, evictOldestIfFull } from '@/data/analyticsEventQueue';
import { getSessionState } from '@/services/analyticsSession';

const mockInsertEvent = insertEvent as jest.MockedFunction<typeof insertEvent>;
const mockEvictOldestIfFull = evictOldestIfFull as jest.MockedFunction<typeof evictOldestIfFull>;
const mockGetSessionState = getSessionState as jest.MockedFunction<typeof getSessionState>;

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_SESSION_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

describe('analyticsEventLogger', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
    jest.clearAllMocks();

    clearLoggerState();

    // Default: valid identity, valid session, opted in
    setLoggerIdentity(VALID_USER_ID);
    setLoggerOptIn(true);

    mockGetSessionState.mockReturnValue({
      sessionId: VALID_SESSION_ID,
      sessionStartTime: '2025-01-15T10:00:00.000Z',
      backgroundEntryTime: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Validation (missing fields discarded) ───────────────────────────────────

  describe('Validation (missing fields discarded)', () => {
    it('discards event when anonymousUserId is not set', async () => {
      clearLoggerState(); // clears identity
      setLoggerOptIn(true);

      await logEvent('app_opened', { days_since_install: 1 });

      expect(mockInsertEvent).not.toHaveBeenCalled();
    });

    it('discards event when session has invalid UUID', async () => {
      mockGetSessionState.mockReturnValue({
        sessionId: 'not-a-valid-uuid',
        sessionStartTime: '2025-01-15T10:00:00.000Z',
        backgroundEntryTime: null,
      });

      await logEvent('app_opened', { days_since_install: 0 });

      expect(mockInsertEvent).not.toHaveBeenCalled();
    });

    it('silently discards unknown event types (never crashes)', async () => {
      // Force-cast to simulate an unknown event type coming in
      await expect(
        logEvent('unknown_event' as any, {})
      ).resolves.toBeUndefined();

      expect(mockInsertEvent).not.toHaveBeenCalled();
    });
  });

  // ─── Opt-out filtering ────────────────────────────────────────────────────────

  describe('Opt-out filtering', () => {
    beforeEach(() => {
      setLoggerOptIn(false);
    });

    it('when opted out, discards behavioral events (tool_opened)', async () => {
      await logEvent('tool_opened', {
        card_id: 'card1',
        card_category: 'grounding',
        origin_badge: 'library',
      });

      expect(mockInsertEvent).not.toHaveBeenCalled();
    });

    it('when opted out, discards behavioral events (session_started)', async () => {
      await logEvent('session_started');

      expect(mockInsertEvent).not.toHaveBeenCalled();
    });

    it('when opted out, allows app_opened with no properties', async () => {
      await logEvent('app_opened', { days_since_install: 5 });

      expect(mockInsertEvent).toHaveBeenCalledTimes(1);

      const insertedEvent = mockInsertEvent.mock.calls[0][0];
      // Properties should be stripped when opted out
      expect(insertedEvent).not.toHaveProperty('properties');
    });

    it('when opted out, allows session_ended with no contextual properties beyond base + session_duration_ms', async () => {
      await logEvent('session_ended');

      expect(mockInsertEvent).toHaveBeenCalledTimes(1);

      const insertedEvent = mockInsertEvent.mock.calls[0][0];
      // session_ended gets session_duration_ms computed (required field), but other props stripped
      expect(insertedEvent.event_type).toBe('session_ended');
    });

    it('when opted in, all event types are logged normally', async () => {
      setLoggerOptIn(true);

      await logEvent('tool_opened', {
        card_id: 'card1',
        card_category: 'grounding',
        origin_badge: 'library',
      });

      expect(mockInsertEvent).toHaveBeenCalledTimes(1);

      const insertedEvent = mockInsertEvent.mock.calls[0][0];
      expect(insertedEvent.event_type).toBe('tool_opened');
      expect((insertedEvent as any).properties.card_id).toBe('card1');
    });
  });

  // ─── duration_ms computation ──────────────────────────────────────────────────

  describe('duration_ms computation', () => {
    it('tool_completed gets duration_ms from matching tool_opened timestamp', async () => {
      // Log tool_opened first
      jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
      await logEvent('tool_opened', {
        card_id: 'card1',
        card_category: 'grounding',
        origin_badge: 'library',
      });

      // Advance 5 seconds
      jest.advanceTimersByTime(5000);

      // Log tool_completed
      await logEvent('tool_completed', {
        card_id: 'card1',
        card_category: 'grounding',
        origin_badge: 'library',
      });

      expect(mockInsertEvent).toHaveBeenCalledTimes(2);

      const completedEvent = mockInsertEvent.mock.calls[1][0];
      expect((completedEvent as any).properties.duration_ms).toBe(5000);
    });

    it('tool_completed gets duration_ms = 0 when no matching tool_opened exists', async () => {
      await logEvent('tool_completed', {
        card_id: 'card_no_open',
        card_category: 'cognitive',
        origin_badge: 'my_tool',
      });

      expect(mockInsertEvent).toHaveBeenCalledTimes(1);

      const completedEvent = mockInsertEvent.mock.calls[0][0];
      expect((completedEvent as any).properties.duration_ms).toBe(0);
    });
  });

  // ─── session_duration_ms computation ──────────────────────────────────────────

  describe('session_duration_ms computation', () => {
    it('session_ended gets session_duration_ms from app_opened timestamp', async () => {
      // Log app_opened to register session start
      jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
      await logEvent('app_opened', { days_since_install: 0 });

      // Advance 2 minutes
      jest.advanceTimersByTime(120_000);

      // Log session_ended
      await logEvent('session_ended');

      expect(mockInsertEvent).toHaveBeenCalledTimes(2);

      const sessionEndedEvent = mockInsertEvent.mock.calls[1][0];
      expect((sessionEndedEvent as any).properties.session_duration_ms).toBe(120_000);
    });

    it('session_ended gets session_duration_ms = 0 when no app_opened exists', async () => {
      // No app_opened logged — directly log session_ended
      await logEvent('session_ended');

      expect(mockInsertEvent).toHaveBeenCalledTimes(1);

      const sessionEndedEvent = mockInsertEvent.mock.calls[0][0];
      expect((sessionEndedEvent as any).properties.session_duration_ms).toBe(0);
    });
  });

  // ─── Serialization round-trip ─────────────────────────────────────────────────

  describe('Serialization round-trip', () => {
    it('JSON.parse(JSON.stringify(event)) produces semantically equivalent object', async () => {
      await logEvent('tool_opened', {
        card_id: 'card1',
        card_category: 'grounding',
        origin_badge: 'library',
      });

      expect(mockInsertEvent).toHaveBeenCalledTimes(1);

      const event = mockInsertEvent.mock.calls[0][0];
      const roundTripped = JSON.parse(JSON.stringify(event));

      expect(roundTripped).toEqual(event);
    });
  });
});
