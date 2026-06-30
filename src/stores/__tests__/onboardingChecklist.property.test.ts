import * as fc from 'fast-check';
import { useOnboardingStore } from '../onboardingStore';

// Mock the database module
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(() => ({
    runAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  })),
}));

type ChecklistItemKey = 'openTool' | 'tryExercise' | 'addTool';

const checklistItemArb = fc.constantFrom<ChecklistItemKey>('openTool', 'tryExercise', 'addTool');
const checklistStateArb = fc.record({
  openTool: fc.boolean(),
  tryExercise: fc.boolean(),
  addTool: fc.boolean(),
});

const INITIAL_STATE = {
  disclaimerAcknowledged: true,
  onboardingScreensComplete: true,
  selectedIntent: null as string | null,
  tutorialComplete: true,
  checklist: {
    openTool: false,
    tryExercise: false,
    addTool: false,
  },
  checklistSessionCount: 0,
  bannerDismissed: false,
  isChecklistVisible: true,
  isChecklistComplete: false,
};

describe('Feature: onboarding, Property 5: Wallet events auto-mark corresponding checklist items', () => {
  /**
   * **Validates: Requirements 6.3, 6.4, 6.5**
   *
   * For any wallet interaction event — focusing a card marks `openTool`,
   * recording a completion marks `tryExercise`, adding a card marks `addTool` —
   * the corresponding checklist boolean SHALL transition from false to true
   * without affecting other checklist items.
   */

  beforeEach(() => {
    useOnboardingStore.setState(INITIAL_STATE);
    jest.clearAllMocks();
  });

  it('marking an item only changes the targeted item, all others remain unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        checklistStateArb,
        checklistItemArb,
        async (initialChecklist, item) => {
          // Set up store with the generated checklist state
          useOnboardingStore.setState({
            ...INITIAL_STATE,
            checklist: { ...initialChecklist },
          });

          // Capture state of other items before marking
          const otherItems = (['openTool', 'tryExercise', 'addTool'] as ChecklistItemKey[]).filter(
            (k) => k !== item
          );
          const othersBefore = otherItems.map((k) => initialChecklist[k]);

          // Mark the item (this mirrors the wallet event: focus → openTool, completion → tryExercise, add → addTool)
          await useOnboardingStore.getState().markChecklistItem(item);

          const state = useOnboardingStore.getState();

          // The targeted item should now be true
          expect(state.checklist[item]).toBe(true);

          // All other items should remain unchanged
          for (let i = 0; i < otherItems.length; i++) {
            expect(state.checklist[otherItems[i]]).toBe(othersBefore[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('marking an already-done item is idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(
        checklistStateArb,
        checklistItemArb,
        async (initialChecklist, item) => {
          // Start with the item already marked true
          const checklistWithItemDone = { ...initialChecklist, [item]: true };
          useOnboardingStore.setState({
            ...INITIAL_STATE,
            checklist: { ...checklistWithItemDone },
          });

          // Mark it again
          await useOnboardingStore.getState().markChecklistItem(item);

          const state = useOnboardingStore.getState();

          // State should be unchanged (idempotent)
          expect(state.checklist).toEqual(checklistWithItemDone);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('marking all items results in all done regardless of initial state', async () => {
    await fc.assert(
      fc.asyncProperty(checklistStateArb, async (initialChecklist) => {
        useOnboardingStore.setState({
          ...INITIAL_STATE,
          checklist: { ...initialChecklist },
        });

        // Simulate all three wallet events in sequence
        await useOnboardingStore.getState().markChecklistItem('openTool');
        await useOnboardingStore.getState().markChecklistItem('tryExercise');
        await useOnboardingStore.getState().markChecklistItem('addTool');

        const state = useOnboardingStore.getState();
        expect(state.checklist.openTool).toBe(true);
        expect(state.checklist.tryExercise).toBe(true);
        expect(state.checklist.addTool).toBe(true);
        expect(state.isChecklistComplete).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
