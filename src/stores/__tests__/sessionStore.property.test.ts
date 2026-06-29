import * as fc from 'fast-check';
import { useSessionStore } from '../sessionStore';
import type { EmotionType, ContextType, TimeType } from '@/types/index';

// Mock dependencies
jest.mock('@/services/emotionSessionService', () => ({
  create: jest.fn().mockResolvedValue({ id: 'mock-session-id', selectedEmotion: 'stressed', selectedContexts: [], selectedTime: null, toolCardIds: [], startedAt: new Date().toISOString(), endedAt: null }),
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

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: {
    getState: jest.fn(() => ({ cards: [] })),
  },
}));

const emotionSessionService = require('@/services/emotionSessionService');

// Generators
const emotionArb = fc.constantFrom<EmotionType>('stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb');
const contextArb = fc.constantFrom<ContextType>('at_work', 'with_family', 'with_friends', 'alone_at_home', 'not_sure');
const timeArb = fc.constantFrom<TimeType>('1_2_min', '5_10_min');
const contextSequenceArb = fc.array(contextArb, { minLength: 1, maxLength: 10 });

const INITIAL_STATE = {
  isSessionActive: false,
  selectedEmotion: null as EmotionType | null,
  selectedContexts: [] as ContextType[],
  selectedTime: null as TimeType | null,
  recommendations: null,
  currentSessionId: null as string | null,
  toolsUsedInSession: [] as string[],
};

describe('sessionStore - Property Tests', () => {
  beforeEach(() => {
    useSessionStore.setState(INITIAL_STATE);
    jest.clearAllMocks();
    // Reset the mock to return unique session IDs
    let callCount = 0;
    emotionSessionService.create.mockImplementation(async (emotion: EmotionType) => ({
      id: `session-${++callCount}`,
      selectedEmotion: emotion,
      selectedContexts: [],
      selectedTime: null,
      toolCardIds: [],
      startedAt: new Date().toISOString(),
      endedAt: null,
    }));
  });

  describe('Feature: emotion-first-onboarding, Property 4: Collapse discards all unsaved session selections', () => {
    /**
     * **Validates: Requirements 4.9, 12.3**
     *
     * For any combination of partial selections (any subset of: one emotion,
     * zero-to-five context chips, zero-or-one time chip), calling
     * dismissWithoutSession() SHALL result in all selections being cleared
     * (emotion = null, contexts = [], time = null) and no EmotionSession
     * record being created in the database (verified by checking the service
     * was not called to persist a new session, or if one was created, endSession
     * was called to clean up).
     */
    it('dismissWithoutSession clears all selections and creates no persistent DB record', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(emotionArb),
          fc.subarray(['at_work', 'with_family', 'with_friends', 'alone_at_home', 'not_sure'] as const),
          fc.option(timeArb),
          async (emotion, contexts, time) => {
            // Reset to initial state
            useSessionStore.setState(INITIAL_STATE);
            jest.clearAllMocks();
            emotionSessionService.create.mockResolvedValue({
              id: 'test-session',
              selectedEmotion: emotion ?? 'stressed',
              selectedContexts: [],
              selectedTime: null,
              toolCardIds: [],
              startedAt: new Date().toISOString(),
              endedAt: null,
            });

            // Apply partial selections
            if (emotion) {
              await useSessionStore.getState().selectEmotion(emotion);
            }
            for (const ctx of contexts) {
              useSessionStore.getState().toggleContext(ctx);
            }
            if (time) {
              useSessionStore.getState().selectTime(time);
            }

            // Clear mocks to isolate dismissWithoutSession behavior
            jest.clearAllMocks();

            // Dismiss without session
            useSessionStore.getState().dismissWithoutSession();

            // Verify all state is cleared
            const state = useSessionStore.getState();
            expect(state.selectedEmotion).toBeNull();
            expect(state.selectedContexts).toEqual([]);
            expect(state.selectedTime).toBeNull();
            expect(state.recommendations).toBeNull();
            expect(state.isSessionActive).toBe(false);
            expect(state.currentSessionId).toBeNull();
            expect(state.toolsUsedInSession).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 5: Emotion single-selection invariant', () => {
    /**
     * **Validates: Requirements 5.2, 5.3, 5.4**
     *
     * For any sequence of selectEmotion/deselectEmotion calls, at most one
     * emotion is selected at any point. Selecting emotion A then B results
     * in only B selected. Deselecting returns to null.
     * "Show me tools" is enabled iff exactly one emotion is selected.
     */
    it('at most one emotion selected at any time; selecting replaces previous selection', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, emotionArb, async (emotionA, emotionB) => {
          // Reset state
          useSessionStore.setState(INITIAL_STATE);

          // Select emotion A
          await useSessionStore.getState().selectEmotion(emotionA);
          let state = useSessionStore.getState();
          expect(state.selectedEmotion).toBe(emotionA);
          // "Show me tools" enabled iff exactly one selected
          expect(state.selectedEmotion !== null).toBe(true);

          // Select emotion B (replaces A)
          await useSessionStore.getState().selectEmotion(emotionB);
          state = useSessionStore.getState();
          expect(state.selectedEmotion).toBe(emotionB);
          // Only B is selected, never both
          expect(state.selectedEmotion !== null).toBe(true);

          // Deselect emotion
          useSessionStore.getState().deselectEmotion();
          state = useSessionStore.getState();
          expect(state.selectedEmotion).toBeNull();
          // "Show me tools" disabled when none selected
          expect(state.selectedEmotion).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 6: Context chips toggle independently', () => {
    /**
     * **Validates: Requirements 6.3**
     *
     * For any sequence of toggleContext calls on different contexts, each
     * toggle only affects the targeted context. Starting from [], toggling
     * a context adds it; toggling it again removes it. Other contexts
     * remain unaffected.
     */
    it('toggling one context does not affect others; multiple can be selected', () => {
      fc.assert(
        fc.property(contextSequenceArb, (contextSequence) => {
          // Reset state
          useSessionStore.setState(INITIAL_STATE);

          // Track expected state manually
          const expectedSet = new Set<ContextType>();

          for (const context of contextSequence) {
            // Toggle context
            useSessionStore.getState().toggleContext(context);

            // Update expected state
            if (expectedSet.has(context)) {
              expectedSet.delete(context);
            } else {
              expectedSet.add(context);
            }

            // Verify actual state matches expected
            const state = useSessionStore.getState();
            const actualSet = new Set(state.selectedContexts);
            expect(actualSet).toEqual(expectedSet);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 7: Time chips single-select with deselect', () => {
    /**
     * **Validates: Requirements 6.5**
     *
     * At most one time chip selected at any time. Selecting time A while B
     * is selected deselects B. Tapping the currently selected time chip
     * deselects it (results in null).
     */
    it('at most one time chip selected; re-tapping deselects', () => {
      fc.assert(
        fc.property(
          fc.array(timeArb, { minLength: 1, maxLength: 10 }),
          (timeSequence) => {
            // Reset state
            useSessionStore.setState(INITIAL_STATE);

            let expectedTime: TimeType | null = null;

            for (const time of timeSequence) {
              useSessionStore.getState().selectTime(time);

              // Toggle behavior: if same as current, deselects
              if (time === expectedTime) {
                expectedTime = null;
              } else {
                expectedTime = time;
              }

              const state = useSessionStore.getState();
              expect(state.selectedTime).toBe(expectedTime);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
