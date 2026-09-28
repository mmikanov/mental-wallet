/**
 * WIRING TEST (Bug 2, Cycle B — originally the task 2.6 exploration test).
 *
 * This began as an exploration test proving the duration tracker was NEVER
 * driven by production code (no wallet lifecycle action touched the tracking
 * store, so `duration_records` was never written and the Insights "Practice
 * time" line stayed at 0). The wiring is now complete (tasks 2.9–2.11), so this
 * suite has been updated to verify the REAL wired behavior — it now PASSES.
 *
 * Layering note: at the pure store layer, `collapseCard()` / `returnToStack()`
 * persist a **'collapsed'** record. The 'completed' label is a component-layer
 * concern: `ExpandedContent` calls `stopTracking('completed')` BEFORE calling
 * `collapseCard()`, so the collapse call early-returns (no-op) and the
 * 'completed' label is preserved. That completion-first ordering contract is
 * exercised below.
 *
 * Task 2.12 (Verify) also adds an end-to-end card-switch scenario driven through
 * the real walletStore chokepoint (expandCard), proving no double-count when a
 * user jumps straight from tool A to tool B (the store-layer switch contract
 * itself is pinned separately by durationTrackingStore.cardSwitch.preservation).
 *
 * Validates: Requirements 4.1, 4.2, 4.6, 4.7
 */

jest.mock('@/services/durationService', () => ({
  createDurationService: jest.fn(),
}));

// Isolate walletStore's dependencies so we can drive its lifecycle actions
// without touching the real DB / card service.
jest.mock('@/services/cardService', () => ({
  createCardService: jest.fn(),
}));
jest.mock('@/services/completionService', () => ({
  resetStaleStreaks: jest.fn().mockResolvedValue(undefined),
}));

import { useWalletStore } from '../walletStore';
import {
  useDurationTrackingStore,
  setDurationService,
  resetDurationTrackingInternals,
} from '../durationTrackingStore';
import type { DurationService } from '@/services/durationService';

function createMockDurationService(
  overrides: Partial<DurationService> = {}
): DurationService {
  return {
    // Echo back a record so a "persisted" call is observable.
    persist: jest.fn(async (record) => ({ id: 'rec-1', ...record })),
    query: jest.fn().mockResolvedValue([]),
    getStats: jest.fn().mockResolvedValue(null),
    getCardAverageDuration: jest.fn().mockResolvedValue(null),
    deleteAll: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function resetDurationStore() {
  useDurationTrackingStore.setState({
    isTracking: false,
    activeCardId: null,
    startTimestamp: null,
    accumulatedSec: 0,
    backgroundedAt: null,
  });
  resetDurationTrackingInternals();
}

function resetWalletStore() {
  useWalletStore.setState({
    cards: [],
    cardOrder: [],
    focusedCardId: null,
    isExpanded: false,
    isReorderMode: false,
  });
}

describe('Duration tracking wiring (now PASSES post-wiring — verifies wired behavior)', () => {
  let mockService: DurationService;

  beforeEach(() => {
    mockService = createMockDurationService();
    setDurationService(mockService);
    resetDurationStore();
    resetWalletStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('expanding a card into active use starts timing the session (Req 4.1)', () => {
    // Drive the production lifecycle the way the app does: focus, then expand.
    // expandCard() is the single "enter active use" chokepoint.
    useWalletStore.getState().focusCard('card-1');
    useWalletStore.getState().expandCard();

    expect(useDurationTrackingStore.getState().isTracking).toBe(true);
    expect(useDurationTrackingStore.getState().activeCardId).toBe('card-1');
  });

  it('collapsing a card without completing persists exactly one "collapsed" record (Req 4.2 closed-without-finishing)', async () => {
    useWalletStore.getState().focusCard('card-1');
    useWalletStore.getState().expandCard();

    // Spend a meaningful amount of on-screen time (>= 3s so it isn't discarded).
    jest.advanceTimersByTime(30_000);

    // The user closes the tool WITHOUT finishing. At the store layer this is the
    // dismiss path; no prior stopTracking('completed') ran, so the session is
    // still active and collapseCard() records it as 'collapsed'. (The
    // 'completed' label is a component-layer concern verified elsewhere.)
    useWalletStore.getState().collapseCard();
    await Promise.resolve();

    expect(mockService.persist).toHaveBeenCalledTimes(1);
    expect(mockService.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'card-1',
        endStatus: 'collapsed',
      })
    );
    expect(useDurationTrackingStore.getState().isTracking).toBe(false);
  });

  it('returning to the stack without completing stops timing and persists one "collapsed" record (Req 4.2)', async () => {
    useWalletStore.getState().focusCard('card-1');
    useWalletStore.getState().expandCard();
    jest.advanceTimersByTime(30_000);

    useWalletStore.getState().returnToStack();
    await Promise.resolve();

    expect(useDurationTrackingStore.getState().isTracking).toBe(false);
    expect(mockService.persist).toHaveBeenCalledTimes(1);
    expect(mockService.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'card-1',
        endStatus: 'collapsed',
      })
    );
  });

  it('completion-first ordering: a completed stop before collapseCard() makes the collapse call a no-op (Req 4.2, 4.7)', async () => {
    useWalletStore.getState().focusCard('card-1');
    useWalletStore.getState().expandCard();
    jest.advanceTimersByTime(30_000);

    // Simulate what ExpandedContent does on a genuine completion: stop the
    // session with 'completed' BEFORE the wallet collapses the card.
    await useDurationTrackingStore.getState().stopTracking('completed');

    // Now the wallet collapses. The session is already stopped, so this
    // collapseCard() call hits stopTracking's !isTracking early-return: no
    // second record, and the 'completed' label is preserved.
    useWalletStore.getState().collapseCard();
    await Promise.resolve();

    expect(mockService.persist).toHaveBeenCalledTimes(1);
    expect(mockService.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'card-1',
        endStatus: 'completed',
      })
    );
    expect(useDurationTrackingStore.getState().isTracking).toBe(false);
  });

  it('switching cards via expandCard() abandons card A and finishing card B persists ONE record for B only — no double-count (Req 4.7)', async () => {
    // End-to-end through the wallet lifecycle: expand card A, spend time, then
    // expand card B directly (a switch). expandCard() -> startTracking('card-B')
    // implicitly abandons A's in-progress session — the store contract persists
    // nothing at the switch point (same as a crash, Req 4.7). Card A's time is
    // neither double-counted nor mis-attributed to B.
    //
    // NOTE: the store-layer switch contract itself is pinned by
    // durationTrackingStore.cardSwitch.preservation.test.ts. This case adds the
    // missing coverage: the switch driven through the real walletStore
    // chokepoint (expandCard) plus a completion-first finish on B.
    useWalletStore.getState().focusCard('card-A');
    useWalletStore.getState().expandCard();
    jest.advanceTimersByTime(30_000); // 30s on A

    // Switch straight to card B (no collapse in between).
    useWalletStore.getState().focusCard('card-B');
    useWalletStore.getState().expandCard();

    // Nothing persisted at the switch point — A's session was abandoned.
    expect(mockService.persist).not.toHaveBeenCalled();
    expect(useDurationTrackingStore.getState().activeCardId).toBe('card-B');

    jest.advanceTimersByTime(10_000); // 10s on B (>= 3s so it's kept)

    // Finish B the way ExpandedContent does: completed stop, then collapse no-op.
    await useDurationTrackingStore.getState().stopTracking('completed');
    useWalletStore.getState().collapseCard();
    await Promise.resolve();

    // Exactly ONE record, for card B only, reflecting only B's on-screen time.
    expect(mockService.persist).toHaveBeenCalledTimes(1);
    const persisted = (mockService.persist as jest.Mock).mock.calls[0][0];
    expect(persisted.cardId).toBe('card-B');
    expect(persisted.endStatus).toBe('completed');
    expect(persisted.activeDurationSec).toBe(10);
    expect(useDurationTrackingStore.getState().isTracking).toBe(false);
  });
});
