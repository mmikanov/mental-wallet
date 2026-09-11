/**
 * Tests for the explicit consent acknowledgment + accepted consent version (1.0.4).
 *
 * Validates:
 *  - acknowledgeDisclaimer(version) sets disclaimerAcknowledged=true and records the version;
 *  - the accepted version persists to the settings JSON blob and rehydrates on load;
 *  - old persisted rows (without the field) default to null (no forced re-consent);
 *  - the consent invariant across resets: with no stored onboarding state (e.g. after a
 *    settings wipe), disclaimerAcknowledged is false, so the gate re-engages.
 *
 * Spec: .kiro/specs/1.0.4-onboarding-consent (Req 3.3, 4.1, 4.2, 5.3)
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
      // No legacy disclaimer flag either
      return null;
    }),
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    execAsync: jest.fn().mockResolvedValue(undefined),
  };
}

function resetStore() {
  useOnboardingStore.setState({
    disclaimerAcknowledged: false,
    acknowledgedConsentVersion: null,
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
}

describe('Onboarding consent: acknowledged version', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('defaults: not acknowledged, no version', () => {
    const s = useOnboardingStore.getState();
    expect(s.disclaimerAcknowledged).toBe(false);
    expect(s.acknowledgedConsentVersion).toBeNull();
  });

  it('acknowledgeDisclaimer(version) sets the flag + records the version and persists both', async () => {
    const mockDb = makeMockDb(null);
    mockGetDatabase.mockResolvedValue(mockDb as any);

    await useOnboardingStore.getState().acknowledgeDisclaimer('2026-09-11');

    const s = useOnboardingStore.getState();
    expect(s.disclaimerAcknowledged).toBe(true);
    expect(s.acknowledgedConsentVersion).toBe('2026-09-11');

    const writeCall = mockDb.runAsync.mock.calls.find(
      (c: unknown[]) => Array.isArray(c[1]) && (c[1] as unknown[])[0] === 'onboarding_state'
    );
    expect(writeCall).toBeDefined();
    const persisted = JSON.parse((writeCall![1] as string[])[1]);
    expect(persisted.disclaimerAcknowledged).toBe(true);
    expect(persisted.acknowledgedConsentVersion).toBe('2026-09-11');
  });

  it('loadState rehydrates a persisted accepted version', async () => {
    const storedJson = JSON.stringify({
      disclaimerAcknowledged: true,
      acknowledgedConsentVersion: '2026-09-11',
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

    expect(useOnboardingStore.getState().acknowledgedConsentVersion).toBe('2026-09-11');
  });

  it('old persisted row without the field loads acknowledgedConsentVersion as null (no forced re-consent)', async () => {
    const legacyJson = JSON.stringify({
      disclaimerAcknowledged: true,
      // acknowledgedConsentVersion intentionally omitted (pre-1.0.4 user)
      onboardingScreensComplete: true,
      selectedIntent: null,
      kpiSelectionComplete: true,
      tutorialComplete: true,
      checklist: { openTool: false, tryExercise: false, addTool: false },
      checklistSessionCount: 0,
      bannerDismissed: false,
    });
    mockGetDatabase.mockResolvedValue(makeMockDb(legacyJson) as any);

    await useOnboardingStore.getState().loadState();

    const s = useOnboardingStore.getState();
    // Still considered acknowledged (they onboarded before), just with no version recorded.
    expect(s.disclaimerAcknowledged).toBe(true);
    expect(s.acknowledgedConsentVersion).toBeNull();
  });
});

describe('Onboarding consent: invariant across data resets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('with no stored onboarding state (e.g. after Delete All Data wiped settings), the gate re-engages', async () => {
    // Simulate an acknowledged session first.
    const mockDb = makeMockDb(null);
    mockGetDatabase.mockResolvedValue(mockDb as any);
    await useOnboardingStore.getState().acknowledgeDisclaimer('2026-09-11');
    expect(useOnboardingStore.getState().disclaimerAcknowledged).toBe(true);

    // Now settings are wiped: loadState finds neither the JSON blob nor the legacy flag.
    mockGetDatabase.mockResolvedValue(makeMockDb(null) as any);
    await useOnboardingStore.getState().loadState();

    const s = useOnboardingStore.getState();
    expect(s.disclaimerAcknowledged).toBe(false);
    expect(s.acknowledgedConsentVersion).toBeNull();
  });
});
