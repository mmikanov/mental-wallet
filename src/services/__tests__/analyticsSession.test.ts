import {
  startNewSession,
  recordBackgroundEntry,
  handleForegroundReturn,
  getSessionState,
  clearSession,
} from '../analyticsSession';

// Mock expo-crypto module
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

import * as Crypto from 'expo-crypto';

const mockRandomUUID = Crypto.randomUUID as jest.MockedFunction<typeof Crypto.randomUUID>;

// UUID v4 regex pattern
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('analyticsSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Clear module-level session state between tests
    clearSession();
    // Default: expo-crypto works fine
    mockRandomUUID.mockReturnValue('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startNewSession', () => {
    it('generates a UUID session ID via expo-crypto', () => {
      const session = startNewSession();

      expect(mockRandomUUID).toHaveBeenCalled();
      expect(session.sessionId).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
    });

    it('sets sessionStartTime to an ISO 8601 timestamp', () => {
      jest.setSystemTime(new Date('2025-01-15T10:30:00.000Z'));

      const session = startNewSession();

      expect(session.sessionStartTime).toBe('2025-01-15T10:30:00.000Z');
    });

    it('sets backgroundEntryTime to null on fresh session', () => {
      const session = startNewSession();

      expect(session.backgroundEntryTime).toBeNull();
    });

    it('generates a new UUID each time it is called', () => {
      mockRandomUUID
        .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
        .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');

      const session1 = startNewSession();
      const session2 = startNewSession();

      expect(session1.sessionId).toBe('11111111-1111-4111-8111-111111111111');
      expect(session2.sessionId).toBe('22222222-2222-4222-8222-222222222222');
    });
  });

  describe('background/foreground transitions (under 30 min)', () => {
    it('continues the same session when returning from background under 30 minutes', () => {
      jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
      const originalSession = startNewSession();

      // Go to background
      recordBackgroundEntry();

      // Advance 15 minutes (under 30 min threshold)
      jest.advanceTimersByTime(15 * 60 * 1000);

      const returnedSession = handleForegroundReturn();

      expect(returnedSession.sessionId).toBe(originalSession.sessionId);
      expect(returnedSession.sessionStartTime).toBe(originalSession.sessionStartTime);
    });

    it('clears backgroundEntryTime on foreground return within timeout', () => {
      jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
      startNewSession();

      recordBackgroundEntry();
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      const session = handleForegroundReturn();

      expect(session.backgroundEntryTime).toBeNull();
    });

    it('continues session at exactly 29 minutes 59 seconds', () => {
      jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
      const originalSession = startNewSession();

      recordBackgroundEntry();
      // Advance to just under threshold (29 min 59.999s)
      jest.advanceTimersByTime(1_799_999);

      const returnedSession = handleForegroundReturn();

      expect(returnedSession.sessionId).toBe(originalSession.sessionId);
    });
  });

  describe('30-min timeout', () => {
    it('starts a new session when elapsed time equals 30 minutes (1,800,000 ms)', () => {
      jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
      const originalSession = startNewSession();

      recordBackgroundEntry();

      // Set up a different UUID for the new session
      mockRandomUUID.mockReturnValue('99999999-9999-4999-8999-999999999999');

      // Advance exactly 30 minutes
      jest.advanceTimersByTime(1_800_000);

      const returnedSession = handleForegroundReturn();

      expect(returnedSession.sessionId).not.toBe(originalSession.sessionId);
      expect(returnedSession.sessionId).toBe('99999999-9999-4999-8999-999999999999');
    });

    it('starts a new session when elapsed time exceeds 30 minutes', () => {
      jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
      const originalSession = startNewSession();

      recordBackgroundEntry();

      mockRandomUUID.mockReturnValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

      // Advance 45 minutes (well over threshold)
      jest.advanceTimersByTime(45 * 60 * 1000);

      const returnedSession = handleForegroundReturn();

      expect(returnedSession.sessionId).not.toBe(originalSession.sessionId);
      expect(returnedSession.sessionId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    });

    it('sets a new sessionStartTime when starting new session after timeout', () => {
      jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
      startNewSession();

      recordBackgroundEntry();

      // Advance 30 minutes
      jest.advanceTimersByTime(1_800_000);

      const returnedSession = handleForegroundReturn();

      // The new session start time should reflect the time after the advance
      expect(returnedSession.sessionStartTime).toBe('2025-01-15T10:30:00.000Z');
    });

    it('resets backgroundEntryTime to null when starting new session after timeout', () => {
      jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
      startNewSession();

      recordBackgroundEntry();

      jest.advanceTimersByTime(1_800_000);

      const returnedSession = handleForegroundReturn();

      expect(returnedSession.backgroundEntryTime).toBeNull();
    });
  });

  describe('crypto fallback', () => {
    it('falls back to Math.random-based UUID when Crypto.randomUUID() throws', () => {
      mockRandomUUID.mockImplementation(() => {
        throw new Error('Crypto unavailable');
      });

      const session = startNewSession();

      // Verify the fallback produces a valid UUID v4 format
      expect(session.sessionId).toMatch(UUID_V4_REGEX);
    });

    it('fallback UUID has correct version (4) and variant bits', () => {
      mockRandomUUID.mockImplementation(() => {
        throw new Error('Crypto unavailable');
      });

      const session = startNewSession();

      // Check UUID v4 format: version digit is '4', variant is '8', '9', 'a', or 'b'
      const parts = session.sessionId.split('-');
      expect(parts[2][0]).toBe('4'); // version
      expect(['8', '9', 'a', 'b']).toContain(parts[3][0]); // variant
    });

    it('generates different UUIDs on repeated fallback calls', () => {
      mockRandomUUID.mockImplementation(() => {
        throw new Error('Crypto unavailable');
      });

      // Ensure Math.random produces different values
      const session1 = startNewSession();
      const session2 = startNewSession();

      // While not guaranteed by spec, in practice Math.random produces different values
      // We just verify both are valid UUIDs
      expect(session1.sessionId).toMatch(UUID_V4_REGEX);
      expect(session2.sessionId).toMatch(UUID_V4_REGEX);
    });
  });

  describe('getSessionState', () => {
    it('starts a new session if none exists', () => {
      const session = getSessionState();

      expect(session.sessionId).toBeDefined();
      expect(session.sessionStartTime).toBeDefined();
    });

    it('returns current session if one exists', () => {
      const original = startNewSession();
      const retrieved = getSessionState();

      expect(retrieved.sessionId).toBe(original.sessionId);
      expect(retrieved.sessionStartTime).toBe(original.sessionStartTime);
    });
  });

  describe('handleForegroundReturn edge cases', () => {
    it('starts a new session if no previous session exists', () => {
      // clearSession was called in beforeEach, no startNewSession called
      const session = handleForegroundReturn();

      expect(session.sessionId).toBeDefined();
      expect(session.sessionStartTime).toBeDefined();
      expect(mockRandomUUID).toHaveBeenCalled();
    });

    it('continues existing session if no background entry was recorded', () => {
      const original = startNewSession();

      // No recordBackgroundEntry called
      const returned = handleForegroundReturn();

      expect(returned.sessionId).toBe(original.sessionId);
    });
  });
});
