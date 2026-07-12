import * as fc from 'fast-check';
import { useCheckinStore } from '@/stores/checkinStore';
import type { BodyEnergyLevel, Pleasantness, ThoughtPattern, SocialContext } from '@/types/checkin';

// Mock the mapping engine — we want to test the store's behavior, not the engine itself
jest.mock('@/services/mappingEngine', () => ({
  deriveFeeling: jest.fn(() => {
    // Return a deterministic result based on inputs so complete() works
    return { topFeelings: ['stressed'], scores: {} };
  }),
}));

const mappingEngine = require('@/services/mappingEngine');

// --- Generators ---
const bodyEnergyArb = fc.constantFrom<BodyEnergyLevel>('very_low', 'low', 'medium', 'high', 'very_high');
const pleasantnessArb = fc.constantFrom<Pleasantness>('unpleasant', 'mixed', 'pleasant');
const thoughtPatternArb = fc.constantFrom<ThoughtPattern>(
  'racing', 'stuck_worries', 'stuck_mistakes', 'blank', 'numb', 'curious_interested', 'okay'
);
const socialContextArb = fc.constantFrom<SocialContext>('alone_at_home', 'at_work', 'with_family', 'with_friends');

// Helper: step number to answer field name
const stepFieldMap: Record<number, keyof typeof INITIAL_ANSWERS> = {
  1: 'bodyEnergy',
  2: 'pleasantness',
  3: 'thoughtPattern',
  4: 'context',
};

const INITIAL_ANSWERS = {
  bodyEnergy: null,
  pleasantness: null,
  thoughtPattern: null,
  context: null,
};

// Helper: get an arbitrary for a given step
function arbForStep(step: number) {
  switch (step) {
    case 1: return bodyEnergyArb;
    case 2: return pleasantnessArb;
    case 3: return thoughtPatternArb;
    case 4: return socialContextArb;
    default: return bodyEnergyArb;
  }
}

describe('checkinStore', () => {
  beforeEach(() => {
    useCheckinStore.getState().reset();
    jest.clearAllMocks();
  });

  // =========================================================================
  // Task 6.2 — Property 9: Back-navigation clears forward answers
  // =========================================================================
  describe('Feature: guided-emotion-checkin, Property 9: Back-navigation clears forward answers', () => {
    /**
     * **Validates: Requirements 2.14**
     *
     * For any check-in state where the user has answered questions up to step N
     * (2 ≤ N ≤ 4), navigating back to step M (1 ≤ M < N) SHALL result in all
     * answers for steps M+1 through 4 being set to null. Previously recorded
     * answers for step M and earlier SHALL remain unchanged.
     */
    it('navigating back to step M clears answers for steps M+1 through 4 and preserves M and earlier', () => {
      fc.assert(
        fc.property(
          // Generate how many steps to fill (2–4, since we need at least 2 to go back)
          fc.integer({ min: 2, max: 4 }),
          // Generate answers for each step
          bodyEnergyArb,
          pleasantnessArb,
          thoughtPatternArb,
          socialContextArb,
          // How many times to go back (1 means go back once to step N-1)
          fc.integer({ min: 1, max: 3 }),
          (stepsToFill, a1, a2, a3, a4, backCount) => {
            const answers = [a1, a2, a3, a4];

            // Start the check-in
            useCheckinStore.getState().startCheckin();

            // Fill answers up to stepsToFill
            for (let step = 1; step <= stepsToFill && step <= 4; step++) {
              useCheckinStore.setState({ isTransitioning: false });
              useCheckinStore.getState().selectAnswer(step, answers[step - 1]);
            }

            // If stepsToFill is 4, complete() fires and topFeelings is set.
            // Reset for testing goBack behavior on steps < 4
            if (stepsToFill === 4) {
              useCheckinStore.setState({
                isActive: true,
                currentStep: 4,
                isTransitioning: false,
                topFeelings: [],
              });
            }

            const currentStep = useCheckinStore.getState().currentStep;

            // Navigate back: clamp backCount so we don't go below step 1
            const actualBacks = Math.min(backCount, currentStep - 1);
            for (let i = 0; i < actualBacks; i++) {
              useCheckinStore.getState().goBack();
            }

            const state = useCheckinStore.getState();
            const targetStep = currentStep - actualBacks;

            // Answers at targetStep and earlier should be preserved
            for (let step = 1; step <= targetStep; step++) {
              const field = stepFieldMap[step];
              expect(state.answers[field]).toBe(answers[step - 1]);
            }

            // Answers after targetStep should be cleared
            for (let step = targetStep + 1; step <= 4; step++) {
              const field = stepFieldMap[step];
              expect(state.answers[field]).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // =========================================================================
  // Task 6.3 + 18.2 — Unit tests for check-in store (topFeelings)
  // =========================================================================
  describe('Unit tests', () => {
    describe('State transitions: start → step1 → step2 → step3 → step4 → complete', () => {
      /**
       * Validates: Requirements 2.6, 2.13
       */
      it('progresses through all steps and sets topFeelings on completion', () => {
        const store = useCheckinStore;

        // Start
        store.getState().startCheckin();
        expect(store.getState().isActive).toBe(true);
        expect(store.getState().currentStep).toBe(1);

        // Step 1
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(1, 'medium');
        expect(store.getState().answers.bodyEnergy).toBe('medium');
        expect(store.getState().currentStep).toBe(2);

        // Step 2
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(2, 'unpleasant');
        expect(store.getState().answers.pleasantness).toBe('unpleasant');
        expect(store.getState().currentStep).toBe(3);

        // Step 3
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(3, 'racing');
        expect(store.getState().answers.thoughtPattern).toBe('racing');
        expect(store.getState().currentStep).toBe(4);

        // Step 4 triggers complete
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(4, 'at_work');
        expect(store.getState().answers.context).toBe('at_work');

        // complete() should have been called, setting topFeelings
        expect(store.getState().topFeelings).toEqual(['stressed']);
        expect(store.getState().isActive).toBe(true);
        expect(mappingEngine.deriveFeeling).toHaveBeenCalledWith({
          bodyEnergy: 'medium',
          pleasantness: 'unpleasant',
          thoughtPattern: 'racing',
          context: 'at_work',
        });
      });
    });

    describe('Transition locking', () => {
      /**
       * Validates: Requirements 2.13
       */
      it('selectAnswer is ignored when isTransitioning is true', () => {
        const store = useCheckinStore;

        store.getState().startCheckin();
        // Manually set isTransitioning to true
        store.setState({ isTransitioning: true });

        // Try to select an answer
        store.getState().selectAnswer(1, 'high');

        // Should be ignored — answer stays null, step stays 1
        expect(store.getState().answers.bodyEnergy).toBeNull();
        expect(store.getState().currentStep).toBe(1);
      });
    });

    describe('Dismiss resets all state', () => {
      /**
       * Validates: Requirements 2.14
       */
      it('dismiss() returns everything to initial state after partial progress', () => {
        const store = useCheckinStore;

        // Start and answer a couple of questions
        store.getState().startCheckin();
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(1, 'low');
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(2, 'mixed');

        // Dismiss
        store.getState().dismiss();

        const state = store.getState();
        expect(state.isActive).toBe(false);
        expect(state.currentStep).toBe(1);
        expect(state.answers).toEqual(INITIAL_ANSWERS);
        expect(state.topFeelings).toEqual([]);
        expect(state.isTransitioning).toBe(false);
      });
    });

    describe('startCheckin initializes correctly', () => {
      /**
       * Validates: Requirements 2.6
       */
      it('sets isActive=true, currentStep=1, all answers null, topFeelings empty', () => {
        const store = useCheckinStore;

        // First, put the store in a dirty state
        store.setState({
          isActive: false,
          currentStep: 3,
          answers: {
            bodyEnergy: 'high',
            pleasantness: 'pleasant',
            thoughtPattern: null,
            context: null,
          },
          topFeelings: ['calm'],
          isTransitioning: true,
        });

        // startCheckin should reset to initial check-in state
        store.getState().startCheckin();

        const state = store.getState();
        expect(state.isActive).toBe(true);
        expect(state.currentStep).toBe(1);
        expect(state.answers.bodyEnergy).toBeNull();
        expect(state.answers.pleasantness).toBeNull();
        expect(state.answers.thoughtPattern).toBeNull();
        expect(state.answers.context).toBeNull();
        expect(state.topFeelings).toEqual([]);
        expect(state.isTransitioning).toBe(false);
      });
    });

    describe('complete() sets topFeelings', () => {
      /**
       * Validates: Requirements 2.10, 4.1, 4.2
       */
      it('calls mapping engine and sets topFeelings to array of 1+ emotions', () => {
        const store = useCheckinStore;

        mappingEngine.deriveFeeling.mockReturnValue({ topFeelings: ['anxious'], scores: {} });

        store.getState().startCheckin();
        // Fill all answers directly (bypassing transition logic for isolation)
        store.setState({
          answers: {
            bodyEnergy: 'high',
            pleasantness: 'unpleasant',
            thoughtPattern: 'racing',
            context: 'at_work',
          },
        });

        store.getState().complete();

        expect(mappingEngine.deriveFeeling).toHaveBeenCalledWith({
          bodyEnergy: 'high',
          pleasantness: 'unpleasant',
          thoughtPattern: 'racing',
          context: 'at_work',
        });
        expect(store.getState().topFeelings).toEqual(['anxious']);
        expect(store.getState().isActive).toBe(true);
      });

      it('complete() keeps isActive: true', () => {
        const store = useCheckinStore;

        mappingEngine.deriveFeeling.mockReturnValue({ topFeelings: ['stressed'], scores: {} });

        store.getState().startCheckin();
        store.setState({
          answers: {
            bodyEnergy: 'medium',
            pleasantness: 'mixed',
            thoughtPattern: 'okay',
            context: 'alone_at_home',
          },
        });

        store.getState().complete();

        expect(store.getState().isActive).toBe(true);
      });

      it('tied feelings scenario produces topFeelings with multiple entries', () => {
        const store = useCheckinStore;

        mappingEngine.deriveFeeling.mockReturnValue({ topFeelings: ['angry', 'anxious'], scores: {} });

        store.getState().startCheckin();
        store.setState({
          answers: {
            bodyEnergy: 'very_high',
            pleasantness: 'unpleasant',
            thoughtPattern: 'racing',
            context: 'at_work',
          },
        });

        store.getState().complete();

        expect(store.getState().topFeelings).toEqual(['angry', 'anxious']);
        expect(store.getState().isActive).toBe(true);
      });

      it('does nothing if not all answers are present', () => {
        const store = useCheckinStore;

        store.getState().startCheckin();
        store.setState({
          answers: {
            bodyEnergy: 'high',
            pleasantness: 'unpleasant',
            thoughtPattern: null, // missing
            context: null, // missing
          },
        });

        store.getState().complete();

        // Should not call mapping engine
        expect(mappingEngine.deriveFeeling).not.toHaveBeenCalled();
        // Should remain active
        expect(store.getState().isActive).toBe(true);
        expect(store.getState().topFeelings).toEqual([]);
      });
    });

    describe('reset() clears everything', () => {
      /**
       * Validates: Requirements 2.14
       */
      it('after interaction, reset returns to initial state with topFeelings as empty array', () => {
        const store = useCheckinStore;

        // Simulate some usage
        store.getState().startCheckin();
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(1, 'very_high');
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(2, 'pleasant');
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(3, 'curious_interested');
        store.setState({ isTransitioning: false });
        store.getState().selectAnswer(4, 'with_friends');

        // Now reset
        store.getState().reset();

        const state = store.getState();
        expect(state.isActive).toBe(false);
        expect(state.currentStep).toBe(1);
        expect(state.answers).toEqual(INITIAL_ANSWERS);
        expect(state.topFeelings).toEqual([]);
        expect(state.isTransitioning).toBe(false);
      });
    });
  });
});
