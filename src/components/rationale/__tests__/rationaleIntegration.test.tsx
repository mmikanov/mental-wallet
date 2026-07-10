/**
 * Integration tests for rationale entry point rendering across different contexts.
 *
 * Tests verify the RationaleEntryPoint renders (or is hidden) in:
 * - FocusedCardView (focused state: visible; expanded state: hidden)
 * - CardPreviewSheet (library browser preview)
 * - ToolPreviewCard (session tool preview)
 *
 * Validates: Requirements 2.6, 2.7
 */

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
    withSpring: (val: any) => val,
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

// --- Mock RationaleSheet to avoid complex modal/PanResponder dependencies ---
jest.mock('@/components/rationale/RationaleSheet', () => ({
  RationaleSheet: () => null,
}));

// --- Mock @react-navigation/native ---
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

// --- Mock ControlRenderer ---
jest.mock('@/components/controls/ControlRenderer', () => ({
  __esModule: true,
  default: () => null,
}));

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

// --- Mock CURATED_LIBRARY with a card that has rationale ---
const mockRationale = {
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
      emotionTags: ['anxious'],
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

// --- Mock seeds ---
jest.mock('@/data/seeds', () => ({
  SEED_CATEGORIES: [
    { id: 'grounding-calming', name: 'Grounding & Calming', colorHex: '#4A90D9' },
  ],
}));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { RationaleMetadata } from '@/types/rationale';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import type { Card } from '@/types/index';
import FocusedCardView from '@/components/wallet/FocusedCardView';
import CardPreviewSheet from '@/components/wallet/CardPreviewSheet';
import ToolPreviewCard from '@/components/session/ToolPreviewCard';

// --- Test fixtures ---

const TEST_RATIONALE: RationaleMetadata = {
  approach: 'grounding',
  inANutshell: 'Redirects attention from anxious thoughts to present-moment sensory input.',
  howItWorks: 'Grounding exercises engage the prefrontal cortex by asking it to categorize sensory data.',
  evidenceLevel: 'moderate',
  researchSummary: [
    'Grounding techniques are widely used in trauma-informed care.',
    'Research suggests sensory-based interventions may reduce acute distress.',
  ],
};

const mockCard: Card = {
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

const mockCuratedCard: CuratedCardDefinition = {
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
  emotionTags: ['anxious'],
  rationale: TEST_RATIONALE,
};

// --- Tests ---

describe('Rationale Integration - ToolPreviewCard', () => {
  it('renders "Learn more" when rationale and rationaleInANutshell are provided', async () => {
    await render(
      <ToolPreviewCard
        cardId="tool-1"
        title="Grounding Tool"
        description="A grounding exercise"
        iconValue="🌿"
        source="library"
        onPress={jest.fn()}
        rationale={TEST_RATIONALE}
        rationaleInANutshell={TEST_RATIONALE.inANutshell}
      />
    );

    expect(screen.getByText(/Learn more/)).toBeTruthy();
  });

  it('does NOT render "Learn more" when no rationale prop is provided', async () => {
    await render(
      <ToolPreviewCard
        cardId="tool-2"
        title="My Custom Tool"
        description="A custom tool"
        iconValue="📋"
        source="wallet"
        onPress={jest.fn()}
      />
    );

    expect(screen.queryByText(/Learn more/)).toBeNull();
  });

  it('does NOT render "Learn more" when rationale is provided but rationaleInANutshell is undefined', async () => {
    await render(
      <ToolPreviewCard
        cardId="tool-3"
        title="Partial Tool"
        description="A partial tool"
        iconValue="📋"
        source="library"
        onPress={jest.fn()}
        rationale={TEST_RATIONALE}
        rationaleInANutshell={undefined}
      />
    );

    expect(screen.queryByText(/Learn more/)).toBeNull();
  });
});

describe('Rationale Integration - CardPreviewSheet', () => {
  it('renders "Learn more" when card has rationale', async () => {
    await render(
      <CardPreviewSheet
        card={mockCuratedCard}
        visible={true}
        onDismiss={jest.fn()}
        buttonState={{ label: 'Add to wallet', disabled: false, action: 'add' }}
        onAddToWallet={jest.fn().mockResolvedValue(undefined)}
        onRestore={jest.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText(/Learn more/)).toBeTruthy();
  });

  it('does NOT render "Learn more" when card has no rationale', async () => {
    const cardWithoutRationale: CuratedCardDefinition = {
      ...mockCuratedCard,
      rationale: undefined,
    };

    await render(
      <CardPreviewSheet
        card={cardWithoutRationale}
        visible={true}
        onDismiss={jest.fn()}
        buttonState={{ label: 'Add to wallet', disabled: false, action: 'add' }}
        onAddToWallet={jest.fn().mockResolvedValue(undefined)}
        onRestore={jest.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText(/Learn more/)).toBeNull();
  });
});

describe('Rationale Integration - FocusedCardView', () => {
  const defaultFocusedProps = {
    card: mockCard,
    categoryColor: '#4A90D9',
    categoryName: 'Grounding & Calming',
    isExpanded: false,
    onExpand: jest.fn(),
    onDismiss: jest.fn(),
    onPrimaryAction: jest.fn(),
    onMenuPress: jest.fn(),
  };

  it('renders "Learn more" in focused (non-expanded) state when rationale present', async () => {
    await render(<FocusedCardView {...defaultFocusedProps} />);

    expect(screen.getByText(/Learn more/)).toBeTruthy();
  });

  it('renders "Learn more" in expanded state too (description is always visible)', async () => {
    await render(<FocusedCardView {...defaultFocusedProps} isExpanded={true} />);

    expect(screen.getByText(/Learn more/)).toBeTruthy();
  });

  it('does NOT render "Learn more" when card has no sourceLibraryId', async () => {
    const cardWithoutSource: Card = {
      ...mockCard,
      sourceLibraryId: undefined,
    };

    await render(<FocusedCardView {...defaultFocusedProps} card={cardWithoutSource} />);

    expect(screen.queryByText(/Learn more/)).toBeNull();
  });
});
