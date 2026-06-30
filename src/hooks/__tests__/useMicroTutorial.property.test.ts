/**
 * Property 4: Tutorial dismissal activates checklist
 *
 * For any active tutorial step (tooltip 1 or tooltip 2), dismissing the tutorial
 * (via skip or completing all guided actions) results in `tutorialComplete === true`
 * and `isChecklistVisible === true`.
 *
 * **Validates: Requirements 5.3, 5.5**
 */

import * as fc from 'fast-check';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TutorialStep } from '../useMicroTutorial';

// Mock the database module to prevent real DB calls
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
}));

/**
 * Pure state machine model for the useMicroTutorial hook.
 * Mirrors the hook's transition logic without React rendering concerns.
 */
class TutorialStateMachine {
  currentStep: TutorialStep = 'idle';

  start(): void {
    if (this.currentStep === 'idle') {
      this.currentStep = 'tooltip_frontmost_card';
    }
  }

  advance(): boolean {
    if (this.currentStep === 'tooltip_frontmost_card') {
      this.currentStep = 'tooltip_action_button';
      return false;
    }
    if (this.currentStep === 'tooltip_action_button') {
      this.currentStep = 'complete';
      return true; // triggers completeTutorial
    }
    return false;
  }

  skip(): boolean {
    if (this.currentStep !== 'idle' && this.currentStep !== 'complete') {
      this.currentStep = 'complete';
      return true; // triggers completeTutorial
    }
    return false;
  }

  get isActive(): boolean {
    return (
      this.currentStep === 'tooltip_frontmost_card' ||
      this.currentStep === 'tooltip_action_button'
    );
  }
}

describe('Feature: onboarding, Property 4: Tutorial dismissal activates checklist', () => {
  beforeEach(() => {
    // Reset onboarding store to a pre-tutorial state:
    // tutorial not complete, checklist items all false, sessionCount < 3
    useOnboardingStore.setState({
      disclaimerAcknowledged: true,
      onboardingScreensComplete: true,
      selectedIntent: 'overwhelm',
      tutorialComplete: false,
      checklist: { openTool: false, tryExercise: false, addTool: false },
      checklistSessionCount: 0,
      bannerDismissed: false,
      isChecklistVisible: false,
      isChecklistComplete: false,
    });
  });

  // Arbitraries
  const activeStepArb = fc.constantFrom<TutorialStep>(
    'tooltip_frontmost_card',
    'tooltip_action_button'
  );

  const dismissMethodArb = fc.constantFrom<'skip' | 'advance_to_complete'>(
    'skip',
    'advance_to_complete'
  );

  it('dismissing tutorial from any active step sets tutorialComplete=true and isChecklistVisible=true', async () => {
    await fc.assert(
      fc.asyncProperty(
        activeStepArb,
        dismissMethodArb,
        async (startStep, dismissMethod) => {
          // Reset store state for each property run
          useOnboardingStore.setState({
            disclaimerAcknowledged: true,
            onboardingScreensComplete: true,
            selectedIntent: 'overwhelm',
            tutorialComplete: false,
            checklist: { openTool: false, tryExercise: false, addTool: false },
            checklistSessionCount: 0,
            bannerDismissed: false,
            isChecklistVisible: false,
            isChecklistComplete: false,
          });

          const machine = new TutorialStateMachine();

          // Start the tutorial
          machine.start();
          expect(machine.currentStep).toBe('tooltip_frontmost_card');

          // Navigate to the desired active step
          if (startStep === 'tooltip_action_button') {
            machine.advance();
          }
          expect(machine.currentStep).toBe(startStep);
          expect(machine.isActive).toBe(true);

          // Dismiss the tutorial via the chosen method
          let triggeredComplete = false;
          if (dismissMethod === 'skip') {
            triggeredComplete = machine.skip();
          } else {
            // advance_to_complete: advance through remaining steps
            if (startStep === 'tooltip_frontmost_card') {
              machine.advance();
            }
            triggeredComplete = machine.advance();
          }

          // The machine reached 'complete'
          expect(machine.currentStep).toBe('complete');
          expect(triggeredComplete).toBe(true);

          // Call completeTutorial on the store (mirrors the hook behavior)
          await useOnboardingStore.getState().completeTutorial();

          // Verify store state
          const storeState = useOnboardingStore.getState();
          expect(storeState.tutorialComplete).toBe(true);
          expect(storeState.isChecklistVisible).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('any random action sequence reaching complete state activates checklist visibility', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom('start', 'advance', 'skip') as fc.Arbitrary<'start' | 'advance' | 'skip'>,
          { minLength: 1, maxLength: 10 }
        ),
        async (actions) => {
          // Reset store state
          useOnboardingStore.setState({
            disclaimerAcknowledged: true,
            onboardingScreensComplete: true,
            selectedIntent: 'overwhelm',
            tutorialComplete: false,
            checklist: { openTool: false, tryExercise: false, addTool: false },
            checklistSessionCount: 0,
            bannerDismissed: false,
            isChecklistVisible: false,
            isChecklistComplete: false,
          });

          const machine = new TutorialStateMachine();
          let reachedComplete = false;

          for (const action of actions) {
            let triggered = false;
            if (action === 'start') {
              machine.start();
            } else if (action === 'advance') {
              triggered = machine.advance();
            } else {
              triggered = machine.skip();
            }
            if (triggered) {
              reachedComplete = true;
            }
          }

          // If the machine reached 'complete', verify the invariant
          if (reachedComplete && machine.currentStep === 'complete') {
            await useOnboardingStore.getState().completeTutorial();

            const storeState = useOnboardingStore.getState();
            expect(storeState.tutorialComplete).toBe(true);
            expect(storeState.isChecklistVisible).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completing all guided actions (full sequence) activates checklist', async () => {
    const machine = new TutorialStateMachine();

    // idle → tooltip_frontmost_card
    machine.start();
    expect(machine.currentStep).toBe('tooltip_frontmost_card');
    expect(machine.isActive).toBe(true);

    // tooltip_frontmost_card → tooltip_action_button
    machine.advance();
    expect(machine.currentStep).toBe('tooltip_action_button');
    expect(machine.isActive).toBe(true);

    // tooltip_action_button → complete (triggers completeTutorial)
    const triggered = machine.advance();
    expect(machine.currentStep).toBe('complete');
    expect(triggered).toBe(true);
    expect(machine.isActive).toBe(false);

    // Call completeTutorial on the store
    await useOnboardingStore.getState().completeTutorial();

    // Verify store state
    const storeState = useOnboardingStore.getState();
    expect(storeState.tutorialComplete).toBe(true);
    expect(storeState.isChecklistVisible).toBe(true);
  });
});
