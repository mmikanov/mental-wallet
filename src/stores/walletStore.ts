/**
 * WalletStore — Zustand store managing the wallet's card state
 * and user interaction modes (focus, expand, reorder).
 *
 * Validates: Requirements 1.1, 2.1, 2.6, 3.1, 3.4, 4.1, 4.4, 4.5, 4.6
 */

import { create } from 'zustand';
import { createCardService } from '@/services/cardService';
import { resetStaleStreaks } from '@/services/completionService';
import { useDurationTrackingStore } from '@/stores/durationTrackingStore';
import type { Card } from '@/types/index';
import type { CardService } from '@/types/services';

export interface WalletStore {
  cards: Card[];
  cardOrder: string[];
  focusedCardId: string | null;
  isExpanded: boolean;
  isReorderMode: boolean;
  // Actions
  loadCards: () => Promise<void>;
  focusCard: (id: string) => void;
  expandCard: () => void;
  collapseCard: () => void;
  returnToStack: () => void;
  enterReorderMode: () => void;
  commitReorder: (newOrder: string[]) => Promise<void>;
  cancelReorder: () => void;
}

let cardService: CardService | null = null;

function getCardService(): CardService {
  if (!cardService) {
    cardService = createCardService();
  }
  return cardService;
}

/**
 * Allows injection of a mock CardService for testing.
 */
export function setCardService(service: CardService): void {
  cardService = service;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  cards: [],
  cardOrder: [],
  focusedCardId: null,
  isExpanded: false,
  isReorderMode: false,

  async loadCards() {
    await resetStaleStreaks();
    const service = getCardService();
    const cards = await service.getAll();
    const cardOrder = cards.map((c) => c.id);
    set({ cards, cardOrder });
  },

  focusCard(id: string) {
    set({ focusedCardId: id, isExpanded: false });
  },

  expandCard() {
    const { focusedCardId } = get();
    if (focusedCardId) {
      set({ isExpanded: true });
      // Entering active use is the single chokepoint for starting a duration
      // session — arrow tap, primary action, deep link, and tutorial all funnel
      // through expandCard(). (Req 4.2)
      useDurationTrackingStore.getState().startTracking(focusedCardId);
    }
  },

  collapseCard() {
    set({ isExpanded: false });
    // Close a duration session as "closed without finishing" (Req 4.2).
    // Completion-first ordering: on a genuine completion, ExpandedContent calls
    // stopTracking('completed') BEFORE collapseCard() runs, so by the time we
    // get here the session is already stopped and stopTracking() early-returns
    // (!isTracking) — a safe no-op that preserves the 'completed' label. Only a
    // genuine collapse/dismiss without completing leaves the session active, in
    // which case this records a 'collapsed' session.
    useDurationTrackingStore.getState().stopTracking('collapsed');
  },

  returnToStack() {
    set({ focusedCardId: null, isExpanded: false });
    // Full dismiss without finishing → closed without finishing (Req 4.2).
    // Same completion-first no-op safety as collapseCard(): if a completion
    // already stopped the session, this early-returns.
    useDurationTrackingStore.getState().stopTracking('collapsed');
  },

  enterReorderMode() {
    const { cards } = get();
    if (cards.length >= 2) {
      set({ isReorderMode: true });
    }
  },

  async commitReorder(newOrder: string[]) {
    const service = getCardService();
    await service.reorder(newOrder);
    const { cards } = get();
    // Reorder cards array to match newOrder, preserving cards not in the reorder list (e.g., KPI card)
    const reorderSet = new Set(newOrder);
    const cardMap = new Map(cards.map((c) => [c.id, c]));
    const reorderedCards = newOrder
      .map((id) => cardMap.get(id))
      .filter((c): c is Card => c !== undefined);
    // Append any cards that weren't part of the reorder (hidden from reorder UI)
    const preservedCards = cards.filter((c) => !reorderSet.has(c.id));
    set({ cards: [...reorderedCards, ...preservedCards], cardOrder: newOrder, isReorderMode: false });
  },

  cancelReorder() {
    set({ isReorderMode: false });
  },
}));
