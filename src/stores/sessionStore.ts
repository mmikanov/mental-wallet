/**
 * SessionStore — Zustand store managing the active emotion session UI state.
 * Handles emotion/context/time selections, recommendations, and session lifecycle.
 *
 * Validates: Requirements 4.7, 4.9, 5.2, 5.3, 5.4, 6.3, 6.5, 6.6, 6.7, 7.1, 7.2, 10.2, 11.1, 11.2, 11.3, 12.3
 */

import { create } from 'zustand';
import * as emotionSessionService from '@/services/emotionSessionService';
import * as recommendationService from '@/services/recommendationService';
import * as settingsService from '@/services/settingsService';
import { createCompletionService } from '@/services/completionService';
import { logEvent } from '@/services/analyticsEventLogger';
import { useWalletStore } from '@/stores/walletStore';
import type { EmotionType, ContextType, TimeType } from '@/types/index';
import type { RecommendationResult } from '@/services/recommendationService';

const SESSION_LAUNCHER_CARD_ID = 'session-launcher';

export interface SessionStore {
  // State
  isSessionActive: boolean;
  selectedEmotion: EmotionType | null;
  selectedContexts: ContextType[];
  selectedTime: TimeType | null;
  recommendations: RecommendationResult | null;
  currentSessionId: string | null;
  toolsUsedInSession: string[];
  toolsAddedToWallet: string[];

  // Actions
  selectEmotion: (emotion: EmotionType) => Promise<void>;
  deselectEmotion: () => void;
  toggleContext: (context: ContextType) => void;
  selectTime: (time: TimeType | null) => void;
  fetchRecommendations: () => Promise<void>;
  openTool: (cardId: string) => Promise<void>;
  recordToolAdded: (cardTitle: string) => void;
  endSession: () => Promise<void>;
  dismissWithoutSession: () => void;
  restoreUnterminatedSession: () => Promise<void>;
}

const INITIAL_STATE = {
  isSessionActive: false,
  selectedEmotion: null as EmotionType | null,
  selectedContexts: [] as ContextType[],
  selectedTime: null as TimeType | null,
  recommendations: null as RecommendationResult | null,
  currentSessionId: null as string | null,
  toolsUsedInSession: [] as string[],
  toolsAddedToWallet: [] as string[],
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  ...INITIAL_STATE,

  async selectEmotion(emotion: EmotionType) {
    const { isSessionActive } = get();

    // Optimistically set state (Req 11.6 — don't block UI on persistence failure)
    set({
      isSessionActive: true,
      selectedEmotion: emotion,
      recommendations: null,
    });

    // Log analytics event for session start (Requirements 3.11)
    // Only log session_started on the first emotion selection (not on re-selection)
    if (!isSessionActive) {
      logEvent('session_started');
    }

    try {
      const session = await emotionSessionService.create(emotion);
      set({ currentSessionId: session.id });
    } catch {
      // Allow UI to continue per Req 11.6; session will be retried on end
    }
  },

  deselectEmotion() {
    // Req 5.4 — deselecting returns to unselected state, does NOT end session
    set({
      selectedEmotion: null,
      recommendations: null,
    });
  },

  toggleContext(context: ContextType) {
    const { selectedContexts } = get();
    const index = selectedContexts.indexOf(context);
    const updatedContexts =
      index >= 0
        ? selectedContexts.filter((c) => c !== context)
        : [...selectedContexts, context];

    // Req 7.2 — clear recommendations when selections change
    set({
      selectedContexts: updatedContexts,
      recommendations: null,
    });
  },

  selectTime(time: TimeType | null) {
    const { selectedTime } = get();

    // Req 6.5 — toggle behavior: tapping current selection deselects
    const newTime = time === selectedTime ? null : time;

    // Req 7.2 — clear recommendations when selections change
    set({
      selectedTime: newTime,
      recommendations: null,
    });
  },

  async fetchRecommendations() {
    const { selectedEmotion, selectedContexts, selectedTime, currentSessionId } = get();

    // Only proceed if an emotion is selected
    if (!selectedEmotion) return;

    // Get wallet card IDs and sourceLibraryIds from walletStore
    const walletCards = useWalletStore.getState().cards;
    const walletCardIds = walletCards.map((c) => c.id);
    const walletSourceLibraryIds = walletCards
      .map((c) => c.sourceLibraryId)
      .filter((id): id is string => !!id);
    const walletCardTitles = walletCards.map((c) => c.title);

    const recommendations = await recommendationService.getRecommendations(
      selectedEmotion,
      selectedContexts,
      selectedTime,
      walletCardIds,
      walletSourceLibraryIds,
      walletCardTitles
    );

    set({ recommendations });

    // Persist current selections to the session record (fire-and-forget)
    if (currentSessionId) {
      emotionSessionService
        .updateSelections(currentSessionId, selectedContexts, selectedTime)
        .catch(() => {
          // Non-critical — selections are already in Zustand state
        });
    }
  },

  async openTool(cardId: string) {
    const { toolsUsedInSession, currentSessionId } = get();

    // Append to local state (Req 10.2 — append-only)
    set({ toolsUsedInSession: [...toolsUsedInSession, cardId] });

    // Fire-and-forget persistence (don't block UI)
    if (currentSessionId) {
      emotionSessionService.addToolUsed(currentSessionId, cardId).catch(() => {
        // Non-critical — tool usage is tracked locally
      });
    }
  },

  recordToolAdded(cardTitle: string) {
    const { toolsAddedToWallet } = get();
    set({ toolsAddedToWallet: [...toolsAddedToWallet, cardTitle] });
  },

  async endSession() {
    const { currentSessionId, selectedEmotion, selectedContexts, selectedTime, toolsUsedInSession, toolsAddedToWallet } = get();

    if (currentSessionId) {
      await emotionSessionService.endSession(currentSessionId);
    }

    // Log analytics event for session end (Requirements 3.11)
    // session_duration_ms is computed automatically by the event logger
    const sessionEndProps: Record<string, string | number> = {};
    if (selectedEmotion) {
      sessionEndProps.emotion = selectedEmotion;
    }
    if (selectedContexts.length > 0) {
      sessionEndProps.contexts = selectedContexts.join(',');
    }
    if (selectedTime) {
      sessionEndProps.time = selectedTime;
    }
    logEvent('session_ended', sessionEndProps);

    // Record a completion for the session-launcher card so it shows in usage history
    try {
      const completionService = createCompletionService();
      const controlValues: { controlId: string; controlType: string; value: string }[] = [];

      // Build a summary of the session as a single text value
      const sessionSummary: string[] = [];
      if (selectedEmotion) {
        sessionSummary.push(`Feeling: ${selectedEmotion}`);
      }
      if (selectedContexts.length > 0) {
        sessionSummary.push(`Context: ${selectedContexts.join(', ')}`);
      }
      if (selectedTime) {
        sessionSummary.push(`Time: ${selectedTime === '1_2_min' ? '~1–2 min' : '~5–10 min'}`);
      }

      // Resolve tools tried to titles
      if (toolsUsedInSession.length > 0) {
        const walletCards = useWalletStore.getState().cards;
        const { CURATED_LIBRARY } = require('@/data/curatedLibrary');
        const toolTitles = toolsUsedInSession.map((id) => {
          const walletCard = walletCards.find((c) => c.id === id);
          if (walletCard) return walletCard.title;
          const libraryCard = CURATED_LIBRARY.find((c: { id: string; title: string }) => c.id === id);
          if (libraryCard) return libraryCard.title;
          return id;
        });
        const uniqueTitles = [...new Set(toolTitles)];
        sessionSummary.push(`Tools tried: ${uniqueTitles.join(', ')}`);
      }

      if (toolsAddedToWallet.length > 0) {
        sessionSummary.push(`Added to wallet: ${toolsAddedToWallet.join(', ')}`);
      }

      // Store as a single control value mapped to the emotion picker control (which exists in DB)
      controlValues.push({
        controlId: 'ctrl-session-launcher-0',
        controlType: 'choice_buttons',
        value: sessionSummary.join('\n'),
      });

      await completionService.record(SESSION_LAUNCHER_CARD_ID, controlValues);
    } catch {
      // Non-critical — don't block session end on completion recording failure
    }

    // Record last used mode
    await settingsService.setLastUsedMode('emotion');

    // Reload wallet cards so stats panel reflects the new completion
    await useWalletStore.getState().loadCards();

    // Clear all state back to initial
    set({ ...INITIAL_STATE });
  },

  dismissWithoutSession() {
    const { isSessionActive, currentSessionId } = get();

    // If a session was created, end it first (fire-and-forget)
    if (isSessionActive && currentSessionId) {
      emotionSessionService.endSession(currentSessionId).catch(() => {
        // Best-effort cleanup
      });
    }

    // Clear all state
    set({ ...INITIAL_STATE });
  },

  async restoreUnterminatedSession() {
    // Fire-and-forget: close any stale sessions from previous app runs
    await emotionSessionService.endUnterminatedSessions();
  },
}));
