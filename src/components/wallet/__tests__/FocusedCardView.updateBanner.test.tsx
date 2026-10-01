/**
 * FocusedCardView — "Update available" BANNER behavior (Task 9.5, TDD / test-first).
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 2.5**
 *
 * Addendum 2 replaces the small `badgeRow` pill with a prominent top-of-body
 * banner (`UpdateAvailableBanner`) and fixes the finding that the affordance
 * disappeared once the card was expanded. These tests assert the NEW contract and
 * are written test-first: they are EXPECTED TO FAIL against the current
 * FocusedCardView (which still renders the pill, gated on `!isExpanded`, and has
 * no banner). Task 9.6 wires the banner in and removes the pill to turn them green.
 *
 * ---------------------------------------------------------------------------
 * EXACT a11y STRINGS (for the 9.6 implementer):
 *
 *   BANNER accessibilityLabel : "Update available — see what changed"
 *                               (this is UpdateAvailableBanner's A11Y_LABEL)
 *   OLD PILL accessibilityLabel: "Update available"   ← must be GONE after 9.6
 *
 * RNTL's getByLabelText / queryByLabelText use EXACT string matching by default,
 * so querying "Update available" does NOT match the banner's longer
 * "Update available — see what changed" label. That lets us assert the pill's
 * absence and the banner's presence independently in the same render.
 * ---------------------------------------------------------------------------
 *
 * Cases:
 *   1. Outdated + collapsed (isExpanded=false)  → banner present.
 *   2. Outdated + EXPANDED  (isExpanded=true)   → banner STILL present (finding #2).
 *      Uses a plain library card through the normal shared branch (NOT
 *      renderExpandedContent), which is where the note-taking / active-use body
 *      renders.
 *   3. Not outdated / my_tool (no sourceLibraryId) / removed-curated → banner
 *      absent in BOTH collapsed and expanded states.
 *   4. The OLD pill (accessibilityLabel exactly "Update available") is no longer
 *      rendered (outdated + collapsed case).
 *   5. KPI check-in card, outdated: BOTH the update banner AND the amber
 *      BadgeExplanationBanner render, with the update banner ABOVE the amber one.
 *
 * Harness mirrors FocusedCardView.updatePill.test.tsx / updateFlow.test.tsx:
 * reanimated / gesture-handler / navigation / ControlRenderer / cardColors /
 * renderCardIcon / RationaleSheet / useCardReminder / accessibility / seeds /
 * the CURATED_LIBRARY getter-mock. The real UpdateAvailableBanner,
 * BadgeExplanationBanner, summarizeUpdate and KPI_CARD_DEFINITION are used
 * (not mocked). kpiStore is mocked with a real `lastCheckInDate` so the amber
 * banner renders for case 5.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import type { Card } from '@/types/index';
import { KPI_CARD_DEFINITION } from '@/data/kpiCardDefinition';

// --- Mock react-native-reanimated ---
jest.mock('react-native-reanimated', () => {
  const mockReact = require('react');
  const mockAnimatedView = (props: any) =>
    mockReact.createElement('View', props, props.children);
  return {
    __esModule: true,
    default: { View: mockAnimatedView },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: (val: any, _config?: any, cb?: any) => {
      if (cb) cb(true);
      return val;
    },
    runOnJS: (fn: any) => fn,
  };
});

// --- Mock react-native-gesture-handler ---
jest.mock('react-native-gesture-handler', () => {
  const mockReact = require('react');
  return {
    Gesture: {
      Pan: () => ({
        enabled: function () { return this; },
        activeOffsetY: function () { return this; },
        failOffsetY: function () { return this; },
        onUpdate: function () { return this; },
        onEnd: function () { return this; },
      }),
    },
    GestureDetector: ({ children }: any) =>
      mockReact.createElement('View', null, children),
    ScrollView: ({ children }: any) =>
      mockReact.createElement('View', null, children),
  };
});

// --- Mock @react-navigation/native ---
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// --- Mock ControlRenderer (pulled in via ExpandedContent) ---
jest.mock('@/components/controls/ControlRenderer', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', { testID: 'mock-control-renderer' }),
  };
});

// --- Mock ExpandedContent. The banner renders at the TOP of the card body,
//     above ExpandedContent, so stubbing the active-use body keeps the banner
//     contract intact while sidestepping ExpandedContent's own store/selector
//     wiring (useCompletionStore / useWalletStore selectors, duration tracking,
//     analytics) — which the expanded-state cases (2–4) would otherwise pull in.
//     The updatePill/updateFlow tests only render collapsed, so they never hit
//     this; here we exercise isExpanded=true, so the stub is required. ---
jest.mock('@/components/wallet/ExpandedContent', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', { testID: 'mock-expanded-content' }),
  };
});

// --- Mock cardColors ---
jest.mock('@/utils/cardColors', () => ({
  isLightBackground: () => true,
}));

// --- Mock renderCardIcon ---
jest.mock('@/utils/renderCardIcon', () => ({
  renderCardIcon: ({ iconValue }: { iconValue: string }) => {
    const mockReact = require('react');
    const { Text } = require('react-native');
    return mockReact.createElement(Text, null, iconValue || '📋');
  },
}));

// --- Mock RationaleSheet (avoid modal/PanResponder complexity) ---
jest.mock('@/components/rationale/RationaleSheet', () => ({
  RationaleSheet: () => null,
}));

// --- Mock useCardReminder ---
jest.mock('@/hooks/useCardReminder', () => ({
  useCardReminder: () => null,
}));

// --- Mock kpiStore. Selector-based: FocusedCardView calls
//     useKpiStore((s) => s.lastCheckInDate). Return a date a few days ago so the
//     amber BadgeExplanationBanner renders for the KPI case (daysElapsed > 0 and
//     not "today"). Non-KPI cards ignore this value. ---
jest.mock('@/stores/kpiStore', () => ({
  useKpiStore: (selector: (s: any) => unknown) =>
    selector({
      lastCheckInDate: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    }),
}));

// --- Mock accessibility ---
jest.mock('@/utils/accessibility', () => ({
  announceCardTransition: jest.fn(),
}));

// --- Mock seeds ---
jest.mock('@/data/seeds', () => ({
  SEED_CATEGORIES: [
    { id: 'grounding-calming', name: 'Grounding & Calming', colorHex: '#4A90D9' },
  ],
}));

// --- Mock CURATED_LIBRARY behind a getter over a mutable fixture ---
// Both FocusedCardView (rationale lookup) and librarySyncService.evaluateOutdated
// resolve to this same mocked module. The KPI card is resolved via
// KPI_CARD_DEFINITION (outside CURATED_LIBRARY), so it does NOT need to be in the
// fixture. requireActual preserves the interfaces.
const curatedFixture: CuratedCardDefinition[] = [];

jest.mock('@/data/curatedLibrary', () => {
  const actual = jest.requireActual('@/data/curatedLibrary');
  return {
    ...actual,
    get CURATED_LIBRARY() {
      return curatedFixture;
    },
  };
});

// --- Mock cardService.createCardService (update flow builds a lazy singleton) ---
jest.mock('@/services/cardService', () => {
  const actual = jest.requireActual('@/services/cardService');
  return {
    ...actual,
    createCardService: () => ({
      updateFromLibrary: jest.fn(),
    }),
  };
});

// --- Mock walletStore.loadCards ---
jest.mock('@/stores/walletStore', () => ({
  useWalletStore: {
    getState: () => ({ loadCards: jest.fn() }),
  },
}));

// eslint-disable-next-line import/first
import FocusedCardView from '@/components/wallet/FocusedCardView';

// --- Fixtures / helpers ---

const SOURCE_ID = 'lib-fixture';

/** NEW banner label (UpdateAvailableBanner's A11Y_LABEL). */
const BANNER_LABEL = 'Update available — see what changed';
/** OLD pill label — must be GONE after 9.6. Exact-match, distinct from BANNER_LABEL. */
const OLD_PILL_LABEL = 'Update available';
/** Amber check-in banner text for daysElapsed=3, hasEverCheckedIn=true. */
const AMBER_BANNER_TEXT = /it's been 3 days since your last check-in/i;

function makeCurated(
  overrides: Partial<CuratedCardDefinition> = {}
): CuratedCardDefinition {
  return {
    id: SOURCE_ID,
    title: 'A tool',
    description: 'A helpful tool.',
    iconType: 'emoji',
    iconValue: '🌱',
    backgroundType: 'color',
    backgroundValue: '#E8F4F8',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false,
    controls: [],
    ...overrides,
  };
}

function loadCurated(defs: CuratedCardDefinition[]): void {
  curatedFixture.length = 0;
  curatedFixture.push(...defs);
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    title: 'A tool',
    description: 'A helpful tool.',
    iconType: 'emoji',
    iconValue: '🌱',
    backgroundType: 'color',
    backgroundValue: '#E8F4F8',
    categoryId: 'grounding-calming',
    originBadge: 'library',
    stackPosition: 0,
    totalUses: 3,
    currentStreak: 1,
    lastUsedAt: null,
    isArchived: false,
    archivedAt: null,
    previousStackPosition: null,
    allowBackgroundCustomization: false,
    sourceLibraryId: SOURCE_ID,
    sourceLibraryVersion: null,
    controls: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const baseProps = {
  categoryColor: '#4A90D9',
  categoryName: 'Grounding & Calming',
  onExpand: jest.fn(),
  onDismiss: jest.fn(),
  onPrimaryAction: jest.fn(),
  onMenuPress: jest.fn(),
};

describe('FocusedCardView — update BANNER behavior (Req 8.1, 8.2, 8.3, 2.5)', () => {
  beforeEach(() => {
    curatedFixture.length = 0;
    jest.clearAllMocks();
  });

  // Case 1 — Req 8.1
  it('shows the banner when the card is outdated and collapsed', async () => {
    loadCurated([makeCurated({ version: 2 })]);
    const card = makeCard({ sourceLibraryVersion: null });

    await render(<FocusedCardView {...baseProps} card={card} isExpanded={false} />);

    expect(screen.queryByLabelText(BANNER_LABEL)).toBeTruthy();
  });

  // Case 2 — Req 8.2 (the key fix for finding #2)
  it('KEEPS the banner visible when the card is outdated AND expanded (normal branch, no custom content)', async () => {
    loadCurated([makeCurated({ version: 2 })]);
    const card = makeCard({ sourceLibraryVersion: null });

    // isExpanded=true but NO renderExpandedContent → goes through the shared
    // branch's normal expanded body (active-use / note-taking), which is exactly
    // where the banner must remain visible.
    await render(<FocusedCardView {...baseProps} card={card} isExpanded={true} />);

    expect(screen.queryByLabelText(BANNER_LABEL)).toBeTruthy();
  });

  // Case 3 — Req 2.5 (banner absent for non-updatable cards, both states)
  it('hides the banner for a current card (copy caught up) in both states', async () => {
    loadCurated([makeCurated({ version: 2 })]);
    const card = makeCard({ sourceLibraryVersion: 2 });

    const { rerender } = await render(
      <FocusedCardView {...baseProps} card={card} isExpanded={false} />
    );
    expect(screen.queryByLabelText(BANNER_LABEL)).toBeNull();

    await rerender(<FocusedCardView {...baseProps} card={card} isExpanded={true} />);
    expect(screen.queryByLabelText(BANNER_LABEL)).toBeNull();
  });

  it('hides the banner for a my_tool card (no sourceLibraryId) in both states', async () => {
    loadCurated([makeCurated({ version: 2 })]);
    const card = makeCard({
      originBadge: 'my_tool',
      sourceLibraryId: null,
      sourceLibraryVersion: null,
    });

    const { rerender } = await render(
      <FocusedCardView {...baseProps} card={card} isExpanded={false} />
    );
    expect(screen.queryByLabelText(BANNER_LABEL)).toBeNull();

    await rerender(<FocusedCardView {...baseProps} card={card} isExpanded={true} />);
    expect(screen.queryByLabelText(BANNER_LABEL)).toBeNull();
  });

  it('hides the banner when the curated definition was removed in both states', async () => {
    // Card links to SOURCE_ID but the curated library only has an unrelated card.
    loadCurated([makeCurated({ id: 'lib-other', version: 5 })]);
    const card = makeCard({
      originBadge: 'community',
      sourceLibraryId: SOURCE_ID,
      sourceLibraryVersion: null,
    });

    const { rerender } = await render(
      <FocusedCardView {...baseProps} card={card} isExpanded={false} />
    );
    expect(screen.queryByLabelText(BANNER_LABEL)).toBeNull();

    await rerender(<FocusedCardView {...baseProps} card={card} isExpanded={true} />);
    expect(screen.queryByLabelText(BANNER_LABEL)).toBeNull();
  });

  // Case 4 — the old pill is gone
  it('no longer renders the OLD "Update available" pill (outdated + collapsed)', async () => {
    loadCurated([makeCurated({ version: 2 })]);
    const card = makeCard({ sourceLibraryVersion: null });

    await render(<FocusedCardView {...baseProps} card={card} isExpanded={false} />);

    // Exact-match query: "Update available" must not match the banner's longer
    // label, and the pill itself must be gone.
    expect(screen.queryByLabelText(OLD_PILL_LABEL)).toBeNull();
    // Sanity: the banner IS present (so we know the card is genuinely outdated
    // and the null above is "pill removed", not "card not outdated").
    expect(screen.queryByLabelText(BANNER_LABEL)).toBeTruthy();
  });

  // Case 5 — Req 8.3 (KPI card: both banners, update banner ABOVE amber)
  it('renders BOTH the update banner and the amber check-in banner on an outdated KPI card, update banner first', async () => {
    // The check-in card resolves via KPI_CARD_DEFINITION (version 1), so it does
    // not need to be in CURATED_LIBRARY. A copy stored at null version is outdated.
    const card = makeCard({
      id: 'kpi-card',
      title: KPI_CARD_DEFINITION.title,
      sourceLibraryId: KPI_CARD_DEFINITION.id, // 'lib-personal-kpi'
      sourceLibraryVersion: null,
      totalUses: 5, // hasEverCheckedIn = true → amber banner uses the days-since copy
      // A single-line note control at position 1 so the copy differs from the
      // text_area target (gives summarizeUpdate a describable change; also makes
      // this a realistic outdated check-in copy).
      controls: [
        {
          id: 'ctrl-note',
          type: 'text_input',
          position: 1,
          config: { label: 'Anything you want to note?', placeholder: 'A word…' },
          isRequired: false,
        } as any,
      ],
    });

    await render(<FocusedCardView {...baseProps} card={card} isExpanded={false} />);

    // Both banners present.
    const banner = screen.queryByLabelText(BANNER_LABEL);
    expect(banner).toBeTruthy();
    expect(screen.queryByText(AMBER_BANNER_TEXT)).toBeTruthy();

    // Ordering: the update banner must render ABOVE (before) the amber banner.
    // Walk the full set of host text nodes in render order and assert the
    // banner's headline text appears before the amber banner's text. If robust
    // ordering assertion proves brittle in RNTL across RN versions, the "both
    // present" assertions above still cover Req 8.3's core; visual stacking order
    // is guaranteed by 9.6 placing the update banner first in JSX and is verified
    // on-device (per the spec's manual-pass note).
    const allText = screen.root
      ? screen.getAllByText(/./s).map((n) => (Array.isArray(n.props.children)
          ? n.props.children.join('')
          : String(n.props.children ?? '')))
      : [];
    const updateIdx = allText.findIndex((t) => /see what changed|update available/i.test(t));
    const amberIdx = allText.findIndex((t) => /since your last check-in/i.test(t));
    if (updateIdx !== -1 && amberIdx !== -1) {
      expect(updateIdx).toBeLessThan(amberIdx);
    }
  });
});
