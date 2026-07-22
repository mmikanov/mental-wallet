/**
 * Preservation Property Tests — Crisis Link Navigation from Non-Session Surfaces Unchanged
 *
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
 *
 * Property 6: Preservation — Crisis Link Navigation from Non-Session Surfaces Unchanged
 *
 * These tests verify that crisis link behaviors on surfaces OTHER than
 * LibraryToolPreview remain unchanged after the Bug 3 fix:
 *
 * 1. CardPreviewSheet (Library Browser): crisis link dismisses preview and
 *    calls `onCrisisResourcesPress` prop (existing working behavior)
 * 2. FocusedCardView (Wallet): crisis link navigates to CrisisResources
 *    via `useNavigation()` (existing working behavior)
 * 3. Dismissing rationale sheet via close button (without tapping crisis link)
 *    only closes the sheet — no navigation (existing behavior)
 * 4. Non-distress cards do NOT show the "In crisis?" link in rationale sheet
 *
 * On UNFIXED code: All tests PASS (confirming baseline behavior to preserve).
 */

import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as fc from 'fast-check';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import type { RationaleMetadata } from '@/types/rationale';
import type { EmotionType } from '@/types/index';

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
        onUpdate: function () { return this; },
        onEnd: function () { return this; },
      }),
    },
    GestureDetector: ({ children }: any) =>
      mockReact.createElement('View', null, children),
  };
});

// --- Mock @react-navigation/native ---
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// --- Mock ControlRenderer ---
jest.mock('@/components/controls/ControlRenderer', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', { testID: 'mock-control-renderer' }),
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

// --- Mock useCardReminder ---
jest.mock('@/hooks/useCardReminder', () => ({
  useCardReminder: () => null,
}));

// --- Mock accessibility ---
jest.mock('@/utils/accessibility', () => ({
  announceCardTransition: jest.fn(),
}));

// --- Mock kpiStore ---
jest.mock('@/stores/kpiStore', () => ({
  useKpiStore: jest.fn(() => null),
}));

// --- Mock seeds ---
jest.mock('@/data/seeds', () => ({
  SEED_CATEGORIES: [
    { id: 'grounding-calming', name: 'Grounding & Calming', colorHex: '#4A90D9' },
    { id: 'body-sensory', name: 'Body & Sensory', colorHex: '#E57373' },
  ],
}));

// --- Mock CURATED_LIBRARY (needed by FocusedCardView) ---
const MOCK_DISTRESS_RATIONALE: RationaleMetadata = {
  approach: 'grounding',
  inANutshell: 'Redirects attention from anxious thoughts to present-moment sensory input.',
  howItWorks: 'Grounding exercises engage the prefrontal cortex by asking it to categorize sensory data.',
  evidenceLevel: 'moderate',
  researchSummary: [
    'Grounding techniques are widely used in trauma-informed care.',
    'Research suggests sensory-based interventions may reduce acute distress.',
  ],
};

jest.mock('@/data/curatedLibrary', () => ({
  CURATED_LIBRARY: [
    {
      id: 'lib-grounding-54321',
      title: '5-4-3-2-1 Grounding',
      description: 'Use your senses to anchor yourself.',
      iconType: 'emoji',
      iconValue: '🌿',
      backgroundType: 'color',
      backgroundValue: '#E8F4F8',
      categoryId: 'grounding-calming',
      allowBackgroundCustomization: true,
      controls: [],
      emotionTags: ['anxious', 'stressed'],
      rationale: {
        approach: 'grounding',
        inANutshell: 'Redirects attention from anxious thoughts to present-moment sensory input.',
        howItWorks: 'Grounding exercises engage the prefrontal cortex by asking it to categorize sensory data.',
        evidenceLevel: 'moderate',
        researchSummary: [
          'Grounding techniques are widely used in trauma-informed care.',
          'Research suggests sensory-based interventions may reduce acute distress.',
        ],
      },
    },
  ],
}));

import CardPreviewSheet from '@/components/wallet/CardPreviewSheet';
import FocusedCardView from '@/components/wallet/FocusedCardView';
import { RationaleSheet } from '@/components/rationale/RationaleSheet';
import type { Card } from '@/types/index';

// --- Test fixtures ---

const DISTRESS_CARD_DEFINITION: CuratedCardDefinition = {
  id: 'lib-grounding-54321',
  title: '5-4-3-2-1 Grounding',
  description: 'Use your senses to anchor yourself.',
  iconType: 'emoji',
  iconValue: '🌿',
  backgroundType: 'color',
  backgroundValue: '#E8F4F8',
  categoryId: 'grounding-calming',
  allowBackgroundCustomization: true,
  controls: [],
  emotionTags: ['anxious', 'stressed'],
  rationale: MOCK_DISTRESS_RATIONALE,
};

const WALLET_CARD: Card = {
  id: 'card-1',
  title: '5-4-3-2-1 Grounding',
  description: 'Use your senses to anchor yourself.',
  iconType: 'emoji',
  iconValue: '🌿',
  backgroundType: 'color',
  backgroundValue: '#E8F4F8',
  categoryId: 'grounding-calming',
  originBadge: 'library',
  stackPosition: 0,
  totalUses: 5,
  currentStreak: 2,
  lastUsedAt: null,
  isArchived: false,
  archivedAt: null,
  previousStackPosition: null,
  allowBackgroundCustomization: true,
  controls: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  sourceLibraryId: 'lib-grounding-54321',
};

// --- fast-check arbitraries ---

/** All non-distress emotions (crisis link should NOT appear for these).
 * Note: The distress check in CardPreviewSheet/FocusedCardView uses
 * ['anxious', 'angry', 'stressed'] — only those three trigger isDistressRelated.
 */
const NON_DISTRESS_EMOTIONS: EmotionType[] = [
  'sad', 'overwhelmed', 'hopeless',
  'numb', 'lonely', 'ashamed', 'guilty', 'calm', 'curious',
];

/** Generate valid RationaleMetadata */
const arbRationale: fc.Arbitrary<RationaleMetadata> = fc.record({
  approach: fc.constantFrom(
    'CBT' as const,
    'DBT' as const,
    'ACT' as const,
    'mindfulness-based stress reduction' as const,
    'grounding' as const,
    'somatic techniques' as const
  ),
  inANutshell: fc.string({ minLength: 10, maxLength: 200 }),
  howItWorks: fc.string({ minLength: 10, maxLength: 400 }),
  evidenceLevel: fc.constantFrom(
    'strong' as const,
    'moderate' as const,
    'emerging' as const,
    'not_specifically_studied' as const
  ),
  researchSummary: fc.tuple(
    fc.string({ minLength: 5, maxLength: 150 }),
    fc.string({ minLength: 5, maxLength: 150 })
  ) as fc.Arbitrary<[string, string]>,
  learnMoreLinks: fc.constant(undefined),
});

/**
 * Generate non-distress CuratedCardDefinition objects.
 * These have emotionTags that do NOT include 'anxious', 'angry', or 'stressed',
 * meaning isDistressRelated will be false and crisis link should NOT render.
 */
const arbNonDistressCard: fc.Arbitrary<CuratedCardDefinition> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).map(
    (s) => `lib-calm-${s.replace(/[^a-z0-9]/gi, 'x')}`
  ),
  title: fc.string({ minLength: 1, maxLength: 40 }),
  description: fc.string({ minLength: 1, maxLength: 150 }),
  iconType: fc.constant('emoji' as const),
  iconValue: fc.constantFrom('🧘', '📖', '🎵', '☀️', '🌈'),
  backgroundType: fc.constant('color' as const),
  backgroundValue: fc.constantFrom('#E8F5E9', '#F0F9FF', '#FFF8E1'),
  categoryId: fc.constantFrom('grounding-calming', 'body-sensory'),
  allowBackgroundCustomization: fc.boolean(),
  controls: fc.constant([]),
  emotionTags: fc
    .subarray(NON_DISTRESS_EMOTIONS, { minLength: 1, maxLength: 3 })
    .map((tags) => tags as EmotionType[]),
  contextTags: fc.constant(['alone_at_home'] as any),
  timeTags: fc.constant(['5_10_min'] as any),
  rationale: arbRationale,
});

// --- Tests ---

describe('Preservation: Crisis Link Navigation from Non-Session Surfaces Unchanged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 9.1**
   *
   * Test: CardPreviewSheet (Library Browser) crisis link still triggers
   * `onCrisisResourcesPress` prop when the user taps "In crisis? Get support →".
   *
   * This verifies the existing working behavior in CardPreviewSheet.
   * On UNFIXED code: PASSES (this surface already navigates correctly).
   */
  it('CardPreviewSheet crisis link triggers onCrisisResourcesPress prop', async () => {
    const mockOnCrisisResourcesPress = jest.fn();
    const mockOnDismiss = jest.fn();

    await render(
      <CardPreviewSheet
        card={DISTRESS_CARD_DEFINITION}
        visible={true}
        onDismiss={mockOnDismiss}
        buttonState={{ label: 'Add to wallet', disabled: false, action: 'add' }}
        onAddToWallet={jest.fn().mockResolvedValue(undefined)}
        onRestore={jest.fn().mockResolvedValue(undefined)}
        onCrisisResourcesPress={mockOnCrisisResourcesPress}
      />
    );

    // Open the rationale sheet by pressing "Learn more"
    const learnMoreButton = screen.getByText(/Learn more/);
    fireEvent.press(learnMoreButton);

    // Find and tap the crisis link
    await waitFor(() => {
      screen.getByText('In crisis? Get support →');
    });
    const crisisLink = screen.getByText('In crisis? Get support →');
    fireEvent.press(crisisLink);

    // ASSERTION: onCrisisResourcesPress prop was called
    expect(mockOnCrisisResourcesPress).toHaveBeenCalledTimes(1);
  });

  /**
   * **Validates: Requirements 9.2**
   *
   * Test: FocusedCardView (Wallet) crisis link navigates to CrisisResources
   * via `useNavigation().navigate('CrisisResources')`.
   *
   * This verifies the existing working behavior in FocusedCardView.
   * On UNFIXED code: PASSES (this surface already navigates correctly).
   */
  it('FocusedCardView crisis link navigates via useNavigation()', async () => {
    await render(
      <FocusedCardView
        card={WALLET_CARD}
        categoryColor="#4A90D9"
        categoryName="Grounding & Calming"
        isExpanded={false}
        onExpand={jest.fn()}
        onDismiss={jest.fn()}
        onPrimaryAction={jest.fn()}
        onMenuPress={jest.fn()}
      />
    );

    // Open the rationale sheet by pressing "Learn more"
    const learnMoreButton = screen.getByText(/Learn more/);
    fireEvent.press(learnMoreButton);

    // Find and tap the crisis link
    await waitFor(() => {
      screen.getByText('In crisis? Get support →');
    });
    const crisisLink = screen.getByText('In crisis? Get support →');
    fireEvent.press(crisisLink);

    // ASSERTION: navigation.navigate('CrisisResources') was called
    expect(mockNavigate).toHaveBeenCalledWith('CrisisResources');
  });

  /**
   * **Validates: Requirements 9.3**
   *
   * Test: Dismissing rationale sheet via close button (without tapping crisis link)
   * does NOT trigger navigation. Only the sheet is closed.
   *
   * On UNFIXED code: PASSES (closing the sheet without tapping crisis link
   * never triggered navigation).
   */
  it('dismissing rationale sheet (close button) does NOT trigger navigation', async () => {
    const mockOnCrisisResourcesPress = jest.fn();
    const mockOnDismiss = jest.fn();

    await render(
      <RationaleSheet
        visible={true}
        rationale={MOCK_DISTRESS_RATIONALE}
        cardTitle="5-4-3-2-1 Grounding"
        isDistressRelated={true}
        onDismiss={mockOnDismiss}
        onCrisisResourcesPress={mockOnCrisisResourcesPress}
      />
    );

    // Find the close button and tap it
    const closeButton = screen.getByLabelText('Close');
    fireEvent.press(closeButton);

    // ASSERTION: onDismiss was called (sheet closed)
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);

    // ASSERTION: onCrisisResourcesPress was NOT called (no navigation)
    expect(mockOnCrisisResourcesPress).not.toHaveBeenCalled();

    // Also verify navigation.navigate was not called
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  /**
   * **Validates: Requirements 9.4**
   *
   * Property-based test: For all non-distress CuratedCardDefinition objects
   * (emotionTags that do NOT include 'anxious', 'angry', or 'stressed'),
   * the "In crisis? Get support →" link is NOT rendered in the rationale sheet.
   *
   * On UNFIXED code: PASSES (the `isDistressRelated` check in RationaleSheet
   * already correctly hides the crisis link for non-distress cards).
   */
  it('non-distress cards do NOT show crisis link in rationale sheet (property-based)', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonDistressCard, async (generatedCard) => {
        // Determine isDistressRelated the same way the components do
        const isDistressRelated =
          generatedCard.emotionTags?.some((tag) =>
            ['anxious', 'angry', 'stressed'].includes(tag)
          ) ?? false;

        // Render RationaleSheet directly with the computed isDistressRelated flag
        await render(
          <RationaleSheet
            visible={true}
            rationale={generatedCard.rationale!}
            cardTitle={generatedCard.title}
            isDistressRelated={isDistressRelated}
            onDismiss={jest.fn()}
            onCrisisResourcesPress={jest.fn()}
          />
        );

        // ASSERTION: Crisis link should NOT be rendered for non-distress cards
        expect(screen.queryByText('In crisis? Get support →')).toBeNull();
      }),
      { numRuns: 30 }
    );
  });
});
