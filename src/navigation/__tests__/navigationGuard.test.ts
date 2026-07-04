/**
 * Unit tests for navigation guard logic.
 *
 * Tests the route resolution behavior that gates access to the wallet
 * based on onboarding completion flags, legacy user detection, and
 * the Skip_Intro path.
 *
 * Validates: Requirements 8.2, 8.4, 8.6
 */

import { useOnboardingStore } from '@/stores/onboardingStore';

// Mock the database module
const mockRunAsync = jest.fn().mockResolvedValue(undefined);
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);

jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      runAsync: (...args: unknown[]) => mockRunAsync(...args),
      getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
    })
  ),
}));

// Mock kpiService used by kpiStore
jest.mock('@/services/kpiService', () => ({
  createKpiService: jest.fn(() => ({
    getPersonalKpi: jest.fn().mockResolvedValue(null),
    setPersonalKpi: jest.fn().mockResolvedValue(undefined),
    changePersonalKpi: jest.fn().mockResolvedValue(undefined),
    seedKpiCard: jest.fn().mockResolvedValue(undefined),
    kpiCardExists: jest.fn().mockResolvedValue(false),
    updateKpiCardLabel: jest.fn().mockResolvedValue(undefined),
    recordKpi: jest.fn().mockResolvedValue(undefined),
    getRecords: jest.fn().mockResolvedValue([]),
    getChangeHistory: jest.fn().mockResolvedValue([]),
  })),
}));

/**
 * Pure function that mirrors the root route resolution logic in RootNavigator.
 *
 * From RootNavigator.tsx initializeApp():
 *   if (!disclaimerAcknowledged || !onboardingScreensComplete || !kpiSelectionComplete) {
 *     setInitialRoute('Onboarding');
 *   } else { ... MainTabs or ModeChoice ... }
 *
 * Validates: Requirement 8.2
 */
type RootRoute = 'Onboarding' | 'MainTabs';

function resolveRootRoute(
  disclaimerAcknowledged: boolean,
  onboardingScreensComplete: boolean,
  kpiSelectionComplete: boolean
): RootRoute {
  if (!disclaimerAcknowledged || !onboardingScreensComplete || !kpiSelectionComplete) {
    return 'Onboarding';
  }
  return 'MainTabs';
}

/**
 * Pure function mirroring the OnboardingNavigator's getInitialRoute() logic.
 *
 * From OnboardingNavigator.tsx:
 *   - onboardingScreensComplete && !kpiSelectionComplete → 'KpiSelection'
 *   - disclaimerAcknowledged && !onboardingScreensComplete → 'PrivacyNotice'
 *   - Otherwise → 'Welcome'
 */
type OnboardingRoute = 'Welcome' | 'PrivacyNotice' | 'IntentSelection' | 'KpiSelection';

function resolveOnboardingRoute(
  disclaimerAcknowledged: boolean,
  onboardingScreensComplete: boolean,
  kpiSelectionComplete: boolean
): OnboardingRoute {
  if (onboardingScreensComplete && !kpiSelectionComplete) {
    return 'KpiSelection';
  }
  if (disclaimerAcknowledged && !onboardingScreensComplete) {
    return 'PrivacyNotice';
  }
  return 'Welcome';
}

describe('Navigation guard: wallet requires both flags true (Req 8.2)', () => {
  it('should NOT show onboarding when both onboardingScreensComplete and kpiSelectionComplete are true', () => {
    const route = resolveRootRoute(true, true, true);
    expect(route).toBe('MainTabs');
  });

  it('should show onboarding when onboardingScreensComplete=true but kpiSelectionComplete=false', () => {
    const route = resolveRootRoute(true, true, false);
    expect(route).toBe('Onboarding');
  });

  it('should show onboarding when onboardingScreensComplete=false and kpiSelectionComplete=false', () => {
    const route = resolveRootRoute(true, false, false);
    expect(route).toBe('Onboarding');
  });

  it('should show onboarding when onboardingScreensComplete=false but kpiSelectionComplete=true', () => {
    const route = resolveRootRoute(true, false, true);
    expect(route).toBe('Onboarding');
  });

  it('should show onboarding when disclaimerAcknowledged=false regardless of other flags', () => {
    expect(resolveRootRoute(false, false, false)).toBe('Onboarding');
    expect(resolveRootRoute(false, true, true)).toBe('Onboarding');
    expect(resolveRootRoute(false, true, false)).toBe('Onboarding');
    expect(resolveRootRoute(false, false, true)).toBe('Onboarding');
  });

  it('within Onboarding, routes to KpiSelection when onboardingScreensComplete=true but kpiSelectionComplete=false', () => {
    const route = resolveOnboardingRoute(true, true, false);
    expect(route).toBe('KpiSelection');
  });

  it('within Onboarding, routes to PrivacyNotice when disclaimer acknowledged but screens not complete', () => {
    const route = resolveOnboardingRoute(true, false, false);
    expect(route).toBe('PrivacyNotice');
  });

  it('within Onboarding, routes to Welcome when nothing is done', () => {
    const route = resolveOnboardingRoute(false, false, false);
    expect(route).toBe('Welcome');
  });
});

describe('Navigation guard: legacy users bypass KPI selection (Req 8.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store to defaults
    useOnboardingStore.setState({
      disclaimerAcknowledged: false,
      onboardingScreensComplete: false,
      selectedIntent: null,
      kpiSelectionComplete: false,
      tutorialComplete: false,
      checklist: { openTool: false, tryExercise: false, addTool: false },
      checklistSessionCount: 0,
      bannerDismissed: false,
      isChecklistComplete: false,
      isChecklistVisible: false,
    });
  });

  it('legacy user with disclaimer_acknowledged=true and no onboarding_state gets kpiSelectionComplete=true', async () => {
    // Simulate: no onboarding_state row exists, but legacy disclaimer_acknowledged = 'true'
    mockGetFirstAsync
      .mockResolvedValueOnce(null) // First call: onboarding_state lookup returns null
      .mockResolvedValueOnce({ value: 'true' }); // Second call: disclaimer_acknowledged lookup

    await useOnboardingStore.getState().loadState();

    const state = useOnboardingStore.getState();
    expect(state.disclaimerAcknowledged).toBe(true);
    expect(state.onboardingScreensComplete).toBe(true);
    expect(state.kpiSelectionComplete).toBe(true);

    // With all flags true, the root route should be MainTabs (not onboarding)
    const route = resolveRootRoute(
      state.disclaimerAcknowledged,
      state.onboardingScreensComplete,
      state.kpiSelectionComplete
    );
    expect(route).toBe('MainTabs');
  });

  it('legacy user with onboarding_state that has onboardingScreensComplete=true but no kpiSelectionComplete field gets it auto-set', async () => {
    // Simulate: onboarding_state JSON exists with onboardingScreensComplete=true
    // but kpiSelectionComplete field is not present (legacy data)
    const legacyState = {
      disclaimerAcknowledged: true,
      onboardingScreensComplete: true,
      selectedIntent: 'overwhelm',
      tutorialComplete: true,
      checklist: { openTool: true, tryExercise: false, addTool: false },
      checklistSessionCount: 1,
      bannerDismissed: false,
      // kpiSelectionComplete is intentionally ABSENT
    };

    mockGetFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(legacyState) });

    await useOnboardingStore.getState().loadState();

    const state = useOnboardingStore.getState();
    expect(state.kpiSelectionComplete).toBe(true);
    expect(state.disclaimerAcknowledged).toBe(true);
    expect(state.onboardingScreensComplete).toBe(true);

    // Should resolve to MainTabs, NOT onboarding
    const route = resolveRootRoute(
      state.disclaimerAcknowledged,
      state.onboardingScreensComplete,
      state.kpiSelectionComplete
    );
    expect(route).toBe('MainTabs');
  });

  it('fresh user without any flags does NOT get kpiSelectionComplete auto-set', async () => {
    // Simulate: no onboarding_state, no legacy disclaimer
    mockGetFirstAsync
      .mockResolvedValueOnce(null) // No onboarding_state
      .mockResolvedValueOnce(null); // No legacy disclaimer_acknowledged

    await useOnboardingStore.getState().loadState();

    const state = useOnboardingStore.getState();
    expect(state.kpiSelectionComplete).toBe(false);
    expect(state.disclaimerAcknowledged).toBe(false);
    expect(state.onboardingScreensComplete).toBe(false);

    // Should remain in onboarding
    const route = resolveRootRoute(
      state.disclaimerAcknowledged,
      state.onboardingScreensComplete,
      state.kpiSelectionComplete
    );
    expect(route).toBe('Onboarding');
  });

  it('user with onboarding_state that explicitly has kpiSelectionComplete=false does NOT get it auto-set', async () => {
    // kpiSelectionComplete is explicitly set to false — not a legacy user
    const stateWithExplicitFalse = {
      disclaimerAcknowledged: true,
      onboardingScreensComplete: true,
      selectedIntent: null,
      kpiSelectionComplete: false, // Explicitly false
      tutorialComplete: false,
      checklist: { openTool: false, tryExercise: false, addTool: false },
      checklistSessionCount: 0,
      bannerDismissed: false,
    };

    mockGetFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(stateWithExplicitFalse) });

    await useOnboardingStore.getState().loadState();

    const state = useOnboardingStore.getState();
    // kpiSelectionComplete is explicitly false — the legacy detection should NOT override it
    // Per Req 8.4: only when kpiSelectionComplete field is UNDEFINED/missing from the JSON
    expect(state.kpiSelectionComplete).toBe(false);
  });
});

describe('Navigation guard: Skip_Intro path seeds KPI card with default (Req 8.6)', () => {
  let mockSetPersonalKpi: jest.Mock;
  let mockSeedKpiCard: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSetPersonalKpi = jest.fn().mockResolvedValue(undefined);
    mockSeedKpiCard = jest.fn().mockResolvedValue(undefined);

    // Reset kpiService mock with trackable functions
    const { createKpiService } = require('@/services/kpiService');
    (createKpiService as jest.Mock).mockReturnValue({
      getPersonalKpi: jest.fn().mockResolvedValue(null),
      setPersonalKpi: mockSetPersonalKpi,
      changePersonalKpi: jest.fn().mockResolvedValue(undefined),
      seedKpiCard: mockSeedKpiCard,
      kpiCardExists: jest.fn().mockResolvedValue(false),
      updateKpiCardLabel: jest.fn().mockResolvedValue(undefined),
      recordKpi: jest.fn().mockResolvedValue(undefined),
      getRecords: jest.fn().mockResolvedValue([]),
      getChangeHistory: jest.fn().mockResolvedValue([]),
    });

    // Reset stores
    useOnboardingStore.setState({
      disclaimerAcknowledged: false,
      onboardingScreensComplete: false,
      selectedIntent: null,
      kpiSelectionComplete: false,
      tutorialComplete: false,
      checklist: { openTool: false, tryExercise: false, addTool: false },
      checklistSessionCount: 0,
      bannerDismissed: false,
      isChecklistComplete: false,
      isChecklistVisible: false,
    });
  });

  it('Skip_Intro sets personalKpi to "Feeling good overall"', async () => {
    // Simulate the Skip_Intro path from WelcomeScreen.handleSkip:
    // 1. setKpi('Feeling good overall')
    // 2. seedKpiCard('Feeling good overall')
    // 3. completeOnboardingScreens(null)
    // 4. completeKpiSelection()

    const { useKpiStore } = require('@/stores/kpiStore');

    // Force kpiStore to use our mock service by resetting module state
    const { setKpiService } = require('@/stores/kpiStore');
    setKpiService({
      getPersonalKpi: jest.fn().mockResolvedValue(null),
      setPersonalKpi: mockSetPersonalKpi,
      changePersonalKpi: jest.fn().mockResolvedValue(undefined),
      seedKpiCard: mockSeedKpiCard,
      kpiCardExists: jest.fn().mockResolvedValue(false),
      updateKpiCardLabel: jest.fn().mockResolvedValue(undefined),
      recordKpi: jest.fn().mockResolvedValue(undefined),
      getRecords: jest.fn().mockResolvedValue([]),
      getChangeHistory: jest.fn().mockResolvedValue([]),
    });

    await useKpiStore.getState().setKpi('Feeling good overall');

    expect(mockSetPersonalKpi).toHaveBeenCalledWith('Feeling good overall');
    expect(useKpiStore.getState().personalKpi).toBe('Feeling good overall');
  });

  it('Skip_Intro calls seedKpiCard with "Feeling good overall"', async () => {
    const { createOnboardingService } = require('@/services/onboardingService');
    const onboardingService = createOnboardingService();

    await onboardingService.seedKpiCard('Feeling good overall');

    // The onboarding service delegates to kpiService.seedKpiCard
    expect(mockSeedKpiCard).toHaveBeenCalledWith('Feeling good overall');
  });

  it('Skip_Intro sets both onboardingScreensComplete and kpiSelectionComplete to true', async () => {
    // Simulate the full Skip_Intro path's effect on onboardingStore
    await useOnboardingStore.getState().completeOnboardingScreens(null);
    await useOnboardingStore.getState().completeKpiSelection();

    const state = useOnboardingStore.getState();
    expect(state.onboardingScreensComplete).toBe(true);
    expect(state.kpiSelectionComplete).toBe(true);

    // With both flags true (and disclaimer), route resolves to MainTabs
    const route = resolveRootRoute(
      state.disclaimerAcknowledged,
      state.onboardingScreensComplete,
      state.kpiSelectionComplete
    );
    // disclaimerAcknowledged is still false here since we didn't call acknowledgeDisclaimer
    // In the real flow, acknowledgeDisclaimer is called first
    expect(route).toBe('Onboarding'); // Still onboarding because disclaimer not ack'd

    // Now simulate full flow (disclaimer + both flags)
    await useOnboardingStore.getState().acknowledgeDisclaimer();
    const fullState = useOnboardingStore.getState();
    const fullRoute = resolveRootRoute(
      fullState.disclaimerAcknowledged,
      fullState.onboardingScreensComplete,
      fullState.kpiSelectionComplete
    );
    expect(fullRoute).toBe('MainTabs');
  });

  it('Skip_Intro full path results in navigation to wallet (all three flags true)', async () => {
    // Replicate WelcomeScreen.handleSkip sequence:
    await useOnboardingStore.getState().acknowledgeDisclaimer();
    await useOnboardingStore.getState().completeOnboardingScreens(null);
    await useOnboardingStore.getState().completeKpiSelection();

    const state = useOnboardingStore.getState();
    expect(state.disclaimerAcknowledged).toBe(true);
    expect(state.onboardingScreensComplete).toBe(true);
    expect(state.kpiSelectionComplete).toBe(true);

    // Root navigation should resolve away from Onboarding
    const route = resolveRootRoute(
      state.disclaimerAcknowledged,
      state.onboardingScreensComplete,
      state.kpiSelectionComplete
    );
    expect(route).toBe('MainTabs');
  });
});
