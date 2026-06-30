/**
 * OnboardingStore — Zustand store managing onboarding state and persistence.
 *
 * Persists state as a JSON blob in the `settings` table under key 'onboarding_state'.
 * Also writes the legacy 'disclaimer_acknowledged' key for backward compatibility.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 8.2
 */

import { create } from 'zustand';
import { getDatabase } from '@/data/database';

export interface OnboardingState {
  // Persisted state
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

  // Derived
  isChecklistVisible: boolean;
  isChecklistComplete: boolean;

  // Actions
  acknowledgeDisclaimer: () => Promise<void>;
  completeOnboardingScreens: (intent: string | null) => Promise<void>;
  completeTutorial: () => Promise<void>;
  markChecklistItem: (item: 'openTool' | 'tryExercise' | 'addTool') => Promise<void>;
  dismissChecklist: () => Promise<void>;
  dismissBanner: () => Promise<void>;
  incrementSessionCount: () => Promise<void>;
  loadState: () => Promise<void>;
}

const SETTINGS_KEY = 'onboarding_state';
const LEGACY_DISCLAIMER_KEY = 'disclaimer_acknowledged';

interface PersistedState {
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

const DEFAULT_STATE: PersistedState = {
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

function computeDerived(state: PersistedState) {
  const isChecklistComplete =
    state.checklist.openTool &&
    state.checklist.tryExercise &&
    state.checklist.addTool;
  const isChecklistVisible =
    state.tutorialComplete && !isChecklistComplete && state.checklistSessionCount < 3;
  return { isChecklistComplete, isChecklistVisible };
}

async function persistState(state: PersistedState): Promise<void> {
  const db = await getDatabase();
  const json = JSON.stringify(state);
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [SETTINGS_KEY, json]
    );
  } catch {
    // Retry once silently on DB write failure
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [SETTINGS_KEY, json]
      );
    } catch {
      // Proceed with in-memory state — next app launch will re-show the relevant stage
      console.warn('[OnboardingStore] Failed to persist state after retry, proceeding with in-memory state');
    }
  }
}

async function writeLegacyDisclaimerFlag(): Promise<void> {
  const db = await getDatabase();
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [LEGACY_DISCLAIMER_KEY, 'true']
    );
  } catch {
    // Retry once silently on DB write failure
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [LEGACY_DISCLAIMER_KEY, 'true']
      );
    } catch {
      console.warn('[OnboardingStore] Failed to write legacy disclaimer flag after retry');
    }
  }
}

function getPersistedFields(state: OnboardingState): PersistedState {
  return {
    disclaimerAcknowledged: state.disclaimerAcknowledged,
    onboardingScreensComplete: state.onboardingScreensComplete,
    selectedIntent: state.selectedIntent,
    tutorialComplete: state.tutorialComplete,
    checklist: { ...state.checklist },
    checklistSessionCount: state.checklistSessionCount,
    bannerDismissed: state.bannerDismissed,
  };
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...DEFAULT_STATE,
  ...computeDerived(DEFAULT_STATE),

  async acknowledgeDisclaimer() {
    const current = getPersistedFields(get());
    const updated: PersistedState = { ...current, disclaimerAcknowledged: true };
    set({ ...updated, ...computeDerived(updated) });
    await persistState(updated);
    await writeLegacyDisclaimerFlag();
  },

  async completeOnboardingScreens(intent: string | null) {
    const current = getPersistedFields(get());
    const updated: PersistedState = {
      ...current,
      onboardingScreensComplete: true,
      selectedIntent: intent,
    };
    set({ ...updated, ...computeDerived(updated) });
    await persistState(updated);
  },

  async completeTutorial() {
    const current = getPersistedFields(get());
    const updated: PersistedState = { ...current, tutorialComplete: true };
    set({ ...updated, ...computeDerived(updated) });
    await persistState(updated);
  },

  async markChecklistItem(item: 'openTool' | 'tryExercise' | 'addTool') {
    const current = getPersistedFields(get());
    const updated: PersistedState = {
      ...current,
      checklist: { ...current.checklist, [item]: true },
    };
    set({ ...updated, ...computeDerived(updated) });
    await persistState(updated);
  },

  async dismissChecklist() {
    const current = getPersistedFields(get());
    // Set session count to 3 to permanently hide the checklist
    const updated: PersistedState = { ...current, checklistSessionCount: 3 };
    set({ ...updated, ...computeDerived(updated) });
    await persistState(updated);
  },

  async dismissBanner() {
    const current = getPersistedFields(get());
    const updated: PersistedState = { ...current, bannerDismissed: true };
    set({ ...updated, ...computeDerived(updated) });
    await persistState(updated);
  },

  async incrementSessionCount() {
    const current = getPersistedFields(get());
    const updated: PersistedState = {
      ...current,
      checklistSessionCount: current.checklistSessionCount + 1,
    };
    set({ ...updated, ...computeDerived(updated) });
    await persistState(updated);
  },

  async loadState() {
    const db = await getDatabase();

    // Check for existing onboarding_state JSON
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [SETTINGS_KEY]
    );

    if (row) {
      try {
        const parsed = JSON.parse(row.value) as PersistedState;
        const state: PersistedState = {
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
        set({ ...state, ...computeDerived(state) });
        return;
      } catch {
        // JSON parse error — reset to defaults (Requirement 7.2 error handling)
        set({ ...DEFAULT_STATE, ...computeDerived(DEFAULT_STATE) });
        return;
      }
    }

    // No onboarding_state found — check for legacy disclaimer flag
    const legacyRow = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [LEGACY_DISCLAIMER_KEY]
    );

    if (legacyRow && legacyRow.value === 'true') {
      // Legacy user: disclaimer acknowledged via old flow — treat as fully complete
      const legacyState: PersistedState = {
        ...DEFAULT_STATE,
        disclaimerAcknowledged: true,
        onboardingScreensComplete: true,
      };
      set({ ...legacyState, ...computeDerived(legacyState) });
      return;
    }

    // Fresh user — use defaults
    set({ ...DEFAULT_STATE, ...computeDerived(DEFAULT_STATE) });
  },
}));
