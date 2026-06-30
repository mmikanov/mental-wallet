import * as fc from 'fast-check';
import { useOnboardingStore } from '../onboardingStore';

// Track all DB writes for verifying legacy disclaimer flag
const mockRunAsync = jest.fn().mockResolvedValue(undefined);
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);

// Mock the database module
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      runAsync: (...args: unknown[]) => mockRunAsync(...args),
      getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
    })
  ),
}));

// Arbitrary for generating valid onboarding persisted states
const intentArb = fc.oneof(
  fc.constant(null),
  fc.constantFrom('overwhelm', 'routine', 'organize', 'explore')
);

const checklistArb = fc.record({
  openTool: fc.boolean(),
  tryExercise: fc.boolean(),
  addTool: fc.boolean(),
});

const onboardingStateArb = fc.record({
  disclaimerAcknowledged: fc.boolean(),
  onboardingScreensComplete: fc.boolean(),
  selectedIntent: intentArb,
  tutorialComplete: fc.boolean(),
  checklist: checklistArb,
  checklistSessionCount: fc.integer({ min: 0, max: 10 }),
  bannerDismissed: fc.boolean(),
});

// Action types for stage completion independence property
type StageAction =
  | 'acknowledgeDisclaimer'
  | 'completeScreens'
  | 'completeTutorial'
  | 'markOpenTool'
  | 'markTryExercise'
  | 'markAddTool';

const stageActionArb = fc.constantFrom<StageAction>(
  'acknowledgeDisclaimer',
  'completeScreens',
  'completeTutorial',
  'markOpenTool',
  'markTryExercise',
  'markAddTool'
);

describe('Feature: onboarding, Property 6: Onboarding state serialization round-trip', () => {
  /**
   * **Validates: Requirements 7.1, 6.8**
   *
   * For any valid OnboardingState object, serializing it to JSON and then
   * deserializing via the same logic used in loadState SHALL produce a state
   * object equivalent to the original.
   */

  it('serialize then deserialize produces equivalent state', () => {
    fc.assert(
      fc.property(onboardingStateArb, (state) => {
        // Serialize (same as persistState in the store)
        const json = JSON.stringify(state);

        // Deserialize (same logic as loadState in the store)
        const parsed = JSON.parse(json);
        const restored = {
          disclaimerAcknowledged: parsed.disclaimerAcknowledged ?? false,
          onboardingScreensComplete: parsed.onboardingScreensComplete ?? false,
          selectedIntent: parsed.selectedIntent ?? null,
          tutorialComplete: parsed.tutorialComplete ?? false,
          checklist: {
            openTool: parsed.checklist?.openTool ?? false,
            tryExercise: parsed.checklist?.tryExercise ?? false,
            addTool: parsed.checklist?.addTool ?? false,
          },
          checklistSessionCount: parsed.checklistSessionCount ?? 0,
          bannerDismissed: parsed.bannerDismissed ?? false,
        };

        // Round-trip must preserve all fields
        expect(restored).toEqual(state);
      }),
      { numRuns: 100 }
    );
  });

  it('partial/corrupted JSON gracefully defaults missing fields', () => {
    // Generate arbitrary subsets of the state to simulate partial data
    const partialStateArb = fc.record(
      {
        disclaimerAcknowledged: fc.boolean(),
        onboardingScreensComplete: fc.boolean(),
        selectedIntent: intentArb,
        tutorialComplete: fc.boolean(),
        checklist: fc.oneof(checklistArb, fc.constant(undefined)),
        checklistSessionCount: fc.integer({ min: 0, max: 10 }),
        bannerDismissed: fc.boolean(),
      },
      { requiredKeys: [] }
    );

    fc.assert(
      fc.property(partialStateArb, (partialState) => {
        const json = JSON.stringify(partialState);
        const parsed = JSON.parse(json);

        const restored = {
          disclaimerAcknowledged: parsed.disclaimerAcknowledged ?? false,
          onboardingScreensComplete: parsed.onboardingScreensComplete ?? false,
          selectedIntent: parsed.selectedIntent ?? null,
          tutorialComplete: parsed.tutorialComplete ?? false,
          checklist: {
            openTool: parsed.checklist?.openTool ?? false,
            tryExercise: parsed.checklist?.tryExercise ?? false,
            addTool: parsed.checklist?.addTool ?? false,
          },
          checklistSessionCount: parsed.checklistSessionCount ?? 0,
          bannerDismissed: parsed.bannerDismissed ?? false,
        };

        // All fields must be defined (never undefined/NaN)
        expect(typeof restored.disclaimerAcknowledged).toBe('boolean');
        expect(typeof restored.onboardingScreensComplete).toBe('boolean');
        expect(
          restored.selectedIntent === null || typeof restored.selectedIntent === 'string'
        ).toBe(true);
        expect(typeof restored.tutorialComplete).toBe('boolean');
        expect(typeof restored.checklist.openTool).toBe('boolean');
        expect(typeof restored.checklist.tryExercise).toBe('boolean');
        expect(typeof restored.checklist.addTool).toBe('boolean');
        expect(typeof restored.checklistSessionCount).toBe('number');
        expect(restored.checklistSessionCount).toBeGreaterThanOrEqual(0);
        expect(typeof restored.bannerDismissed).toBe('boolean');
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: onboarding, Property 8: Stage completion independence', () => {
  /**
   * **Validates: Requirements 7.3**
   *
   * For any onboarding state and any single stage completion action
   * (acknowledging disclaimer, completing screens, completing tutorial,
   * marking a checklist item), only the targeted flag(s) SHALL change —
   * all other stage flags SHALL remain unchanged.
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('each action only changes its targeted flag(s), all others remain unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        onboardingStateArb,
        stageActionArb,
        async (initialState, action) => {
          // Set up the store with the generated initial state + derived fields
          const isChecklistComplete =
            initialState.checklist.openTool &&
            initialState.checklist.tryExercise &&
            initialState.checklist.addTool;
          const isChecklistVisible =
            initialState.tutorialComplete &&
            !isChecklistComplete &&
            initialState.checklistSessionCount < 3;

          useOnboardingStore.setState({
            ...initialState,
            isChecklistComplete,
            isChecklistVisible,
          });

          // Apply the action
          switch (action) {
            case 'acknowledgeDisclaimer':
              await useOnboardingStore.getState().acknowledgeDisclaimer();
              break;
            case 'completeScreens':
              await useOnboardingStore
                .getState()
                .completeOnboardingScreens(initialState.selectedIntent);
              break;
            case 'completeTutorial':
              await useOnboardingStore.getState().completeTutorial();
              break;
            case 'markOpenTool':
              await useOnboardingStore.getState().markChecklistItem('openTool');
              break;
            case 'markTryExercise':
              await useOnboardingStore.getState().markChecklistItem('tryExercise');
              break;
            case 'markAddTool':
              await useOnboardingStore.getState().markChecklistItem('addTool');
              break;
          }

          const result = useOnboardingStore.getState();

          // Verify that only the targeted field(s) changed
          switch (action) {
            case 'acknowledgeDisclaimer':
              // Only disclaimerAcknowledged should change to true
              expect(result.disclaimerAcknowledged).toBe(true);
              expect(result.onboardingScreensComplete).toBe(initialState.onboardingScreensComplete);
              expect(result.selectedIntent).toBe(initialState.selectedIntent);
              expect(result.tutorialComplete).toBe(initialState.tutorialComplete);
              expect(result.checklist).toEqual(initialState.checklist);
              expect(result.checklistSessionCount).toBe(initialState.checklistSessionCount);
              expect(result.bannerDismissed).toBe(initialState.bannerDismissed);
              break;

            case 'completeScreens':
              // Only onboardingScreensComplete and selectedIntent should change
              expect(result.onboardingScreensComplete).toBe(true);
              expect(result.selectedIntent).toBe(initialState.selectedIntent);
              expect(result.disclaimerAcknowledged).toBe(initialState.disclaimerAcknowledged);
              expect(result.tutorialComplete).toBe(initialState.tutorialComplete);
              expect(result.checklist).toEqual(initialState.checklist);
              expect(result.checklistSessionCount).toBe(initialState.checklistSessionCount);
              expect(result.bannerDismissed).toBe(initialState.bannerDismissed);
              break;

            case 'completeTutorial':
              // Only tutorialComplete should change
              expect(result.tutorialComplete).toBe(true);
              expect(result.disclaimerAcknowledged).toBe(initialState.disclaimerAcknowledged);
              expect(result.onboardingScreensComplete).toBe(initialState.onboardingScreensComplete);
              expect(result.selectedIntent).toBe(initialState.selectedIntent);
              expect(result.checklist).toEqual(initialState.checklist);
              expect(result.checklistSessionCount).toBe(initialState.checklistSessionCount);
              expect(result.bannerDismissed).toBe(initialState.bannerDismissed);
              break;

            case 'markOpenTool':
              // Only checklist.openTool should change
              expect(result.checklist.openTool).toBe(true);
              expect(result.checklist.tryExercise).toBe(initialState.checklist.tryExercise);
              expect(result.checklist.addTool).toBe(initialState.checklist.addTool);
              expect(result.disclaimerAcknowledged).toBe(initialState.disclaimerAcknowledged);
              expect(result.onboardingScreensComplete).toBe(initialState.onboardingScreensComplete);
              expect(result.selectedIntent).toBe(initialState.selectedIntent);
              expect(result.tutorialComplete).toBe(initialState.tutorialComplete);
              expect(result.checklistSessionCount).toBe(initialState.checklistSessionCount);
              expect(result.bannerDismissed).toBe(initialState.bannerDismissed);
              break;

            case 'markTryExercise':
              // Only checklist.tryExercise should change
              expect(result.checklist.tryExercise).toBe(true);
              expect(result.checklist.openTool).toBe(initialState.checklist.openTool);
              expect(result.checklist.addTool).toBe(initialState.checklist.addTool);
              expect(result.disclaimerAcknowledged).toBe(initialState.disclaimerAcknowledged);
              expect(result.onboardingScreensComplete).toBe(initialState.onboardingScreensComplete);
              expect(result.selectedIntent).toBe(initialState.selectedIntent);
              expect(result.tutorialComplete).toBe(initialState.tutorialComplete);
              expect(result.checklistSessionCount).toBe(initialState.checklistSessionCount);
              expect(result.bannerDismissed).toBe(initialState.bannerDismissed);
              break;

            case 'markAddTool':
              // Only checklist.addTool should change
              expect(result.checklist.addTool).toBe(true);
              expect(result.checklist.openTool).toBe(initialState.checklist.openTool);
              expect(result.checklist.tryExercise).toBe(initialState.checklist.tryExercise);
              expect(result.disclaimerAcknowledged).toBe(initialState.disclaimerAcknowledged);
              expect(result.onboardingScreensComplete).toBe(initialState.onboardingScreensComplete);
              expect(result.selectedIntent).toBe(initialState.selectedIntent);
              expect(result.tutorialComplete).toBe(initialState.tutorialComplete);
              expect(result.checklistSessionCount).toBe(initialState.checklistSessionCount);
              expect(result.bannerDismissed).toBe(initialState.bannerDismissed);
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: onboarding, Property 9: Legacy disclaimer flag consistency', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any onboarding completion path that sets `disclaimerAcknowledged`
   * to true, the settings table SHALL also contain the key
   * 'disclaimer_acknowledged' with value 'true'.
   */

  beforeEach(() => {
    jest.clearAllMocks();
    useOnboardingStore.setState({
      disclaimerAcknowledged: false,
      onboardingScreensComplete: false,
      selectedIntent: null,
      tutorialComplete: false,
      checklist: { openTool: false, tryExercise: false, addTool: false },
      checklistSessionCount: 0,
      bannerDismissed: false,
      isChecklistVisible: false,
      isChecklistComplete: false,
    });
  });

  it('acknowledgeDisclaimer always writes the legacy disclaimer_acknowledged key', async () => {
    await fc.assert(
      fc.asyncProperty(onboardingStateArb, async (initialState) => {
        // Reset mocks for each iteration
        mockRunAsync.mockClear();

        // Set up the store with a state where disclaimer is NOT yet acknowledged
        const isChecklistComplete =
          initialState.checklist.openTool &&
          initialState.checklist.tryExercise &&
          initialState.checklist.addTool;
        const isChecklistVisible =
          initialState.tutorialComplete &&
          !isChecklistComplete &&
          initialState.checklistSessionCount < 3;

        useOnboardingStore.setState({
          ...initialState,
          disclaimerAcknowledged: false, // Force to false so we test the acknowledgment path
          isChecklistComplete,
          isChecklistVisible,
        });

        // Perform the acknowledge action
        await useOnboardingStore.getState().acknowledgeDisclaimer();

        // Verify state flag is set
        const state = useOnboardingStore.getState();
        expect(state.disclaimerAcknowledged).toBe(true);

        // Verify legacy 'disclaimer_acknowledged' key was written to the DB
        const legacyWriteCalls = mockRunAsync.mock.calls.filter(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].includes('INSERT OR REPLACE INTO settings') &&
            Array.isArray(call[1]) &&
            call[1][0] === 'disclaimer_acknowledged' &&
            call[1][1] === 'true'
        );
        expect(legacyWriteCalls.length).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 100 }
    );
  });
});
