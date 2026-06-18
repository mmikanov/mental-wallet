import { useWalletStore, setCardService } from '../walletStore';
import type { Card } from '../../types/index';
import type { CardService } from '../../types/services';

// Mock dependencies
jest.mock('../../services/completionService', () => ({
  resetStaleStreaks: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/cardService', () => ({
  createCardService: jest.fn(),
}));

const { resetStaleStreaks } = require('../../services/completionService');

function makeCard(overrides?: Partial<Card>): Card {
  return {
    id: 'card-1',
    title: 'Test Card',
    description: 'A test card',
    iconType: 'emoji',
    iconValue: '🧘',
    backgroundType: 'color',
    backgroundValue: '#4A90D9',
    categoryId: 'grounding-calming',
    originBadge: 'my_tool',
    stackPosition: 0,
    totalUses: 0,
    currentStreak: 0,
    lastUsedAt: null,
    isArchived: false,
    archivedAt: null,
    previousStackPosition: null,
    controls: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMockCardService(overrides?: Partial<CardService>): CardService {
  return {
    getAll: jest.fn().mockResolvedValue([]),
    getById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(makeCard()),
    update: jest.fn().mockResolvedValue(makeCard()),
    reorder: jest.fn().mockResolvedValue(undefined),
    archive: jest.fn().mockResolvedValue(undefined),
    restore: jest.fn().mockResolvedValue(undefined),
    duplicate: jest.fn().mockResolvedValue(makeCard()),
    delete: jest.fn().mockResolvedValue(undefined),
    validateShell: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    validateControls: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    ...overrides,
  };
}

describe('WalletStore', () => {
  let mockCardService: CardService;

  beforeEach(() => {
    // Reset store state between tests
    useWalletStore.setState({
      cards: [],
      cardOrder: [],
      focusedCardId: null,
      isExpanded: false,
      isReorderMode: false,
    });
    mockCardService = makeMockCardService();
    setCardService(mockCardService);
    jest.clearAllMocks();
  });

  describe('loadCards', () => {
    it('calls resetStaleStreaks before loading cards', async () => {
      const cards = [makeCard({ id: 'card-1' }), makeCard({ id: 'card-2' })];
      (mockCardService.getAll as jest.Mock).mockResolvedValue(cards);

      await useWalletStore.getState().loadCards();

      expect(resetStaleStreaks).toHaveBeenCalledTimes(1);
      // resetStaleStreaks should be called before getAll
      const resetOrder = (resetStaleStreaks as jest.Mock).mock.invocationCallOrder[0];
      const getAllOrder = (mockCardService.getAll as jest.Mock).mock.invocationCallOrder[0];
      expect(resetOrder).toBeLessThan(getAllOrder);
    });

    it('loads cards and sets cardOrder from service', async () => {
      const cards = [
        makeCard({ id: 'card-a', stackPosition: 0 }),
        makeCard({ id: 'card-b', stackPosition: 1 }),
      ];
      (mockCardService.getAll as jest.Mock).mockResolvedValue(cards);

      await useWalletStore.getState().loadCards();

      const state = useWalletStore.getState();
      expect(state.cards).toEqual(cards);
      expect(state.cardOrder).toEqual(['card-a', 'card-b']);
    });

    it('handles empty wallet', async () => {
      (mockCardService.getAll as jest.Mock).mockResolvedValue([]);

      await useWalletStore.getState().loadCards();

      const state = useWalletStore.getState();
      expect(state.cards).toEqual([]);
      expect(state.cardOrder).toEqual([]);
    });
  });

  describe('focusCard', () => {
    it('sets focusedCardId and isExpanded to false', () => {
      useWalletStore.setState({ isExpanded: true });

      useWalletStore.getState().focusCard('card-1');

      const state = useWalletStore.getState();
      expect(state.focusedCardId).toBe('card-1');
      expect(state.isExpanded).toBe(false);
    });

    it('replaces previously focused card', () => {
      useWalletStore.setState({ focusedCardId: 'card-1' });

      useWalletStore.getState().focusCard('card-2');

      expect(useWalletStore.getState().focusedCardId).toBe('card-2');
    });
  });

  describe('expandCard', () => {
    it('sets isExpanded to true when a card is focused', () => {
      useWalletStore.setState({ focusedCardId: 'card-1', isExpanded: false });

      useWalletStore.getState().expandCard();

      expect(useWalletStore.getState().isExpanded).toBe(true);
    });

    it('does not expand when no card is focused', () => {
      useWalletStore.setState({ focusedCardId: null, isExpanded: false });

      useWalletStore.getState().expandCard();

      expect(useWalletStore.getState().isExpanded).toBe(false);
    });
  });

  describe('collapseCard', () => {
    it('sets isExpanded to false while preserving focusedCardId', () => {
      useWalletStore.setState({ focusedCardId: 'card-1', isExpanded: true });

      useWalletStore.getState().collapseCard();

      const state = useWalletStore.getState();
      expect(state.isExpanded).toBe(false);
      expect(state.focusedCardId).toBe('card-1');
    });
  });

  describe('returnToStack', () => {
    it('clears focusedCardId and isExpanded', () => {
      useWalletStore.setState({ focusedCardId: 'card-1', isExpanded: true });

      useWalletStore.getState().returnToStack();

      const state = useWalletStore.getState();
      expect(state.focusedCardId).toBeNull();
      expect(state.isExpanded).toBe(false);
    });
  });

  describe('enterReorderMode', () => {
    it('sets isReorderMode to true when cards.length >= 2', () => {
      useWalletStore.setState({
        cards: [makeCard({ id: 'card-1' }), makeCard({ id: 'card-2' })],
      });

      useWalletStore.getState().enterReorderMode();

      expect(useWalletStore.getState().isReorderMode).toBe(true);
    });

    it('does not enter reorder mode when cards.length < 2', () => {
      useWalletStore.setState({ cards: [makeCard({ id: 'card-1' })] });

      useWalletStore.getState().enterReorderMode();

      expect(useWalletStore.getState().isReorderMode).toBe(false);
    });

    it('does not enter reorder mode with 0 cards', () => {
      useWalletStore.setState({ cards: [] });

      useWalletStore.getState().enterReorderMode();

      expect(useWalletStore.getState().isReorderMode).toBe(false);
    });
  });

  describe('commitReorder', () => {
    it('persists new order and updates cards/cardOrder in state', async () => {
      const cardA = makeCard({ id: 'card-a', stackPosition: 0 });
      const cardB = makeCard({ id: 'card-b', stackPosition: 1 });
      useWalletStore.setState({
        cards: [cardA, cardB],
        cardOrder: ['card-a', 'card-b'],
        isReorderMode: true,
      });

      await useWalletStore.getState().commitReorder(['card-b', 'card-a']);

      expect(mockCardService.reorder).toHaveBeenCalledWith(['card-b', 'card-a']);
      const state = useWalletStore.getState();
      expect(state.cardOrder).toEqual(['card-b', 'card-a']);
      expect(state.cards[0].id).toBe('card-b');
      expect(state.cards[1].id).toBe('card-a');
      expect(state.isReorderMode).toBe(false);
    });

    it('exits reorder mode after committing', async () => {
      useWalletStore.setState({
        cards: [makeCard({ id: 'card-1' })],
        cardOrder: ['card-1'],
        isReorderMode: true,
      });

      await useWalletStore.getState().commitReorder(['card-1']);

      expect(useWalletStore.getState().isReorderMode).toBe(false);
    });
  });

  describe('cancelReorder', () => {
    it('sets isReorderMode to false without persisting', () => {
      useWalletStore.setState({ isReorderMode: true });

      useWalletStore.getState().cancelReorder();

      expect(useWalletStore.getState().isReorderMode).toBe(false);
      expect(mockCardService.reorder).not.toHaveBeenCalled();
    });
  });
});
