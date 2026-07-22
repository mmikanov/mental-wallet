/**
 * Unit tests for OutcomeTrendsSection component.
 *
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.8
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OutcomeTrendsSection } from '../OutcomeTrendsSection';
import type { TierProgress } from '@/services/tierEvaluator';
import type { WalletCorrelationResult } from '@/services/correlationEngine';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

const mockTierProgress: TierProgress = {
  currentTier: 'nascent',
  checkInCount: 5,
  toolUseCount: 4,
  distinctToolCount: 2,
  nextTier: 'preliminary',
  checkInsNeeded: 2,
  toolUsesNeeded: 1,
  distinctToolsNeeded: 0,
};

const mockWalletCorrelation: WalletCorrelationResult = {
  weeklyAvgScore: [5.2, 6.1, 6.8, 7.3],
  weeklyTotalDurationMin: [15, 22, 30, 28],
  overallTrend: 'positive',
  summaryText: 'Weeks where you practiced more tended to have higher check-in scores.',
};

describe('OutcomeTrendsSection', () => {
  describe('below_nascent tier', () => {
    it('renders tier progress teaser with section title', async () => {
      await render(
        <OutcomeTrendsSection
          tier="below_nascent"
          tierProgress={{ ...mockTierProgress, currentTier: 'below_nascent', nextTier: 'nascent' }}
          walletCorrelation={null}
        />
      );

      expect(screen.getByText('Outcome Trends')).toBeTruthy();
      expect(screen.getByTestId('outcome-trends-below-nascent')).toBeTruthy();
    });

    it('shows TierProgressCard when tierProgress is provided', async () => {
      await render(
        <OutcomeTrendsSection
          tier="below_nascent"
          tierProgress={{ ...mockTierProgress, currentTier: 'below_nascent', nextTier: 'nascent', checkInsNeeded: 2, toolUsesNeeded: 1 }}
          walletCorrelation={null}
        />
      );

      // TierProgressCard renders progress bars or remaining items
      expect(screen.getByText(/check-in/i)).toBeTruthy();
    });
  });

  describe('nascent tier', () => {
    it('renders "Your journey so far" title', async () => {
      await render(
        <OutcomeTrendsSection
          tier="nascent"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      expect(screen.getByText('Your journey so far')).toBeTruthy();
      expect(screen.getByTestId('outcome-trends-nascent')).toBeTruthy();
    });

    it('displays simple activity summary with check-in and practice counts', async () => {
      await render(
        <OutcomeTrendsSection
          tier="nascent"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      // counts come from tierProgress: checkInCount=5, toolUseCount=4
      expect(screen.getByText(/You've checked in 5 times and practiced 4 times/)).toBeTruthy();
    });

    it('displays encouragement CTA text', async () => {
      await render(
        <OutcomeTrendsSection
          tier="nascent"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      expect(
        screen.getByText("Keep it up — a few more days and we'll start spotting patterns for you")
      ).toBeTruthy();
    });

    it('renders tappable wallet link when onNavigateToWallet provided', async () => {
      const onNavigate = jest.fn();
      await render(
        <OutcomeTrendsSection
          tier="nascent"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
          onNavigateToWallet={onNavigate}
        />
      );

      const ctaButton = screen.getByTestId('outcome-trends-nascent-cta');
      fireEvent.press(ctaButton);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('does not render CTA button when onNavigateToWallet is not provided', async () => {
      await render(
        <OutcomeTrendsSection
          tier="nascent"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      expect(screen.queryByTestId('outcome-trends-nascent-cta')).toBeNull();
    });

    it('handles singular count (1 time)', async () => {
      const singleCorrelation: WalletCorrelationResult = {
        weeklyAvgScore: [5.5],
        weeklyTotalDurationMin: [10],
        overallTrend: 'neutral',
        summaryText: 'Just getting started.',
      };

      const singleTierProgress: TierProgress = {
        ...mockTierProgress,
        checkInCount: 1,
        toolUseCount: 1,
      };

      await render(
        <OutcomeTrendsSection
          tier="nascent"
          tierProgress={singleTierProgress}
          walletCorrelation={singleCorrelation}
        />
      );

      expect(screen.getByText(/You've checked in 1 time and practiced 1 time/)).toBeTruthy();
    });
  });

  describe('preliminary tier', () => {
    it('renders "Outcome Trends" title with "Early pattern" badge', async () => {
      await render(
        <OutcomeTrendsSection
          tier="preliminary"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      expect(screen.getByText('Outcome Trends')).toBeTruthy();
      expect(screen.getByText('Early pattern')).toBeTruthy();
      expect(screen.getByTestId('outcome-trends-preliminary')).toBeTruthy();
    });

    it('displays summary text from walletCorrelation', async () => {
      await render(
        <OutcomeTrendsSection
          tier="preliminary"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      expect(
        screen.getByText('Weeks where you practiced more tended to have higher check-in scores.')
      ).toBeTruthy();
    });

    it('shows fallback hedged text when walletCorrelation is null', async () => {
      await render(
        <OutcomeTrendsSection
          tier="preliminary"
          tierProgress={mockTierProgress}
          walletCorrelation={null}
        />
      );

      expect(
        screen.getByText('Early signs: days you practice tend to have slightly higher check-in scores')
      ).toBeTruthy();
    });

    it('displays "Tools you\'ve been using" section', async () => {
      await render(
        <OutcomeTrendsSection
          tier="preliminary"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      expect(screen.getByText("Tools you've been using")).toBeTruthy();
    });
  });

  describe('confident tier', () => {
    it('renders "Outcome Trends" title with full summary', async () => {
      await render(
        <OutcomeTrendsSection
          tier="confident"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      expect(screen.getByText('Outcome Trends')).toBeTruthy();
      // Summary text appears in the confidentSummary text element
      expect(
        screen.getByText('Weeks where you practiced more tended to have higher check-in scores.')
      ).toBeTruthy();
      expect(screen.getByTestId('outcome-trends-confident')).toBeTruthy();
    });

    it('renders DualAxisChart with correlation data', async () => {
      await render(
        <OutcomeTrendsSection
          tier="confident"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      // DualAxisChart should render relative week labels and legend
      expect(screen.getByText('-3w')).toBeTruthy();
      expect(screen.getByText('Now')).toBeTruthy();
      expect(screen.getByText('Check-in score')).toBeTruthy();
      expect(screen.getByText('Practice time')).toBeTruthy();
    });

    it('shows empty state when walletCorrelation is null', async () => {
      await render(
        <OutcomeTrendsSection
          tier="confident"
          tierProgress={mockTierProgress}
          walletCorrelation={null}
        />
      );

      expect(screen.getByTestId('outcome-trends-confident-empty')).toBeTruthy();
      expect(screen.getByText('Unable to load trend data')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('marks section titles with header role', async () => {
      await render(
        <OutcomeTrendsSection
          tier="nascent"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
        />
      );

      const header = screen.getByRole('header', { name: 'Your journey so far' });
      expect(header).toBeTruthy();
    });

    it('CTA button has appropriate accessibility label', async () => {
      await render(
        <OutcomeTrendsSection
          tier="nascent"
          tierProgress={mockTierProgress}
          walletCorrelation={mockWalletCorrelation}
          onNavigateToWallet={() => {}}
        />
      );

      const cta = screen.getByLabelText('Go to your wallet to practice tools');
      expect(cta).toBeTruthy();
    });
  });
});
