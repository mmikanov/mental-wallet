/**
 * Unit tests for sessionContext utility.
 *
 * Validates: Requirements 10.7
 */

import { isInActiveEmotionSession } from '@/utils/sessionContext';
import { useSessionStore } from '@/stores/sessionStore';

describe('isInActiveEmotionSession', () => {
  beforeEach(() => {
    // Reset the session store to initial state before each test
    useSessionStore.setState({ isSessionActive: false });
  });

  it('returns false when no session is active', () => {
    expect(isInActiveEmotionSession()).toBe(false);
  });

  it('returns true when a session is active', () => {
    useSessionStore.setState({ isSessionActive: true });
    expect(isInActiveEmotionSession()).toBe(true);
  });

  it('reflects state changes immediately', () => {
    expect(isInActiveEmotionSession()).toBe(false);
    useSessionStore.setState({ isSessionActive: true });
    expect(isInActiveEmotionSession()).toBe(true);
    useSessionStore.setState({ isSessionActive: false });
    expect(isInActiveEmotionSession()).toBe(false);
  });
});
