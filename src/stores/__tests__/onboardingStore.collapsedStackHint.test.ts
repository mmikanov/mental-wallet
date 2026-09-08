/**
 * Tests for the collapsed-stack first-time hint "seen" flag (Bug 4b).
 *
 * Validates: Requirement 6.2 — the hint appears at most once; its "seen" state is
 * persisted and survives restarts; old persisted rows (without the field) default false.
 */

import { useOnboardingStore } from '../onboardingStore';

jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

function makeMockDb(storedJson: string | null) {
  return {
    getFirstAsync: jest.fn(async (_sql: string, params: unknown[]) => {
      const key = (params as string[])[0];
      if (key === 'onboarding_state' && storedJson !== null) {
        return { value: storedJson };
      }
      return null;
    }),
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    execAsync: jest.fn().mockResolvedValue(undefined),
  };
}

describe('Bug 4b: collapsedStackHintSeen persisted flag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOnboardingStore.setState({
      disclaimerAcknowledged: false,
      onboardingScreensComplete: false,
      selectedIntent: null,
      kpiSelectionComplete: false,
      tutorialComplete: false,
      checklist: { openTool: false, tryExercise: false, addTool: false },
      checklistSessionCount: 0,
      bannerDismissed: false,
      collapsedStackHintSeen: false,
      isChecklistVisible: false,
      isChecklistComplete: false,
    });
  });

  it('defaults to false', () => {
    expect(useOnboardingStore.getState().collapsedStackHintSeen).toBe(false);
  });

  it('markCollapsedStackHintSeen() sets the flag and persists it', async () => {
    const mockDb = makeMockDb(null);
    mockGetDatabase.mockResolvedValue(mockDb as any);

    await useOnboardingStore.getState().markCollapsedStackHintSeen();

    expect(useOnboardingStore.getState().collapsedStackHintSeen).toBe(true);

    // Persisted to the settings JSON blob
    const writeCall = mockDb.runAsync.mock.calls.find(
      (c: unknown[]) => Array.isArray(c[1]) && (c[1] as unknown[])[0] === 'onboarding_state'
    );
    expect(writeCall).toBeDefined();
    const persisted = JSON.parse((writeCall![1] as string[])[1]);
    expect(persisted.collapsedStackHintSeen).toBe(true);
  });

  it('loadState rehydrates a persisted true value (survives restart)', async () => {
    const storedJson = JSON.stringify({
      disclaimerAcknowledged: true,
      onboardingScreensComplete: true,
      selectedIntent: null,
      kpiSelectionComplete: true,
      tutorialComplete: true,
      checklist: { openTool: true, tryExercise: true, addTool: true },
      checklistSessionCount: 3,
      bannerDismissed: true,
      collapsedStackHintSeen: true,
    });
    mockGetDatabase.mockResolvedValue(makeMockDb(storedJson) as any);

    await useOnboardingStore.getState().loadState();

    expect(useOnboardingStore.getState().collapsedStackHintSeen).toBe(true);
  });

  it('defaults to false when loading an old persisted row without the field', async () => {
    const legacyJson = JSON.stringify({
      disclaimerAcknowledged: true,
      onboardingScreensComplete: true,
      selectedIntent: null,
      kpiSelectionComplete: true,
      tutorialComplete: true,
      checklist: { openTool: false, tryExercise: false, addTool: false },
      checklistSessionCount: 0,
      bannerDismissed: false,
      // collapsedStackHintSeen intentionally omitted (pre-existing user)
    });
    mockGetDatabase.mockResolvedValue(makeMockDb(legacyJson) as any);

    await useOnboardingStore.getState().loadState();

    expect(useOnboardingStore.getState().collapsedStackHintSeen).toBe(false);
  });
});
