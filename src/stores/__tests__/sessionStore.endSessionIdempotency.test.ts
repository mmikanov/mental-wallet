/**
 * Session End Idempotency Tests
 *
 * **Validates: emotion-session-analytics Requirement 5**
 *
 * endSession() can be invoked multiple times for a single session (e.g. the
 * AppState listener firing on transient transitions while the "End session"
 * tap is also in flight). It must fire the `session_ended` analytics event at
 * most once per session, and must not corrupt state when called on an already
 * ended / inactive session.
 */

import { useSessionStore } from '../sessionStore';
import { logEvent } from '@/services/analyticsEventLogger';
import type { EmotionType, ContextType, TimeType } from '@/types/index';

jest.mock('@/services/emotionSessionService', () => ({
  create: jest.fn().mockResolvedValue({
    id: 'mock-session-id',
    selectedEmotion: 'stressed',
    selectedContexts: [],
    selectedTime: null,
    toolCardIds: [],
    startedAt: new Date().toISOString(),
    endedAt: null,
  }),
  endSession: jest.fn().mockResolvedValue(undefined),
  addToolUsed: jest.fn().mockResolvedValue(undefined),
  endUnterminatedSessions: jest.fn().mockResolvedValue(undefined),
  updateSelections: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/recommendationService', () => ({
  getRecommendations: jest.fn().mockResolvedValue({
    walletTools: [],
    libraryTools: [],
    isFallback: false,
  }),
}));

jest.mock('@/services/settingsService', () => ({
  setLastUsedMode: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/completionService', () => ({
  createCompletionService: jest.fn(() => ({
    record: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: {
    getState: jest.fn(() => ({
      cards: [],
      loadCards: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock('@/services/analyticsEventLogger', () => ({
  logEvent: jest.fn(),
}));

jest.mock('@/data/curatedLibrary', () => ({
  CURATED_LIBRARY: [],
}));

const INITIAL_STATE = {
  isSessionActive: false,
  selectedEmotion: null as EmotionType | null,
  selectedContexts: [] as ContextType[],
  selectedTime: null as TimeType | null,
  recommendations: null,
  currentSessionId: null as string | null,
  toolsUsedInSession: [] as string[],
  toolsAddedToWallet: [] as string[],
};

const mockLogEvent = logEvent as jest.MockedFunction<typeof logEvent>;

function countSessionEnded(): number {
  return mockLogEvent.mock.calls.filter((c) => c[0] === 'session_ended').length;
}

describe('sessionStore — endSession idempotency', () => {
  beforeEach(() => {
    useSessionStore.setState(INITIAL_STATE);
    jest.clearAllMocks();
  });

  it('logs session_ended exactly once when endSession is called repeatedly (sequential)', async () => {
    await useSessionStore.getState().selectEmotion('stressed');

    await useSessionStore.getState().endSession();
    await useSessionStore.getState().endSession();
    await useSessionStore.getState().endSession();

    expect(countSessionEnded()).toBe(1);
    expect(useSessionStore.getState().isSessionActive).toBe(false);
    expect(useSessionStore.getState().selectedEmotion).toBeNull();
  });

  it('logs session_ended exactly once under concurrent endSession calls', async () => {
    await useSessionStore.getState().selectEmotion('anxious');

    // Simulate the "End session" tap and an AppState background event racing.
    await Promise.all([
      useSessionStore.getState().endSession(),
      useSessionStore.getState().endSession(),
    ]);

    expect(countSessionEnded()).toBe(1);
  });

  it('does nothing (no session_ended) when endSession is called with no active session', async () => {
    await useSessionStore.getState().endSession();

    expect(countSessionEnded()).toBe(0);
    expect(useSessionStore.getState().isSessionActive).toBe(false);
  });

  it('carries the selected emotion on the single session_ended event', async () => {
    await useSessionStore.getState().selectEmotion('sad');
    await useSessionStore.getState().endSession();
    await useSessionStore.getState().endSession();

    const endedCalls = mockLogEvent.mock.calls.filter((c) => c[0] === 'session_ended');
    expect(endedCalls).toHaveLength(1);
    expect(endedCalls[0][1]).toMatchObject({ emotion: 'sad' });
  });
});
