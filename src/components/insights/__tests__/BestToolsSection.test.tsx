/**
 * Unit tests for BestToolsSection component.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.8, 6.9, 9.2
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BestToolsSection } from '../BestToolsSection';
import type { BestToolEntry } from '@/services/correlationEngine';
import type { InsightTier, TierProgress } from '@/services/tierEvaluator';

// Mock InsightTooltip to avoid Modal state leakage between tests
jest.mock('../InsightTooltip', () => ({
  InsightTooltip: ({ explanation }: { explanation: string }) => {
    const { Text } = require('react-native');
    return <Text testID="insight-tooltip-trigger">ⓘ</Text>;
  },
}));

describe('BestToolsSection', () => {
  const mockTierProgress: TierProgress = {
    currentTier: 'nascent',
    checkInCount: 4,
    toolUseCount: 3,
    distinctToolCount: 1,
    nextTier: 'preliminary',
    checkInsNeeded: 3,
    toolUsesNeeded: 2,
    distinctToolsNeeded: 1,
  };

  const mockBestTools: BestToolEntry[] = [
    {
      cardId: 'card-1',
      cardTitle: 'Deep Breathing',
      scoreDelta: 1.2,
      avgDurationSec: 180,
      descriptorLabel: 'Linked to +1.2 higher check-in days',
      isHedged: false,
    },
    {
      cardId: 'card-2',
      cardTitle: 'Gratitude Journal',
      scoreDelta: 0.8,
      avgDurationSec: 240,
      descriptorLabel: 'Linked to +0.8 higher check-in days',
      isHedged: false,
    },
    {
      cardId: 'card-3',
      cardTitle: 'Body Scan',
      scoreDelta: 0.5,
      avgDurationSec: 300,
      descriptorLabel: 'Linked to +0.5 higher check-in days',
      isHedged: false,
    },
  ];

  const mockHedgedTools: BestToolEntry[] = [
    {
      cardId: 'card-1',
      cardTitle: 'Deep Breathing',
      scoreDelta: 1.2,
      avgDurationSec: 180,
      descriptorLabel: 'Might be linked to higher check-in days — keep using to confirm',
      isHedged: true,
    },
    {
      cardId: 'card-2',
      cardTitle: 'Gratitude Journal',
      scoreDelta: 0.8,
      avgDurationSec: 240,
      descriptorLabel: 'Might be linked to higher check-in days — keep using to confirm',
      isHedged: true,
    },
  ];

  describe('Empty state (below_nascent/nascent or empty bestTools)', () => {
    it('shows empty state at below_nascent tier', async () => {
      const tierProgress: TierProgress = {
        ...mockTierProgress,
        currentTier: 'below_nascent',
        nextTier: 'nascent',
      };

      const result = await render(
        <BestToolsSection
          bestTools={[]}
          tier="below_nascent"
          tierProgress={tierProgress}
          onExploreTools={jest.fn()}
        />
      );

      expect(result.getByText('Building your ranking')).toBeTruthy();
      expect(result.getByTestId('best-tools-empty-state')).toBeTruthy();
    });

    it('shows empty state at nascent tier', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={[]}
          tier="nascent"
          tierProgress={mockTierProgress}
          onExploreTools={jest.fn()}
        />
      );

      expect(result.getByText('Building your ranking')).toBeTruthy();
    });

    it('shows narrow-period empty state when bestTools is empty at preliminary tier', async () => {
      const tierProgress: TierProgress = {
        ...mockTierProgress,
        currentTier: 'preliminary',
        nextTier: 'confident',
      };

      const result = await render(
        <BestToolsSection
          bestTools={[]}
          tier="preliminary"
          tierProgress={tierProgress}
          onExploreTools={jest.fn()}
        />
      );

      expect(result.getByText('Not enough activity in this time range to rank tools. Try a longer period.')).toBeTruthy();
      // Should NOT show "Building your ranking" for preliminary tier with empty tools
      expect(result.queryByText('Building your ranking')).toBeNull();
    });

    it('shows narrow-period empty state when bestTools is empty at confident tier', async () => {
      const tierProgress: TierProgress = {
        ...mockTierProgress,
        currentTier: 'confident',
      };

      const result = await render(
        <BestToolsSection
          bestTools={[]}
          tier="confident"
          tierProgress={tierProgress}
          onExploreTools={jest.fn()}
        />
      );

      expect(result.getByText('Not enough activity in this time range to rank tools. Try a longer period.')).toBeTruthy();
      expect(result.queryByText('Building your ranking')).toBeNull();
      // No CTA button in narrow-period empty state
      expect(result.queryByText('Explore your tools →')).toBeNull();
    });

    it('shows progress text with remaining counts', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={[]}
          tier="nascent"
          tierProgress={mockTierProgress}
          onExploreTools={jest.fn()}
        />
      );

      expect(result.getByText(/Use tools 2 more times/)).toBeTruthy();
    });

    it('does not show CTA when onExploreTools is not provided', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={[]}
          tier="nascent"
          tierProgress={mockTierProgress}
        />
      );

      expect(result.queryByText('Explore your tools →')).toBeNull();
    });

    it('handles null tierProgress gracefully', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={[]}
          tier="nascent"
          tierProgress={null}
          onExploreTools={jest.fn()}
        />
      );

      expect(
        result.getByText('Use more tools to start seeing which ones help most')
      ).toBeTruthy();
    });
  });

  describe('Ranked list (preliminary tier)', () => {
    it('shows ranked list of tools', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockHedgedTools}
          tier="preliminary"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      expect(result.getByTestId('best-tools-ranked-list')).toBeTruthy();
      expect(result.getByText('Deep Breathing')).toBeTruthy();
      expect(result.getByText('Gratitude Journal')).toBeTruthy();
    });

    it('shows "Early pattern" badge at preliminary tier', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockHedgedTools}
          tier="preliminary"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      expect(result.getByTestId('early-pattern-badge')).toBeTruthy();
      expect(result.getByText('Early pattern')).toBeTruthy();
    });

    it('displays rank numbers', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockHedgedTools}
          tier="preliminary"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      expect(result.getByText('1')).toBeTruthy();
      expect(result.getByText('2')).toBeTruthy();
    });

    it('displays descriptor labels', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockHedgedTools}
          tier="preliminary"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      expect(
        result.getAllByText('Might be linked to higher check-in days — keep using to confirm')
      ).toHaveLength(2);
    });
  });

  describe('Ranked list (confident tier)', () => {
    it('does not show "Early pattern" badge at confident tier', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockBestTools}
          tier="confident"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      expect(result.queryByTestId('early-pattern-badge')).toBeNull();
    });

    it('shows all provided tools with confident descriptors', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockBestTools}
          tier="confident"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      expect(result.getByText('Deep Breathing')).toBeTruthy();
      expect(result.getByText('Gratitude Journal')).toBeTruthy();
      expect(result.getByText('Body Scan')).toBeTruthy();
      expect(result.getByText('Linked to +1.2 higher check-in days')).toBeTruthy();
      expect(result.getByText('Linked to +0.8 higher check-in days')).toBeTruthy();
      expect(result.getByText('Linked to +0.5 higher check-in days')).toBeTruthy();
    });

    it('renders rank numbers 1 through N', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockBestTools}
          tier="confident"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      expect(result.getByText('1')).toBeTruthy();
      expect(result.getByText('2')).toBeTruthy();
      expect(result.getByText('3')).toBeTruthy();
    });
  });

  describe('Section header', () => {
    it('displays "Best Tools for You" title', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockBestTools}
          tier="confident"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      expect(result.getByText('Best Tools for You')).toBeTruthy();
    });

    it('shows tooltip when ranked list is visible', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockBestTools}
          tier="confident"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      expect(result.getByTestId('best-tools-section')).toBeTruthy();
      expect(result.getByTestId('insight-tooltip-trigger')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('each tool entry announces rank, name, and descriptor', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockBestTools}
          tier="confident"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      const firstEntry = result.getByTestId('best-tool-entry-1');
      expect(firstEntry.props.accessibilityLabel).toContain('Rank 1');
      expect(firstEntry.props.accessibilityLabel).toContain('Deep Breathing');
      expect(firstEntry.props.accessibilityLabel).toContain('Linked to');
    });

    it('includes "Early pattern" prefix in accessibility label for hedged tools', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={mockHedgedTools}
          tier="preliminary"
          tierProgress={mockTierProgress}
          onToolPress={jest.fn()}
        />
      );

      const firstEntry = result.getByTestId('best-tool-entry-1');
      expect(firstEntry.props.accessibilityLabel).toContain('Early pattern');
    });

    it('CTA has proper accessibility label', async () => {
      const result = await render(
        <BestToolsSection
          bestTools={[]}
          tier="nascent"
          tierProgress={mockTierProgress}
          onExploreTools={jest.fn()}
        />
      );

      expect(
        result.getByLabelText('Explore your tools. Navigate to your wallet.')
      ).toBeTruthy();
    });
  });

  // Interaction tests placed last — fireEvent.press can corrupt
  // the test environment's render tree in react-native-testing-library v14
  describe('Interactions', () => {
    it('calls onExploreTools when CTA is tapped', async () => {
      const onExploreTools = jest.fn();

      const result = await render(
        <BestToolsSection
          bestTools={[]}
          tier="nascent"
          tierProgress={mockTierProgress}
          onExploreTools={onExploreTools}
        />
      );

      fireEvent.press(result.getByText('Explore your tools →'));
      expect(onExploreTools).toHaveBeenCalled();
    });

    it('calls onToolPress with cardId when tool entry is tapped', async () => {
      const onToolPress = jest.fn();

      const result = await render(
        <BestToolsSection
          bestTools={mockHedgedTools}
          tier="preliminary"
          tierProgress={mockTierProgress}
          onToolPress={onToolPress}
        />
      );

      fireEvent.press(result.getByTestId('best-tool-entry-1'));
      expect(onToolPress).toHaveBeenCalledWith('card-1');

      fireEvent.press(result.getByTestId('best-tool-entry-2'));
      expect(onToolPress).toHaveBeenCalledWith('card-2');
    });
  });
});
