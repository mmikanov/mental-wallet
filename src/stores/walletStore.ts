/**
 * WalletStore — Zustand store managing the wallet's card state
 * and user interaction modes (focus, expand, reorder).
 *
 * Validates: Requirements 1.1, 2.1, 2.6, 3.1, 3.4, 4.1, 4.4, 4.5, 4.6
 */

import { create } from 'zustand';
import { createCardService } from '@/services/cardService';
import { resetStaleStreaks } from '@/services/completionService';
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
    }
  },

  collapseCard() {
    set({ isExpanded: false });
  },

  returnToStack() {
    set({ focusedCardId: null, isExpanded: false });
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
    // Reorder cards array to match newOrder
    const cardMap = new Map(cards.map((c) => [c.id, c]));
    const reorderedCards = newOrder
      .map((id) => cardMap.get(id))
      .filter((c): c is Card => c !== undefined);
    set({ cards: reorderedCards, cardOrder: newOrder, isReorderMode: false });
  },

  cancelReorder() {
    set({ isReorderMode: false });
  },
}));
