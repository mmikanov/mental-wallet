/**
 * Onboarding Service — Business logic for onboarding state management
 * and starter card seeding.
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.2
 */

import { getDatabase } from '@/data/database';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import {
  INTENT_OPTIONS,
  DEFAULT_STARTER_CARD_IDS,
  type IntentId,
} from '@/data/onboardingConfig';
import { createCardService } from '@/services/cardService';
import { createKpiService } from '@/services/kpiService';
import type { CardShell, Control } from '@/types/index';

export interface OnboardingState {
  disclaimerAcknowledged: boolean;
  onboardingScreensComplete: boolean;
  selectedIntent: string | null;
  tutorialComplete: boolean;
  checklist: {
    openTool: boolean;
    tryExercise: boolean;
    addTool: boolean;
  };
  checklistSessionCount: number;
  bannerDismissed: boolean;
}

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  disclaimerAcknowledged: false,
  onboardingScreensComplete: false,
  selectedIntent: null,
  tutorialComplete: false,
  checklist: {
    openTool: false,
    tryExercise: false,
    addTool: false,
  },
  checklistSessionCount: 0,
  bannerDismissed: false,
};

const ONBOARDING_STATE_KEY = 'onboarding_state';
const LEGACY_DISCLAIMER_KEY = 'disclaimer_acknowledged';

export interface OnboardingService {
  /** Seed starter cards into the wallet for the given intent (or defaults) */
  seedStarterCards(intentId: IntentId | null): Promise<void>;

  /** Seed the personal KPI card into the wallet at position 1 */
  seedKpiCard(kpiLabel: string): Promise<void>;

  /** Persist onboarding state to settings table */
  saveState(state: Partial<OnboardingState>): Promise<void>;

  /** Load onboarding state from settings table */
  loadState(): Promise<OnboardingState>;

  /** Write legacy disclaimer_acknowledged key for backward compat */
  writeLegacyDisclaimerFlag(): Promise<void>;
}

/**
 * Creates the concrete OnboardingService implementation.
 */
export function createOnboardingService(): OnboardingService {
  const cardService = createCardService();
  const kpiService = createKpiService();

  return {
    /**
     * Seeds starter cards into the wallet based on the user's selected intent.
     * If intentId is null, uses DEFAULT_STARTER_CARD_IDS.
     *
     * Cards are created in reverse order so that the first card in the array
     * ends up at stack position 0 (frontmost).
     *
     * Missing card IDs are skipped with a warning; proceeds with remaining valid cards.
     */
    async seedStarterCards(intentId: IntentId | null): Promise<void> {
      // Resolve card IDs from config
      let cardIds: string[];

      if (intentId === null) {
        cardIds = [...DEFAULT_STARTER_CARD_IDS];
      } else {
        const mapping = INTENT_OPTIONS.find((opt) => opt.intentId === intentId);
        if (mapping) {
          cardIds = [...mapping.cardIds];
        } else {
          console.warn(
            `[OnboardingService] Unknown intent "${intentId}", falling back to defaults`
          );
          cardIds = [...DEFAULT_STARTER_CARD_IDS];
        }
      }

      // Create cards in reverse order so first card ends up frontmost (position 0)
      // Since cardService.create always inserts at position 0 and shifts others down,
      // inserting in reverse ensures the first card in the array ends up on top.
      const reversedCardIds = [...cardIds].reverse();

      for (const cardId of reversedCardIds) {
        const curatedDef = CURATED_LIBRARY.find((c) => c.id === cardId);

        if (!curatedDef) {
          console.warn(
            `[OnboardingService] Card ID "${cardId}" not found in curated library, skipping`
          );
          continue;
        }

        const shell: CardShell = {
          title: curatedDef.title,
          description: curatedDef.description,
          iconType: curatedDef.iconType,
          iconValue: curatedDef.iconValue,
          backgroundType: curatedDef.backgroundType,
          backgroundValue: curatedDef.backgroundValue,
        };

        const controls: Omit<Control, 'id' | 'cardId'>[] = curatedDef.controls.map((ctrl) => ({
          type: ctrl.type,
          position: ctrl.position,
          config: ctrl.config,
          isRequired: ctrl.isRequired,
        }));

        try {
          await cardService.create(shell, controls, 'library', curatedDef.categoryId, curatedDef.id);
        } catch (error) {
          console.warn(
            `[OnboardingService] Failed to seed card "${curatedDef.title}" (${cardId}):`,
            error
          );
          // Skip failed cards and continue with remaining valid ones
        }
      }
    },

    /**
     * Seeds the personal KPI card into the wallet by delegating to kpiService.
     * Errors are caught and logged without crashing (fire-and-forget pattern).
     */
    async seedKpiCard(kpiLabel: string): Promise<void> {
      try {
        await kpiService.seedKpiCard(kpiLabel);
      } catch (error) {
        console.warn(
          `[OnboardingService] Failed to seed KPI card with label "${kpiLabel}":`,
          error
        );
      }
    },

    /**
     * Persists partial onboarding state to the settings table as JSON.
     * Merges with existing state before saving.
     */
    async saveState(state: Partial<OnboardingState>): Promise<void> {
      const db = await getDatabase();

      // Load current state to merge with
      const currentState = await this.loadState();
      const merged: OnboardingState = {
        ...currentState,
        ...state,
        checklist: {
          ...currentState.checklist,
          ...(state.checklist || {}),
        },
      };

      const json = JSON.stringify(merged);

      await db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [ONBOARDING_STATE_KEY, json]
      );
    },

    /**
     * Loads onboarding state from the settings table.
     * Returns defaults if no state is persisted or if parsing fails.
     */
    async loadState(): Promise<OnboardingState> {
      const db = await getDatabase();

      const row = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM settings WHERE key = ?`,
        [ONBOARDING_STATE_KEY]
      );

      if (!row) {
        // Check if legacy disclaimer key exists (backward compat for Req 8.3)
        const legacyRow = await db.getFirstAsync<{ value: string }>(
          `SELECT value FROM settings WHERE key = ?`,
          [LEGACY_DISCLAIMER_KEY]
        );

        if (legacyRow && legacyRow.value === 'true') {
          return {
            ...DEFAULT_ONBOARDING_STATE,
            disclaimerAcknowledged: true,
            onboardingScreensComplete: true,
          };
        }

        return { ...DEFAULT_ONBOARDING_STATE };
      }

      try {
        const parsed = JSON.parse(row.value);
        return {
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
      } catch {
        // JSON parse error — reset to defaults (per design error handling)
        console.warn('[OnboardingService] Failed to parse onboarding state, resetting to defaults');
        return { ...DEFAULT_ONBOARDING_STATE };
      }
    },

    /**
     * Writes the legacy 'disclaimer_acknowledged' = 'true' key to the settings
     * table for backward compatibility with the old DisclaimerScreen.
     */
    async writeLegacyDisclaimerFlag(): Promise<void> {
      const db = await getDatabase();

      await db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [LEGACY_DISCLAIMER_KEY, 'true']
      );
    },
  };
}
