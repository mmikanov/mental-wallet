/**
 * InsightsStore — Zustand store managing computed insights state
 * for both per-tool and wallet-level insights screens.
 *
 * Responsibilities:
 * - Evaluates current tier and loads correlation data based on tier
 * - Manages time period selection and triggers recomputation
 * - Persists user preferences (dismissed tools, tier hints, privacy note)
 * - Loads persisted settings on initialization
 *
 * Validates: Requirements 3.4, 3.6, 3.7, 3.9, 5.1, 5.9, 7.2, 11.9, 11.10, 13.5
 */

import { create } from 'zustand';
import { getDatabase } from '@/data/database';
import {
  createTierEvaluator,
  type InsightTier,
  type TimePeriod,
  type TierProgress,
  type TierEvaluator,
} from '@/services/tierEvaluator';
import {
  createCorrelationEngine,
  type BestToolEntry,
  type CorrelationEngine,
  type KpiLabelChange,
  type ToolCorrelationResult,
  type WalletCorrelationResult,
} from '@/services/correlationEngine';
import { getEngagementData } from '@/utils/engagementMessaging';
import { computeDataAge } from '@/utils/dataAge';

// --- Settings Keys ---

const SETTINGS_KEY_INCLUDE_PRE_CHANGE_DATA = 'insights_include_pre_change_data';
const SETTINGS_KEY_PRIVACY_NOTE_SHOWN = 'insights_privacy_note_shown';
const SETTINGS_KEY_DISMISSED_TOOLS = 'insights_dismissed_tools';
const SETTINGS_KEY_TIER_HINT_PREFIX = 'insights_tier_hint_';

// --- Store Interface ---

export interface InsightsState {
  /** Current tier evaluation. */
  tierProgress: TierProgress | null;
  /** Loading state. */
  isLoading: boolean;
  /** Selected time period. */
  timePeriod: TimePeriod;
  /** Wallet-level correlation data. */
  walletCorrelation: WalletCorrelationResult | null;
  /** Best tools ranking. */
  bestTools: BestToolEntry[];
  /** Tools to reconsider. */
  toolsToReconsider: ToolCorrelationResult[];
  /** KPI label change notice. */
  kpiLabelChange: KpiLabelChange | null;
  /** User's choice for historical data inclusion. */
  includePreChangeData: boolean;
  /** Dismissed "keep" tool IDs for current period. */
  dismissedToolIds: string[];
  /** First-time hint states per tier. */
  tierHintsDismissed: Record<InsightTier, boolean>;
  /** Whether first-visit privacy note was shown. */
  privacyNoteShown: boolean;

  // Actions
  loadWalletInsights: () => Promise<void>;
  setTimePeriod: (period: TimePeriod) => void;
  setIncludePreChangeData: (include: boolean) => Promise<void>;
  dismissTool: (cardId: string) => Promise<void>;
  dismissTierHint: (tier: InsightTier) => Promise<void>;
  markPrivacyNoteShown: () => Promise<void>;
}

// --- Service Singletons ---

let tierEvaluator: TierEvaluator | null = null;
let correlationEngine: CorrelationEngine | null = null;

function getTierEvaluator(): TierEvaluator {
  if (!tierEvaluator) {
    tierEvaluator = createTierEvaluator();
  }
  return tierEvaluator;
}

function getCorrelationEngine(): CorrelationEngine {
  if (!correlationEngine) {
    correlationEngine = createCorrelationEngine();
  }
  return correlationEngine;
}

/**
 * Allows injection of mock services for testing.
 */
export function setInsightsServices(
  evaluator: TierEvaluator,
  engine: CorrelationEngine
): void {
  tierEvaluator = evaluator;
  correlationEngine = engine;
}

// --- Settings Helpers ---

async function readSetting(key: string): Promise<string | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function writeSetting(key: string, value: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  } catch (error) {
    console.warn('[InsightsStore] Failed to write setting:', key, error);
  }
}

async function loadPersistedSettings(): Promise<{
  includePreChangeData: boolean;
  privacyNoteShown: boolean;
  dismissedToolIds: string[];
  tierHintsDismissed: Record<InsightTier, boolean>;
}> {
  const [
    includePreChangeRaw,
    privacyNoteRaw,
    dismissedToolsRaw,
    nascentHintRaw,
    preliminaryHintRaw,
    confidentHintRaw,
  ] = await Promise.all([
    readSetting(SETTINGS_KEY_INCLUDE_PRE_CHANGE_DATA),
    readSetting(SETTINGS_KEY_PRIVACY_NOTE_SHOWN),
    readSetting(SETTINGS_KEY_DISMISSED_TOOLS),
    readSetting(`${SETTINGS_KEY_TIER_HINT_PREFIX}nascent`),
    readSetting(`${SETTINGS_KEY_TIER_HINT_PREFIX}preliminary`),
    readSetting(`${SETTINGS_KEY_TIER_HINT_PREFIX}confident`),
  ]);

  // Parse includePreChangeData — defaults to true
  const includePreChangeData = includePreChangeRaw !== 'false';

  // Parse privacyNoteShown — defaults to false
  const privacyNoteShown = privacyNoteRaw === 'true';

  // Parse dismissed tool IDs — defaults to empty array
  let dismissedToolIds: string[] = [];
  if (dismissedToolsRaw) {
    try {
      const parsed = JSON.parse(dismissedToolsRaw);
      if (Array.isArray(parsed)) {
        dismissedToolIds = parsed;
      }
    } catch {
      // Invalid JSON, default to empty
    }
  }

  // Parse tier hints dismissed — defaults to false for each
  const tierHintsDismissed: Record<InsightTier, boolean> = {
    below_nascent: true, // No hint for below_nascent
    nascent: nascentHintRaw === 'true',
    preliminary: preliminaryHintRaw === 'true',
    confident: confidentHintRaw === 'true',
  };

  return {
    includePreChangeData,
    privacyNoteShown,
    dismissedToolIds,
    tierHintsDismissed,
  };
}

// --- Store Implementation ---

export const useInsightsStore = create<InsightsState>((set, get) => ({
  // Initial state
  tierProgress: null,
  isLoading: false,
  timePeriod: '30d',
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

  async loadWalletInsights() {
    set({ isLoading: true });

    try {
      // 1. Load persisted settings
      const settings = await loadPersistedSettings();
      set({
        includePreChangeData: settings.includePreChangeData,
        privacyNoteShown: settings.privacyNoteShown,
        dismissedToolIds: settings.dismissedToolIds,
        tierHintsDismissed: settings.tierHintsDismissed,
      });

      const evaluator = getTierEvaluator();
      const engine = getCorrelationEngine();
      const { timePeriod, dismissedToolIds } = get();

      // 2. Evaluate current tier
      const tierProgress = await evaluator.evaluate();
      const tier = tierProgress.currentTier;

      // 3. Get engagement data (always — for messaging at all tiers)
      // This is used by the UI to render engagement messaging
      await getEngagementData();

      // 4. Based on tier, compute correlations progressively
      let bestTools: BestToolEntry[] = [];
      let toolsToReconsider: ToolCorrelationResult[] = [];
      let walletCorrelation: WalletCorrelationResult | null = null;
      let kpiLabelChange: KpiLabelChange | null = null;

      // Preliminary+: compute correlations, best tools, KPI label change
      if (tier === 'preliminary' || tier === 'confident') {
        [bestTools, kpiLabelChange] = await Promise.all([
          engine.getBestTools(tier, timePeriod),
          engine.detectKpiLabelChange(timePeriod),
        ]);

        // Also compute tool correlations (needed for tools to reconsider at confident)
        await engine.computeToolCorrelations(timePeriod);
      }

      // Confident: compute wallet correlation and tools to reconsider
      if (tier === 'confident') {
        const { dataAge } = await computeDataAge();
        const granularity: 'daily' | 'weekly' = timePeriod === '7d' || (timePeriod === 'all' && dataAge <= 14) ? 'daily' : 'weekly';
        [walletCorrelation, toolsToReconsider] = await Promise.all([
          engine.computeWalletCorrelation(timePeriod, granularity),
          engine.getToolsToReconsider(timePeriod, dismissedToolIds),
        ]);
      }

      // 5. Set all state with results
      set({
        tierProgress,
        bestTools,
        toolsToReconsider,
        walletCorrelation,
        kpiLabelChange,
        isLoading: false,
      });
    } catch (error) {
      console.warn('[InsightsStore] Failed to load wallet insights:', error);
      set({ isLoading: false });
    }
  },

  setTimePeriod(period: TimePeriod) {
    set({ timePeriod: period });
    // Trigger recomputation with new period
    get().loadWalletInsights();
  },

  async setIncludePreChangeData(include: boolean) {
    set({ includePreChangeData: include });
    await writeSetting(
      SETTINGS_KEY_INCLUDE_PRE_CHANGE_DATA,
      include ? 'true' : 'false'
    );
    // Reload insights with new preference
    await get().loadWalletInsights();
  },

  async dismissTool(cardId: string) {
    const { dismissedToolIds, toolsToReconsider } = get();

    // Add to dismissed list
    const updatedDismissed = [...dismissedToolIds, cardId];

    // Remove tool from toolsToReconsider in state
    const updatedToolsToReconsider = toolsToReconsider.filter(
      (t) => t.cardId !== cardId
    );

    set({
      dismissedToolIds: updatedDismissed,
      toolsToReconsider: updatedToolsToReconsider,
    });

    // Persist dismissed list
    await writeSetting(
      SETTINGS_KEY_DISMISSED_TOOLS,
      JSON.stringify(updatedDismissed)
    );
  },

  async dismissTierHint(tier: InsightTier) {
    const { tierHintsDismissed } = get();

    set({
      tierHintsDismissed: {
        ...tierHintsDismissed,
        [tier]: true,
      },
    });

    // Persist to settings
    await writeSetting(`${SETTINGS_KEY_TIER_HINT_PREFIX}${tier}`, 'true');
  },

  async markPrivacyNoteShown() {
    set({ privacyNoteShown: true });
    await writeSetting(SETTINGS_KEY_PRIVACY_NOTE_SHOWN, 'true');
  },
}));
