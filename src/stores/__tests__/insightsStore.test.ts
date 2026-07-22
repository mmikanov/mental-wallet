/**
 * Unit tests for InsightsStore.
 * Tests loadWalletInsights at each tier, time period switching,
 * dismiss/keep tool flows, KPI label change preference persistence,
 * and tier hint state.
 *
 * Validates: Requirements 3.4, 3.6, 5.9, 13.5
 */

const mockRunAsync = jest.fn().mockResolvedValue(undefined);
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);

jest.mock('@/data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => mockRunAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
  }),
}));

jest.mock('@/utils/engagementMessaging', () => ({
  getEngagementData: jest.fn().mockResolvedValue({
    currentWeekCount: 5,
    previousWeekCount: 3,
    rollingAverage: 4,
  }),
}));

import { useInsightsStore, setInsightsServices } from '../insightsStore';
import type { TierEvaluator, TierProgress, InsightTier } from '@/services/tierEvaluator';
import type {
  CorrelationEngine,
  BestToolEntry,
  KpiLabelChange,
  ToolCorrelationResult,
  WalletCorrelationResult,
} from '@/services/correlationEngine';
import { getEngagementData } from '@/utils/engagementMessaging';

// --- Mock Factories ---

function createMockTierEvaluator(
  overrides: Partial<TierEvaluator> = {}
): TierEvaluator {
  return {
    evaluate: jest.fn().mockResolvedValue({
      currentTier: 'below_nascent',
      checkInCount: 0,
      toolUseCount: 0,
      distinctToolCount: 0,
      nextTier: 'nascent',
      checkInsNeeded: 3,
      toolUsesNeeded: 3,
      distinctToolsNeeded: 1,
    } as TierProgress),
    cardQualifiesForCorrelation: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function createMockCorrelationEngine(
  overrides: Partial<CorrelationEngine> = {}
): CorrelationEngine {
  return {
    computeSingleToolCorrelation: jest.fn().mockResolvedValue(null),
    computeToolCorrelations: jest.fn().mockResolvedValue([]),
    computeWalletCorrelation: jest.fn().mockResolvedValue({
      weeklyAvgScore: [5, 6, 7],
      weeklyTotalDurationMin: [10, 15, 20],
      overallTrend: 'positive',
      summaryText: 'Weeks where you practiced more tended to have higher check-in scores',
    } as WalletCorrelationResult),
    getBestTools: jest.fn().mockResolvedValue([]),
    getToolsToReconsider: jest.fn().mockResolvedValue([]),
    detectKpiLabelChange: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeTierProgress(tier: InsightTier): TierProgress {
  return {
    currentTier: tier,
    checkInCount: tier === 'confident' ? 20 : tier === 'preliminary' ? 10 : tier === 'nascent' ? 4 : 1,
    toolUseCount: tier === 'confident' ? 15 : tier === 'preliminary' ? 7 : tier === 'nascent' ? 4 : 1,
    distinctToolCount: tier === 'confident' ? 3 : tier === 'preliminary' ? 3 : tier === 'nascent' ? 2 : 1,
    nextTier: tier === 'confident' ? null : tier === 'preliminary' ? 'confident' : tier === 'nascent' ? 'preliminary' : 'nascent',
    checkInsNeeded: 0,
    toolUsesNeeded: 0,
    distinctToolsNeeded: 0,
  };
}

// --- Helpers ---

function resetStore() {
  useInsightsStore.setState({
    tierProgress: null,
    isLoading: false,
    timePeriod: '7d',
    walletCorrelation: null,
    bestTools: [],
    toolsToReconsider: [],
    kpiLabelChange: null,
    includePreChangeData: true,
    dismissedToolIds: [],
    tierHintsDismissed: {
      below_nascent: true,
      nascent: false,
      preliminary: false,
      confident: false,
    },
    privacyNoteShown: false,
  });
}

describe('InsightsStore', () => {
  let mockEvaluator: TierEvaluator;
  let mockEngine: CorrelationEngine;

  beforeEach(() => {
    mockEvaluator = createMockTierEvaluator();
    mockEngine = createMockCorrelationEngine();
    setInsightsServices(mockEvaluator, mockEngine);
    resetStore();
    mockRunAsync.mockClear();
    mockGetFirstAsync.mockClear();
    (getEngagementData as jest.Mock).mockClear();
  });

  describe('loadWalletInsights — below_nascent tier', () => {
    it('should evaluate tier and set tierProgress', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('below_nascent'));

      await useInsightsStore.getState().loadWalletInsights();

      const state = useInsightsStore.getState();
      expect(state.tierProgress?.currentTier).toBe('below_nascent');
      expect(state.isLoading).toBe(false);
    });

    it('should call getEngagementData', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('below_nascent'));

      await useInsightsStore.getState().loadWalletInsights();

      expect(getEngagementData).toHaveBeenCalled();
    });

    it('should NOT compute correlations at below_nascent tier', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('below_nascent'));

      await useInsightsStore.getState().loadWalletInsights();

      expect(mockEngine.getBestTools).not.toHaveBeenCalled();
      expect(mockEngine.detectKpiLabelChange).not.toHaveBeenCalled();
      expect(mockEngine.computeWalletCorrelation).not.toHaveBeenCalled();
      expect(mockEngine.getToolsToReconsider).not.toHaveBeenCalled();
    });

    it('should leave correlation state as empty/null', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('below_nascent'));

      await useInsightsStore.getState().loadWalletInsights();

      const state = useInsightsStore.getState();
      expect(state.bestTools).toEqual([]);
      expect(state.toolsToReconsider).toEqual([]);
      expect(state.walletCorrelation).toBeNull();
      expect(state.kpiLabelChange).toBeNull();
    });
  });

  describe('loadWalletInsights — nascent tier', () => {
    it('should set tier to nascent and NOT compute correlations', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('nascent'));

      await useInsightsStore.getState().loadWalletInsights();

      const state = useInsightsStore.getState();
      expect(state.tierProgress?.currentTier).toBe('nascent');
      expect(mockEngine.getBestTools).not.toHaveBeenCalled();
      expect(mockEngine.detectKpiLabelChange).not.toHaveBeenCalled();
      expect(mockEngine.computeWalletCorrelation).not.toHaveBeenCalled();
      expect(mockEngine.getToolsToReconsider).not.toHaveBeenCalled();
    });
  });

  describe('loadWalletInsights — preliminary tier', () => {
    it('should call getBestTools and detectKpiLabelChange', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('preliminary'));
      const bestTools: BestToolEntry[] = [
        { cardId: 'c1', cardTitle: 'Breathing', scoreDelta: 0.8, avgDurationSec: 120, descriptorLabel: 'Linked to +0.8', isHedged: true },
      ];
      (mockEngine.getBestTools as jest.Mock).mockResolvedValue(bestTools);
      (mockEngine.detectKpiLabelChange as jest.Mock).mockResolvedValue(null);

      await useInsightsStore.getState().loadWalletInsights();

      expect(mockEngine.getBestTools).toHaveBeenCalledWith('preliminary', '7d');
      expect(mockEngine.detectKpiLabelChange).toHaveBeenCalledWith('7d');
      expect(mockEngine.computeToolCorrelations).toHaveBeenCalledWith('7d');

      const state = useInsightsStore.getState();
      expect(state.bestTools).toEqual(bestTools);
      expect(state.kpiLabelChange).toBeNull();
    });

    it('should NOT call wallet-level correlation or toolsToReconsider', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('preliminary'));

      await useInsightsStore.getState().loadWalletInsights();

      expect(mockEngine.computeWalletCorrelation).not.toHaveBeenCalled();
      expect(mockEngine.getToolsToReconsider).not.toHaveBeenCalled();
    });

    it('should set kpiLabelChange when detected', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('preliminary'));
      const labelChange: KpiLabelChange = {
        previousLabel: 'Sleeping better',
        newLabel: 'Feeling calmer',
        changedAt: '2024-05-15T00:00:00.000Z',
      };
      (mockEngine.detectKpiLabelChange as jest.Mock).mockResolvedValue(labelChange);

      await useInsightsStore.getState().loadWalletInsights();

      expect(useInsightsStore.getState().kpiLabelChange).toEqual(labelChange);
    });
  });

  describe('loadWalletInsights — confident tier', () => {
    it('should call all correlation methods including walletCorrelation and toolsToReconsider', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('confident'));
      const walletResult: WalletCorrelationResult = {
        weeklyAvgScore: [5, 6, 7, 8],
        weeklyTotalDurationMin: [10, 15, 25, 30],
        overallTrend: 'positive',
        summaryText: 'You are improving',
      };
      const toolsToReconsider: ToolCorrelationResult[] = [
        {
          cardId: 'c5',
          cardTitle: 'Journaling',
          scoreDelta: -0.2,
          correlationDirection: 'neutral',
          sampleSizeToolDays: 10,
          sampleSizeOtherDays: 20,
          avgDurationSec: 180,
          outcomeEffectivenessScore: 0.1,
          effectivenessPattern: 'not_helping',
        },
      ];
      (mockEngine.computeWalletCorrelation as jest.Mock).mockResolvedValue(walletResult);
      (mockEngine.getToolsToReconsider as jest.Mock).mockResolvedValue(toolsToReconsider);

      await useInsightsStore.getState().loadWalletInsights();

      expect(mockEngine.getBestTools).toHaveBeenCalledWith('confident', '7d');
      expect(mockEngine.detectKpiLabelChange).toHaveBeenCalledWith('7d');
      expect(mockEngine.computeToolCorrelations).toHaveBeenCalledWith('7d');
      expect(mockEngine.computeWalletCorrelation).toHaveBeenCalledWith('7d', 'daily');
      expect(mockEngine.getToolsToReconsider).toHaveBeenCalledWith('7d', []);

      const state = useInsightsStore.getState();
      expect(state.walletCorrelation).toEqual(walletResult);
      expect(state.toolsToReconsider).toEqual(toolsToReconsider);
    });
  });

  describe('setTimePeriod', () => {
    it('should update timePeriod and trigger reload', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('confident'));

      useInsightsStore.getState().setTimePeriod('30d');

      // Allow async loadWalletInsights to settle
      await new Promise((r) => setTimeout(r, 0));

      expect(useInsightsStore.getState().timePeriod).toBe('30d');
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
      // The reload should use the updated time period
      expect(mockEngine.getBestTools).toHaveBeenCalledWith('confident', '30d');
    });
  });

  describe('dismissTool', () => {
    it('should add cardId to dismissedToolIds and remove from toolsToReconsider', async () => {
      useInsightsStore.setState({
        dismissedToolIds: [],
        toolsToReconsider: [
          {
            cardId: 'tool-1',
            cardTitle: 'Tool 1',
            scoreDelta: -0.1,
            correlationDirection: 'neutral',
            sampleSizeToolDays: 8,
            sampleSizeOtherDays: 15,
            avgDurationSec: 60,
            outcomeEffectivenessScore: 0.1,
            effectivenessPattern: 'not_helping',
          },
          {
            cardId: 'tool-2',
            cardTitle: 'Tool 2',
            scoreDelta: 0.0,
            correlationDirection: 'neutral',
            sampleSizeToolDays: 10,
            sampleSizeOtherDays: 12,
            avgDurationSec: 90,
            outcomeEffectivenessScore: 0.2,
            effectivenessPattern: 'not_helping',
          },
        ],
      });

      await useInsightsStore.getState().dismissTool('tool-1');

      const state = useInsightsStore.getState();
      expect(state.dismissedToolIds).toContain('tool-1');
      expect(state.toolsToReconsider.map((t) => t.cardId)).not.toContain('tool-1');
      expect(state.toolsToReconsider).toHaveLength(1);
      expect(state.toolsToReconsider[0].cardId).toBe('tool-2');
    });

    it('should persist dismissed tools to settings', async () => {
      await useInsightsStore.getState().dismissTool('tool-x');

      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['insights_dismissed_tools', JSON.stringify(['tool-x'])]
      );
    });
  });

  describe('dismissTierHint', () => {
    it('should set tierHintsDismissed for the given tier to true', async () => {
      expect(useInsightsStore.getState().tierHintsDismissed.nascent).toBe(false);

      await useInsightsStore.getState().dismissTierHint('nascent');

      expect(useInsightsStore.getState().tierHintsDismissed.nascent).toBe(true);
    });

    it('should persist tier hint state to settings', async () => {
      await useInsightsStore.getState().dismissTierHint('preliminary');

      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['insights_tier_hint_preliminary', 'true']
      );
    });

    it('should not affect other tier hints', async () => {
      await useInsightsStore.getState().dismissTierHint('nascent');

      const state = useInsightsStore.getState();
      expect(state.tierHintsDismissed.nascent).toBe(true);
      expect(state.tierHintsDismissed.preliminary).toBe(false);
      expect(state.tierHintsDismissed.confident).toBe(false);
    });
  });

  describe('markPrivacyNoteShown', () => {
    it('should set privacyNoteShown to true', async () => {
      expect(useInsightsStore.getState().privacyNoteShown).toBe(false);

      await useInsightsStore.getState().markPrivacyNoteShown();

      expect(useInsightsStore.getState().privacyNoteShown).toBe(true);
    });

    it('should persist privacy note shown state to settings', async () => {
      await useInsightsStore.getState().markPrivacyNoteShown();

      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['insights_privacy_note_shown', 'true']
      );
    });
  });

  describe('setIncludePreChangeData', () => {
    it('should persist setting to database', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('below_nascent'));
      // After write, settings read should return the new value
      mockGetFirstAsync.mockImplementation((_sql: string, params?: unknown[]) => {
        if (Array.isArray(params) && params[0] === 'insights_include_pre_change_data') {
          return Promise.resolve({ value: 'false' });
        }
        return Promise.resolve(null);
      });

      await useInsightsStore.getState().setIncludePreChangeData(false);

      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['insights_include_pre_change_data', 'false']
      );
      // After reload, the persisted setting is re-read and state reflects it
      expect(useInsightsStore.getState().includePreChangeData).toBe(false);
    });

    it('should trigger a reload of insights', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('nascent'));

      await useInsightsStore.getState().setIncludePreChangeData(false);

      // loadWalletInsights is called as part of setIncludePreChangeData
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should set isLoading=false when loadWalletInsights throws', async () => {
      (mockEvaluator.evaluate as jest.Mock).mockRejectedValue(new Error('DB error'));

      await useInsightsStore.getState().loadWalletInsights();

      const state = useInsightsStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should not crash if settings read returns null', async () => {
      mockGetFirstAsync.mockResolvedValue(null);
      (mockEvaluator.evaluate as jest.Mock).mockResolvedValue(makeTierProgress('nascent'));

      // Should not throw
      await useInsightsStore.getState().loadWalletInsights();

      const state = useInsightsStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.tierProgress?.currentTier).toBe('nascent');
    });
  });
});
