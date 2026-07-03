import * as fc from 'fast-check';
import { useOnboardingStore } from '../onboardingStore';

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

// Arbitraries for generating various onboarding state fields that should NOT
// interfere with legacy detection logic
const intentArb = fc.oneof(
  fc.constant(null),
  fc.constantFrom('overwhelm', 'routine', 'organize', 'explore')
);

const checklistArb = fc.record({
  openTool: fc.boolean(),
  tryExercise: fc.boolean(),
  addTool: fc.boolean(),
});

describe('Feature: personal-kpi, Property 10: Legacy user detection and migration', () => {
  /**
   * **Validates: Requirements 8.4**
   *
   * For any combination of settings state where disclaimer_acknowledged is "true"
   * AND either no onboarding_state JSON exists OR the JSON has onboardingScreensComplete: true
   * without a kpiSelectionComplete field, the system SHALL classify the user as legacy,
   * set kpiSelectionComplete to true.
   */

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store to default state before each test
    useOnboardingStore.setState({
      disclaimerAcknowledged: false,
      onboardingScreensComplete: false,
      selectedIntent: null,
      kpiSelectionComplete: false,
      tutorialComplete: false,
      checklist: { openTool: false, tryExercise: false, addTool: false },
      checklistSessionCount: 0,
      bannerDismissed: false,
      isChecklistVisible: false,
      isChecklistComplete: false,
    });
  });

  it('when onboarding_state JSON has onboardingScreensComplete=true but no kpiSelectionComplete field, loadState sets kpiSelectionComplete=true', async () => {
    // Generate random values for other fields that should not interfere with detection
    await fc.assert(
      fc.asyncProperty(
        intentArb,
        fc.boolean(), // tutorialComplete
        checklistArb,
        fc.integer({ min: 0, max: 10 }), // checklistSessionCount
        fc.boolean(), // bannerDismissed
        fc.boolean(), // disclaimerAcknowledged
        async (
          selectedIntent,
          tutorialComplete,
          checklist,
          checklistSessionCount,
          bannerDismissed,
          disclaimerAcknowledged
        ) => {
          // Build a stored JSON object where onboardingScreensComplete=true
          // but kpiSelectionComplete is NOT present (simulating legacy state)
          const storedState: Record<string, unknown> = {
            disclaimerAcknowledged,
            onboardingScreensComplete: true,
            selectedIntent,
            tutorialComplete,
            checklist,
            checklistSessionCount,
            bannerDismissed,
            // NOTE: kpiSelectionComplete is intentionally omitted
          };

          const storedJson = JSON.stringify(storedState);

          const mockDb = {
            getFirstAsync: jest.fn(async (_sql: string, params: unknown[]) => {
              const key = (params as string[])[0];
              if (key === 'onboarding_state') {
                return { value: storedJson };
              }
              return null;
            }),
            runAsync: jest.fn().mockResolvedValue(undefined),
            getAllAsync: jest.fn().mockResolvedValue([]),
            execAsync: jest.fn().mockResolvedValue(undefined),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          await useOnboardingStore.getState().loadState();

          const state = useOnboardingStore.getState();

          // Legacy detection must set kpiSelectionComplete to true
          expect(state.kpiSelectionComplete).toBe(true);
          // onboardingScreensComplete should remain true
          expect(state.onboardingScreensComplete).toBe(true);
          // Other fields should be correctly loaded
          expect(state.selectedIntent).toBe(selectedIntent);
          expect(state.tutorialComplete).toBe(tutorialComplete);
          expect(state.checklist).toEqual(checklist);
          expect(state.checklistSessionCount).toBe(checklistSessionCount);
          expect(state.bannerDismissed).toBe(bannerDismissed);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when no onboarding_state JSON exists but disclaimer_acknowledged is "true", loadState sets both onboardingScreensComplete and kpiSelectionComplete to true', async () => {
    // Generate random values for other fields to verify they don't interfere
    await fc.assert(
      fc.asyncProperty(
        intentArb,
        fc.boolean(), // tutorialComplete
        checklistArb,
        fc.integer({ min: 0, max: 10 }), // checklistSessionCount
        fc.boolean(), // bannerDismissed
        async (
          _selectedIntent,
          _tutorialComplete,
          _checklist,
          _checklistSessionCount,
          _bannerDismissed
        ) => {
          // No onboarding_state row, but legacy disclaimer_acknowledged exists
          const mockDb = {
            getFirstAsync: jest.fn(async (_sql: string, params: unknown[]) => {
              const key = (params as string[])[0];
              if (key === 'onboarding_state') {
                return null; // No onboarding_state JSON
              }
              if (key === 'disclaimer_acknowledged') {
                return { value: 'true' };
              }
              return null;
            }),
            runAsync: jest.fn().mockResolvedValue(undefined),
            getAllAsync: jest.fn().mockResolvedValue([]),
            execAsync: jest.fn().mockResolvedValue(undefined),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          await useOnboardingStore.getState().loadState();

          const state = useOnboardingStore.getState();

          // Legacy user: both flags should be set to true
          expect(state.kpiSelectionComplete).toBe(true);
          expect(state.onboardingScreensComplete).toBe(true);
          expect(state.disclaimerAcknowledged).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when onboarding_state JSON has kpiSelectionComplete explicitly set, loadState respects the stored value', async () => {
    // This tests the non-legacy path: kpiSelectionComplete is present in stored JSON
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // kpiSelectionComplete (explicitly stored)
        intentArb,
        fc.boolean(), // tutorialComplete
        checklistArb,
        fc.integer({ min: 0, max: 10 }), // checklistSessionCount
        fc.boolean(), // bannerDismissed
        async (
          kpiSelectionComplete,
          selectedIntent,
          tutorialComplete,
          checklist,
          checklistSessionCount,
          bannerDismissed
        ) => {
          // Build a stored JSON with kpiSelectionComplete explicitly present
          const storedState = {
            disclaimerAcknowledged: true,
            onboardingScreensComplete: true,
            selectedIntent,
            kpiSelectionComplete, // Explicitly included
            tutorialComplete,
            checklist,
            checklistSessionCount,
            bannerDismissed,
          };

          const storedJson = JSON.stringify(storedState);

          const mockDb = {
            getFirstAsync: jest.fn(async (_sql: string, params: unknown[]) => {
              const key = (params as string[])[0];
              if (key === 'onboarding_state') {
                return { value: storedJson };
              }
              return null;
            }),
            runAsync: jest.fn().mockResolvedValue(undefined),
            getAllAsync: jest.fn().mockResolvedValue([]),
            execAsync: jest.fn().mockResolvedValue(undefined),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          await useOnboardingStore.getState().loadState();

          const state = useOnboardingStore.getState();

          // When kpiSelectionComplete is explicitly set in stored JSON,
          // it should respect the stored value (no legacy override)
          expect(state.kpiSelectionComplete).toBe(kpiSelectionComplete);
        }
      ),
      { numRuns: 100 }
    );
  });
});
