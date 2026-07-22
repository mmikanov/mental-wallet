/**
 * Preservation Property Tests — Session End Clears All State Including Added-to-Wallet
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 *
 * These tests capture the baseline behavior of endSession() and dismissWithoutSession()
 * on UNFIXED code. They verify that session cleanup properly resets all state fields
 * (including toolsAddedToWallet) back to INITIAL_STATE.
 *
 * EXPECTED OUTCOME: All tests PASS on unfixed code — this is behavior we want to PRESERVE.
 */

import * as fc from 'fast-check';
import { useSessionStore } from '../sessionStore';
import type { EmotionType, ContextType, TimeType } from '@/types/index';

// Mock dependencies
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

// Generators
const emotionArb = fc.constantFrom<EmotionType>(
  'stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb',
  'lonely', 'ashamed', 'guilty', 'hopeless', 'calm', 'curious'
);
const contextArb = fc.constantFrom<ContextType>(
  'at_work', 'with_family', 'with_friends', 'alone_at_home', 'not_sure'
);
const timeArb = fc.constantFrom<TimeType>('1_2_min', '5_10_min');
const toolTitleArb = fc.string({ minLength: 1, maxLength: 50 });

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

describe('sessionStore — Preservation: Session End Clears All State', () => {
  beforeEach(() => {
    useSessionStore.setState(INITIAL_STATE);
    jest.clearAllMocks();
  });

  describe('Property 2: Preservation — endSession() resets to INITIAL_STATE', () => {
    /**
     * **Validates: Requirements 6.1**
     *
     * For any sequence of session actions (selectEmotion, toggleContext, selectTime,
     * recordToolAdded), calling endSession() SHALL reset all session state fields
     * back to their initial values. This includes toolsAddedToWallet being cleared.
     */
    it('for all sequences of session actions followed by endSession(), store resets to INITIAL_STATE', async () => {
      await fc.assert(
        fc.asyncProperty(
          emotionArb,
          fc.array(contextArb, { minLength: 0, maxLength: 5 }),
          fc.option(timeArb),
          fc.array(toolTitleArb, { minLength: 1, maxLength: 5 }),
          async (emotion, contexts, time, toolTitles) => {
            // Reset to initial state
            useSessionStore.setState(INITIAL_STATE);

            // Simulate session: select emotion, contexts, time
            await useSessionStore.getState().selectEmotion(emotion);
            for (const ctx of contexts) {
              useSessionStore.getState().toggleContext(ctx);
            }
            if (time) {
              useSessionStore.getState().selectTime(time);
            }

            // Record tools added to wallet
            for (const title of toolTitles) {
              useSessionStore.getState().recordToolAdded(title);
            }

            // Verify state was mutated (session is active, tools recorded)
            const stateBeforeEnd = useSessionStore.getState();
            expect(stateBeforeEnd.isSessionActive).toBe(true);
            expect(stateBeforeEnd.toolsAddedToWallet.length).toBe(toolTitles.length);

            // End session
            await useSessionStore.getState().endSession();

            // Verify ALL state is reset to INITIAL_STATE
            const stateAfterEnd = useSessionStore.getState();
            expect(stateAfterEnd.isSessionActive).toBe(false);
            expect(stateAfterEnd.selectedEmotion).toBeNull();
            expect(stateAfterEnd.selectedContexts).toEqual([]);
            expect(stateAfterEnd.selectedTime).toBeNull();
            expect(stateAfterEnd.recommendations).toBeNull();
            expect(stateAfterEnd.currentSessionId).toBeNull();
            expect(stateAfterEnd.toolsUsedInSession).toEqual([]);
            expect(stateAfterEnd.toolsAddedToWallet).toEqual([]);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2: Preservation — dismissWithoutSession() resets to INITIAL_STATE', () => {
    /**
     * **Validates: Requirements 6.2**
     *
     * For any sequence of session actions (selectEmotion, toggleContext, selectTime,
     * recordToolAdded), calling dismissWithoutSession() SHALL reset all session state
     * fields back to their initial values. This includes toolsAddedToWallet being cleared.
     */
    it('for all sequences of session actions followed by dismissWithoutSession(), store resets to INITIAL_STATE', async () => {
      await fc.assert(
        fc.asyncProperty(
          emotionArb,
          fc.array(contextArb, { minLength: 0, maxLength: 5 }),
          fc.option(timeArb),
          fc.array(toolTitleArb, { minLength: 1, maxLength: 5 }),
          async (emotion, contexts, time, toolTitles) => {
            // Reset to initial state
            useSessionStore.setState(INITIAL_STATE);

            // Simulate session: select emotion, contexts, time
            await useSessionStore.getState().selectEmotion(emotion);
            for (const ctx of contexts) {
              useSessionStore.getState().toggleContext(ctx);
            }
            if (time) {
              useSessionStore.getState().selectTime(time);
            }

            // Record tools added to wallet
            for (const title of toolTitles) {
              useSessionStore.getState().recordToolAdded(title);
            }

            // Verify state was mutated
            const stateBeforeDismiss = useSessionStore.getState();
            expect(stateBeforeDismiss.isSessionActive).toBe(true);
            expect(stateBeforeDismiss.toolsAddedToWallet.length).toBe(toolTitles.length);

            // Dismiss without session
            useSessionStore.getState().dismissWithoutSession();

            // Verify ALL state is reset to INITIAL_STATE
            const stateAfterDismiss = useSessionStore.getState();
            expect(stateAfterDismiss.isSessionActive).toBe(false);
            expect(stateAfterDismiss.selectedEmotion).toBeNull();
            expect(stateAfterDismiss.selectedContexts).toEqual([]);
            expect(stateAfterDismiss.selectedTime).toBeNull();
            expect(stateAfterDismiss.recommendations).toBeNull();
            expect(stateAfterDismiss.currentSessionId).toBeNull();
            expect(stateAfterDismiss.toolsUsedInSession).toEqual([]);
            expect(stateAfterDismiss.toolsAddedToWallet).toEqual([]);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Preservation — toolsAddedToWallet records correctly during session', () => {
    /**
     * **Validates: Requirements 6.4, 6.5**
     *
     * When a tool is added to the wallet during the session via recordToolAdded(),
     * the system SHALL correctly record the tool title in toolsAddedToWallet for
     * the session summary. Multiple tools can be added and all are tracked.
     */
    it('recordToolAdded appends tool titles in order and tracks count correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          emotionArb,
          fc.array(toolTitleArb, { minLength: 1, maxLength: 8 }),
          async (emotion, toolTitles) => {
            // Reset to initial state
            useSessionStore.setState(INITIAL_STATE);

            // Start a session
            await useSessionStore.getState().selectEmotion(emotion);

            // Record each tool one by one and verify accumulation
            for (let i = 0; i < toolTitles.length; i++) {
              useSessionStore.getState().recordToolAdded(toolTitles[i]);

              const state = useSessionStore.getState();
              // Verify count matches
              expect(state.toolsAddedToWallet.length).toBe(i + 1);
              // Verify order preserved
              expect(state.toolsAddedToWallet[i]).toBe(toolTitles[i]);
            }

            // Final state should contain all titles in order
            const finalState = useSessionStore.getState();
            expect(finalState.toolsAddedToWallet).toEqual(toolTitles);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
